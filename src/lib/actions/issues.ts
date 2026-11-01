"use server";

import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/db/store";
import { requireProfile, AuthError } from "@/lib/auth";
import { canSetStatus, canTransition } from "@/lib/transitions";
import { WORK_STATUS_PERMISSIONS } from "@/lib/work-orders";
import { commentSchema, updateIssueSchema, verificationSchema, workOrderNoteSchema } from "@/lib/validation";
import type { IssueStatus, WorkOrderStatus } from "@/lib/types";

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

function fail(error: string): ActionResult {
  return { ok: false, error };
}
function ok(message?: string): ActionResult {
  return { ok: true, message };
}

async function handleError(e: unknown): Promise<ActionResult> {
  if (e instanceof AuthError) return fail(e.message);
  console.error(e);
  return fail("Something went wrong. Please try again.");
}

// ---------------------------------------------------------------------------
// Assignment
// ---------------------------------------------------------------------------
export async function assignIssue(issueId: string, assigneeId: string): Promise<ActionResult> {
  try {
    const admin = await requireProfile();
    if (admin.role !== "administrator") return fail("Only administrators can assign issues.");

    const store = await getStore();
    const issue = await store.getIssue(issueId);
    if (!issue) return fail("Issue not found.");
    const assignee = await store.getProfile(assigneeId);
    if (!assignee) return fail("Team member not found.");

    const teamName = deriveTeamName(assignee.teamId, await store.getTeams());

    await store.updateIssue(issueId, {
      assignedToId: assignee.id,
      assignedToName: assignee.fullName,
      teamName,
      status: issue.status === "submitted" || issue.status === "under_review" ? "assigned" : issue.status,
    });

    // Create (or reassign) a work order.
    const orders = await store.getWorkOrders();
    const existing = orders.find((w) => w.issueId === issueId && w.status !== "completed");
    if (existing) {
      await store.updateWorkOrder(existing.id, {
        assignedToId: assignee.id,
        assignedToName: assignee.fullName,
        teamName,
        status: existing.status === "unassigned" ? "acknowledged" : existing.status,
      });
    } else {
      await store.createWorkOrder({
        issueId,
        title: issue.title,
        assignedToId: assignee.id,
        assignedToName: assignee.fullName,
        teamName,
        status: "acknowledged" as WorkOrderStatus,
        priority: issue.priority,
        dueAt: new Date(Date.now() + issue.slaHours * 3600_000).toISOString(),
      });
    }

    await store.addEvent({
      issueId,
      type: "assigned",
      title: `Assigned to ${assignee.fullName}`,
      description: teamName ? `Routed to ${teamName}.` : null,
      actorId: admin.id,
      actorName: admin.fullName,
    });

    await store.createNotification({
      userId: assignee.id,
      title: "New assignment",
      body: `You were assigned “${issue.title}”.`,
      kind: "assignment",
      linkHref: `/issues/${issueId}`,
    });

    revalidatePath("/dashboard");
    revalidatePath(`/issues/${issueId}`);
    return ok(`Assigned to ${assignee.fullName}.`);
  } catch (e) {
    return handleError(e);
  }
}

// ---------------------------------------------------------------------------
// Status change
// ---------------------------------------------------------------------------
export async function changeIssueStatus(
  issueId: string,
  to: IssueStatus,
  note?: string
): Promise<ActionResult> {
  try {
    const actor = await requireProfile();
    const store = await getStore();
    const issue = await store.getIssue(issueId);
    if (!issue) return fail("Issue not found.");

    if (!canTransition(issue.status, to)) {
      return fail(`Cannot move an issue from “${issue.status}” to “${to}”.`);
    }
    if (!canSetStatus(actor.role, to)) {
      return fail("You do not have permission to set this status.");
    }

    await store.updateIssue(issueId, {
      status: to,
      resolutionNote: note ?? issue.resolutionNote,
    });

    await store.addEvent({
      issueId,
      type: "status_changed",
      title: `Status → ${to.replace(/_/g, " ")}`,
      description: note ?? null,
      actorId: actor.id,
      actorName: actor.fullName,
    });

    revalidatePath("/dashboard");
    revalidatePath(`/issues/${issueId}`);
    return ok("Status updated.");
  } catch (e) {
    return handleError(e);
  }
}

// ---------------------------------------------------------------------------
// Community verification
// ---------------------------------------------------------------------------
export async function submitVerification(payload: {
  issueId: string;
  verdict: "confirm_resolved" | "still_not_fixed";
  reason?: string;
}): Promise<ActionResult> {
  try {
    const parsed = verificationSchema.safeParse(payload);
    if (!parsed.success) return fail("Invalid verification payload.");
    const { issueId, verdict, reason } = parsed.data;

    const profile = await requireProfile();
    const store = await getStore();
    const issue = await store.getIssue(issueId);
    if (!issue) return fail("Issue not found.");
    if (issue.status !== "resolved_pending_verification") {
      return fail("This issue is not awaiting verification.");
    }

    await store.addVerification({
      issueId,
      verifierId: profile.id,
      verifierName: profile.fullName,
      verdict,
      reason: reason ?? null,
    });

    if (verdict === "confirm_resolved") {
      await store.updateIssue(issueId, { status: "verified_resolved" });
      await store.addEvent({
        issueId,
        type: "verification_submitted",
        title: "Community confirmed resolved",
        description: reason ?? `${profile.fullName} confirmed the fix.`,
        actorId: profile.id,
        actorName: profile.fullName,
      });
      if (issue.assignedToId) {
        await store.createNotification({
          userId: issue.assignedToId,
          title: "Resolution verified",
          body: `“${issue.title}” was confirmed resolved by the community.`,
          kind: "verification",
          linkHref: `/issues/${issueId}`,
        });
      }
      revalidatePath(`/issues/${issueId}`);
      return ok("Thanks! This issue is now verified resolved.");
    }

    // Dispute → reopen.
    await store.updateIssue(issueId, { status: "reopened" });
    await store.addEvent({
      issueId,
      type: "reopened",
      title: "Reopened — still not fixed",
      description: reason ?? `${profile.fullName} reported the issue persists.`,
      actorId: profile.id,
      actorName: profile.fullName,
    });
    await store.createNotification({
      userId: null,
      title: "Resolution disputed",
      body: `“${issue.title}” was reopened by the community.`,
      kind: "alert",
      linkHref: `/issues/${issueId}`,
    });
    revalidatePath(`/issues/${issueId}`);
    return ok("Issue reopened and flagged for review.");
  } catch (e) {
    return handleError(e);
  }
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------
export async function addComment(payload: { issueId: string; body: string }): Promise<ActionResult> {
  try {
    const parsed = commentSchema.safeParse(payload);
    if (!parsed.success) return fail("Comment cannot be empty.");
    const profile = await requireProfile();
    const store = await getStore();
    const issue = await store.getIssue(parsed.data.issueId);
    if (!issue) return fail("Issue not found.");

    await store.addComment({
      issueId: parsed.data.issueId,
      authorName: profile.fullName,
      authorRole: profile.role,
      body: parsed.data.body,
    });
    await store.addEvent({
      issueId: parsed.data.issueId,
      type: "comment",
      title: "Comment added",
      description: parsed.data.body,
      actorId: profile.id,
      actorName: profile.fullName,
    });
    revalidatePath(`/issues/${parsed.data.issueId}`);
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

// ---------------------------------------------------------------------------
// Work order progress
// ---------------------------------------------------------------------------
export async function updateWorkOrderStatus(
  workOrderId: string,
  status: WorkOrderStatus,
  note?: string,
  evidenceUrl?: string | null
): Promise<ActionResult> {
  try {
    const profile = await requireProfile();
    if (!WORK_STATUS_PERMISSIONS[status]?.includes(profile.role)) {
      return fail("You do not have permission to set this work status.");
    }
    const store = await getStore();
    const wo = await store.getWorkOrder(workOrderId);
    if (!wo) return fail("Work order not found.");

    await store.updateWorkOrder(workOrderId, { status });
    if (note) await store.addWorkOrderNote(workOrderId, { authorName: profile.fullName, body: note });

    const issue = await store.getIssue(wo.issueId);
    if (issue) {
      // Keep the parent issue in sync with meaningful work-order transitions.
      if (status === "in_progress" && issue.status !== "in_progress") {
        await store.updateIssue(issue.id, { status: "in_progress" });
      }
      if (status === "submitted_for_verification") {
        await store.updateIssue(issue.id, {
          status: "resolved_pending_verification",
          resolutionNote: note ?? issue.resolutionNote,
        });
        if (evidenceUrl) {
          await store.addMedia({
            issueId: issue.id,
            url: evidenceUrl,
            kind: "after",
            isEvidence: true,
            caption: note ?? "Resolution evidence",
            storagePath: null,
          });
        }
        await store.createNotification({
          userId: null,
          title: "Resolution awaiting verification",
          body: `“${issue.title}” is ready for community confirmation.`,
          kind: "verification",
          linkHref: `/issues/${issue.id}`,
        });
      }
      await store.addEvent({
        issueId: issue.id,
        type: status === "submitted_for_verification" ? "evidence_added" : "status_changed",
        title: `Work order → ${status.replace(/_/g, " ")}`,
        description: note ?? null,
        actorId: profile.id,
        actorName: profile.fullName,
      });
      revalidatePath(`/issues/${issue.id}`);
    }

    revalidatePath("/work-orders");
    return ok("Work order updated.");
  } catch (e) {
    return handleError(e);
  }
}

export async function addWorkOrderNoteAction(payload: { workOrderId: string; body: string }): Promise<ActionResult> {
  try {
    const parsed = workOrderNoteSchema.safeParse(payload);
    if (!parsed.success) return fail("Note cannot be empty.");
    const profile = await requireProfile();
    const store = await getStore();
    const wo = await store.getWorkOrder(parsed.data.workOrderId);
    if (!wo) return fail("Work order not found.");
    await store.addWorkOrderNote(parsed.data.workOrderId, { authorName: profile.fullName, body: parsed.data.body });
    revalidatePath("/work-orders");
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

// ---------------------------------------------------------------------------
// Duplicate group confirmation
// ---------------------------------------------------------------------------
export async function confirmGroup(groupId: string): Promise<ActionResult> {
  try {
    const admin = await requireProfile();
    if (admin.role !== "administrator") return fail("Only administrators can confirm groups.");
    const store = await getStore();
    const group = await store.getGroup(groupId);
    if (!group) return fail("Group not found.");
    await store.confirmGroup(groupId, admin.id);
    revalidatePath("/map");
    return ok("Duplicate group confirmed. Original reports are preserved and linked.");
  } catch (e) {
    return handleError(e);
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function deriveTeamName(teamId: string | null | undefined, teams: { id: string; name: string }[]): string | null {
  if (!teamId) return null;
  return teams.find((t) => t.id === teamId)?.name ?? null;
}
