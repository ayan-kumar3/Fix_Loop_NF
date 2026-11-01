// ---------------------------------------------------------------------------
// DemoStore — in-memory, seeded data layer.
//
// Active when Supabase env vars are absent. Persists for the lifetime of the
// server process (and across Next.js dev hot-reloads via globalThis) so the
// full report → assign → resolve → verify lifecycle is explorable end-to-end
// without any external services.
// ---------------------------------------------------------------------------

import type {
  AiAnalysis,
  Issue,
  IssueEvent,
  IssueGroup,
  IssueMedia,
  Notification,
  Profile,
  Team,
  Verification,
  WorkOrder,
} from "@/lib/types";
import { avatarColor, slaHoursFor } from "@/lib/utils";
import { buildSeed, type Comment, type SeedData } from "@/lib/seed";
import type { CreateIssueInput, DataStore, UpdateIssuePatch, WorkOrderNoteInput } from "@/lib/db/store";

const g = globalThis as unknown as { __fixloop_seed?: SeedData };

function data(): SeedData {
  if (!g.__fixloop_seed) {
    g.__fixloop_seed = buildSeed(Date.now());
  }
  return g.__fixloop_seed;
}

let counter = 1000;
function nextId(prefix: string) {
  counter += 1;
  return `${prefix}_${counter}_${Date.now().toString(36)}`;
}

export class DemoStore implements DataStore {
  readonly mode = "demo" as const;

  private db(): SeedData {
    return data();
  }

  // ---- Profiles & teams --------------------------------------------------
  async getProfiles(): Promise<Profile[]> {
    return this.db().profiles.map(ensureAvatar);
  }
  async getProfile(id: string): Promise<Profile | null> {
    const p = this.db().profiles.find((x) => x.id === id);
    return p ? ensureAvatar(p) : null;
  }
  async createProfile(input: { fullName: string; email: string; role: Profile["role"] }): Promise<Profile> {
    const existing = this.db().profiles.find((p) => p.email.toLowerCase() === input.email.toLowerCase());
    if (existing) throw new Error("An account with this email already exists.");
    const p: Profile = {
      id: nextId("usr"),
      fullName: input.fullName,
      email: input.email,
      role: input.role,
      avatarColor: avatarColor(input.email),
      teamId: null,
      phone: null,
      createdAt: new Date().toISOString(),
      isActive: true,
    };
    this.db().profiles.push(p);
    return p;
  }
  async updateProfile(id: string, patch: Partial<Profile>): Promise<Profile> {
    const p = this.db().profiles.find((x) => x.id === id);
    if (!p) throw new Error("Profile not found");
    Object.assign(p, patch);
    return ensureAvatar(p);
  }
  async getTeams(): Promise<Team[]> {
    return this.db().teams;
  }

  // ---- Issues ------------------------------------------------------------
  async getIssues(): Promise<Issue[]> {
    // newest first
    return [...this.db().issues].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }
  async getIssue(id: string): Promise<Issue | null> {
    return this.db().issues.find((i) => i.id === id || i.publicId === id) ?? null;
  }
  async getIssuesByIds(ids: string[]): Promise<Issue[]> {
    const set = new Set(ids);
    return this.db().issues.filter((i) => set.has(i.id));
  }
  async createIssue(input: CreateIssueInput): Promise<Issue> {
    const seq = this.db().issues.length + 1;
    const now = new Date().toISOString();
    const issue: Issue = {
      id: nextId("iss"),
      publicId: `FX-${new Date().getFullYear()}-${String(9000 + seq).padStart(4, "0")}`,
      title: input.title,
      description: input.description,
      category: input.category,
      priority: input.priority,
      status: "submitted",
      location: { address: input.address, area: input.area, coordinates: input.coordinates },
      reporterId: input.reporterId,
      reporterName: (await this.getProfile(input.reporterId))?.fullName ?? "Resident",
      assignedToId: null,
      assignedToName: null,
      teamName: null,
      createdAt: now,
      updatedAt: now,
      assignedAt: null,
      slaHours: slaHoursFor(input.priority),
      resolutionNote: null,
      resolvedAt: null,
      isDemoData: true,
      commentCount: 0,
      mediaCount: input.mediaUrl ? 1 : 0,
      relatedCount: 0,
    };
    this.db().issues.push(issue);

    if (input.mediaUrl) {
      await this.addMedia({ issueId: issue.id, url: input.mediaUrl, kind: "before", isEvidence: false, caption: "As reported", storagePath: null });
    }
    if (input.aiAnalysis) {
      await this.addAnalysis({ issueId: issue.id, ...input.aiAnalysis });
      await this.addEvent({ issueId: issue.id, type: "ai_analyzed", title: "AI analysis completed", description: `Suggested ${input.aiAnalysis.suggestedCategory} · ${input.aiAnalysis.suggestedPriority}.`, actorId: null, actorName: "FixLoop AI" });
    }
    await this.addEvent({ issueId: issue.id, type: "created", title: "Report submitted", description: `${issue.reporterName} submitted the report.`, actorId: issue.reporterId, actorName: issue.reporterName });

    // Link to an existing duplicate group when the reporter confirms.
    if (input.linkToIssueId) {
      const group = await this.linkToGroup(input.linkToIssueId, issue.id);
      if (group) {
        issue.relatedCount = group.memberIssueIds.length - 1;
        await this.addEvent({ issueId: issue.id, type: "duplicate_linked", title: "Linked to an existing report", description: `Grouped with ${group.title}.`, actorId: issue.reporterId, actorName: issue.reporterName, meta: { groupId: group.id } });
      }
    }

    await this.createNotification({
      userId: null,
      title: "New report submitted",
      body: `${issue.publicId} · ${issue.title}`,
      kind: "system",
      linkHref: `/issues/${issue.id}`,
    });
    return issue;
  }
  async updateIssue(id: string, patch: UpdateIssuePatch): Promise<Issue> {
    const issue = this.db().issues.find((i) => i.id === id);
    if (!issue) throw new Error("Issue not found");

    if (patch.status) issue.status = patch.status;
    if (patch.priority) {
      issue.priority = patch.priority;
      issue.slaHours = slaHoursFor(patch.priority);
    }
    if (patch.category) issue.category = patch.category;
    if (patch.assignedToId !== undefined) {
      issue.assignedToId = patch.assignedToId;
      issue.assignedToName = patch.assignedToName ?? null;
      issue.teamName = patch.teamName ?? null;
      if (patch.assignedToId && !issue.assignedAt) issue.assignedAt = new Date().toISOString();
      if (patch.assignedToId && issue.status === "submitted") issue.status = "assigned";
    }
    if (patch.resolutionNote !== undefined) issue.resolutionNote = patch.resolutionNote;
    issue.updatedAt = new Date().toISOString();
    // Note: runtime event logging is handled explicitly by the server actions
    // (assignIssue / changeIssueStatus / etc.) so events are never double-logged.
    return issue;
  }

  // ---- Media -------------------------------------------------------------
  async getMedia(issueId: string): Promise<IssueMedia[]> {
    return this.db().issueMedia.filter((m) => m.issueId === issueId);
  }
  async getAllMedia(): Promise<IssueMedia[]> {
    return [...this.db().issueMedia];
  }
  async addMedia(media: Omit<IssueMedia, "id" | "uploadedAt">): Promise<IssueMedia> {
    const m: IssueMedia = { ...media, id: nextId("med"), uploadedAt: new Date().toISOString() };
    this.db().issueMedia.push(m);
    const issue = this.db().issues.find((i) => i.id === media.issueId);
    if (issue) issue.mediaCount = this.db().issueMedia.filter((x) => x.issueId === media.issueId).length;
    return m;
  }

  // ---- AI analyses -------------------------------------------------------
  async getAnalyses(issueId: string): Promise<AiAnalysis[]> {
    return this.db().aiAnalyses.filter((a) => a.issueId === issueId);
  }
  async addAnalysis(a: Omit<AiAnalysis, "id" | "createdAt">): Promise<AiAnalysis> {
    const model: AiAnalysis = { ...a, id: nextId("ai"), createdAt: new Date().toISOString() };
    this.db().aiAnalyses.push(model);
    return model;
  }

  // ---- Events ------------------------------------------------------------
  async getEvents(issueId: string): Promise<IssueEvent[]> {
    return this.db().issueEvents.filter((e) => e.issueId === issueId).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }
  async addEvent(e: Omit<IssueEvent, "id" | "createdAt"> & { createdAt?: string }): Promise<IssueEvent> {
    const ev: IssueEvent = { ...e, id: nextId("evt"), createdAt: e.createdAt ?? new Date().toISOString() };
    this.db().issueEvents.push(ev);
    return ev;
  }

  // ---- Comments ----------------------------------------------------------
  async getComments(issueId: string): Promise<Comment[]> {
    return this.db().comments.filter((c) => c.issueId === issueId).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }
  async addComment(c: Omit<Comment, "id" | "createdAt">): Promise<Comment> {
    const cm: Comment = { ...c, id: nextId("cmt"), createdAt: new Date().toISOString() };
    this.db().comments.push(cm);
    const issue = this.db().issues.find((i) => i.id === c.issueId);
    if (issue) issue.commentCount = this.db().comments.filter((x) => x.issueId === c.issueId).length;
    return cm;
  }

  // ---- Work orders -------------------------------------------------------
  async getWorkOrders(): Promise<WorkOrder[]> {
    return [...this.db().workOrders].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }
  async getWorkOrder(id: string): Promise<WorkOrder | null> {
    return this.db().workOrders.find((w) => w.id === id) ?? null;
  }
  async createWorkOrder(input: Omit<WorkOrder, "id" | "createdAt" | "notes" | "acknowledgedAt">): Promise<WorkOrder> {
    const wo: WorkOrder = { ...input, id: nextId("wo"), createdAt: new Date().toISOString(), notes: [], acknowledgedAt: null };
    this.db().workOrders.push(wo);
    return wo;
  }
  async updateWorkOrder(id: string, patch: Partial<WorkOrder>): Promise<WorkOrder> {
    const wo = this.db().workOrders.find((w) => w.id === id);
    if (!wo) throw new Error("Work order not found");
    Object.assign(wo, patch);
    return wo;
  }
  async addWorkOrderNote(id: string, note: WorkOrderNoteInput): Promise<WorkOrder> {
    const wo = this.db().workOrders.find((w) => w.id === id);
    if (!wo) throw new Error("Work order not found");
    wo.notes.push({ ...note, id: nextId("note"), createdAt: new Date().toISOString() });
    return wo;
  }

  // ---- Verifications -----------------------------------------------------
  async getVerifications(issueId: string): Promise<Verification[]> {
    return this.db().verifications.filter((v) => v.issueId === issueId).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }
  async addVerification(v: Omit<Verification, "id" | "createdAt">): Promise<Verification> {
    const ver: Verification = { ...v, id: nextId("ver"), createdAt: new Date().toISOString() };
    this.db().verifications.push(ver);
    return ver;
  }

  // ---- Duplicate groups --------------------------------------------------
  async getGroups(): Promise<IssueGroup[]> {
    return this.db().issueGroups;
  }
  async getGroup(id: string): Promise<IssueGroup | null> {
    return this.db().issueGroups.find((g2) => g2.id === id) ?? null;
  }
  async createGroup(g2: Omit<IssueGroup, "id" | "createdAt">): Promise<IssueGroup> {
    const group: IssueGroup = { ...g2, id: nextId("grp"), createdAt: new Date().toISOString() };
    this.db().issueGroups.push(group);
    return group;
  }
  async confirmGroup(id: string, _actorId: string): Promise<IssueGroup> {
    const group = this.db().issueGroups.find((g2) => g2.id === id);
    if (!group) throw new Error("Group not found");
    group.status = "confirmed";
    for (const iid of group.memberIssueIds) {
      await this.addEvent({ issueId: iid, type: "group_confirmed", title: "Duplicate group confirmed", description: `This report is grouped under “${group.title}”.`, actorId: _actorId, actorName: "Administrator", meta: { groupId: group.id } });
    }
    return group;
  }

  /** Attach a newly created issue to an existing group (by its representative). */
  private async linkToGroup(existingIssueId: string, newIssueId: string): Promise<IssueGroup | null> {
    let group = this.db().issueGroups.find((g2) => g2.memberIssueIds.includes(existingIssueId));
    if (!group) {
      const rep = await this.getIssue(existingIssueId);
      if (!rep) return null;
      group = {
        id: nextId("grp"),
        title: rep.title,
        representativeIssueId: rep.id,
        memberIssueIds: [rep.id],
        similarity: 0.7,
        distanceMeters: 0,
        status: "suggested",
        reason: "Grouped when the reporter confirmed their issue matches an existing report.",
        createdAt: new Date().toISOString(),
      };
      this.db().issueGroups.push(group);
    }
    if (!group.memberIssueIds.includes(newIssueId)) group.memberIssueIds.push(newIssueId);
    return group;
  }

  // ---- Notifications -----------------------------------------------------
  async getNotifications(userId: string | null): Promise<Notification[]> {
    return this.db().notifications.filter((n) => n.userId === null || n.userId === userId).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }
  async markNotificationRead(id: string): Promise<void> {
    const n = this.db().notifications.find((x) => x.id === id);
    if (n) n.read = true;
  }
  async markAllNotificationsRead(userId: string | null): Promise<void> {
    for (const n of this.db().notifications) {
      if (n.userId === null || n.userId === userId) n.read = true;
    }
  }
  async createNotification(n: Omit<Notification, "id" | "createdAt" | "read">): Promise<Notification> {
    const note: Notification = { ...n, id: nextId("ntf"), read: false, createdAt: new Date().toISOString() };
    this.db().notifications.push(note);
    return note;
  }
}

function ensureAvatar(p: Profile): Profile {
  if (!p.avatarColor) p.avatarColor = avatarColor(p.email || p.fullName);
  return p;
}
