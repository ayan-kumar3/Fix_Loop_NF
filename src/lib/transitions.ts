// ---------------------------------------------------------------------------
// Issue status transition rules. Enforced on the server for every status
// change so the lifecycle can never be jumped illegally from the client.
// ---------------------------------------------------------------------------

import type { IssueStatus, UserRole } from "@/lib/types";

const TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  submitted: ["under_review", "assigned", "rejected"],
  under_review: ["assigned", "in_progress", "rejected", "submitted"],
  assigned: ["in_progress", "under_review"],
  in_progress: ["resolved_pending_verification", "assigned", "under_review"],
  resolved_pending_verification: ["verified_resolved", "reopened", "in_progress", "under_review"],
  reopened: ["in_progress", "assigned", "under_review"],
  verified_resolved: ["reopened"],
  rejected: ["under_review", "submitted"],
};

export function canTransition(from: IssueStatus, to: IssueStatus): boolean {
  if (from === to) return true;
  return (TRANSITIONS[from] ?? []).includes(to);
}

/** Roles allowed to move an issue into a given status. */
export function canSetStatus(role: UserRole, to: IssueStatus): boolean {
  switch (to) {
    case "under_review":
    case "rejected":
      return role === "administrator";
    case "assigned":
      return role === "administrator";
    case "in_progress":
      return role === "administrator" || role === "field_staff";
    case "resolved_pending_verification":
      return role === "administrator" || role === "field_staff";
    case "verified_resolved":
      return role === "administrator"; // recorded via community verification too
    case "reopened":
      return role === "administrator"; // community disputes go through verification endpoint
    default:
      return role === "administrator";
  }
}

/** The next sensible status in the happy-path lifecycle. */
export function nextStatus(from: IssueStatus): IssueStatus | null {
  switch (from) {
    case "submitted":
      return "under_review";
    case "under_review":
      return "assigned";
    case "assigned":
      return "in_progress";
    case "in_progress":
      return "resolved_pending_verification";
    default:
      return null;
  }
}
