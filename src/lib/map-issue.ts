// ---------------------------------------------------------------------------
// Map issue shape + pure mapping helpers.
//
// Deliberately NOT in a "use client" file: server code (queries, server
// components) imports these, and importing a helper from a client module from
// the server turns it into a client-reference proxy that can't be called.
// ---------------------------------------------------------------------------

import type { Issue, IssueCategory, IssuePriority, IssueStatus } from "@/lib/types";

export interface MapIssue {
  id: string;
  publicId: string;
  title: string;
  category: IssueCategory;
  priority: IssuePriority;
  status: IssueStatus;
  address: string;
  coordinates: { lat: number; lng: number };
  thumbnailUrl: string | null;
  createdAt: string;
}

/** Convert a stored issue into the compact shape the Leaflet view consumes. */
export function toMapIssue(i: Issue, thumbnailUrl: string | null): MapIssue {
  return {
    id: i.id,
    publicId: i.publicId,
    title: i.title,
    category: i.category,
    priority: i.priority,
    status: i.status,
    address: i.location.address,
    coordinates: i.location.coordinates,
    thumbnailUrl,
    createdAt: i.createdAt,
  };
}

const isResolvedStatus = (s: IssueStatus) =>
  s === "verified_resolved" || s === "resolved_pending_verification";

/** Marker colour rule: resolved green, critical/high red, medium amber, else blue. */
export function markerColor(issue: Pick<MapIssue, "priority" | "status">): string {
  if (isResolvedStatus(issue.status)) return "#16a34a"; // green
  if (issue.priority === "Critical" || issue.priority === "High") return "#ef4444"; // red
  if (issue.priority === "Medium") return "#f59e0b"; // amber
  return "#3b82f6"; // blue
}
