// ---------------------------------------------------------------------------
// FixLoop domain types + enums
// Single source of truth shared by the UI, API routes, validation, and the
// data layer (both the local demo store and Supabase).
// ---------------------------------------------------------------------------

/** Issue categories supported by the platform. */
export const ISSUE_CATEGORIES = [
  "Sanitation",
  "Water Leakage",
  "Roads",
  "Street Lighting",
  "Drainage",
  "Footpath",
  "Public Infrastructure",
  "Waste Management",
] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

/** Priority levels. Ordered from most to least urgent. */
export const ISSUE_PRIORITIES = ["Critical", "High", "Medium", "Low"] as const;
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];

/**
 * Full issue lifecycle. Every transition is validated server-side and every
 * change writes an issue_events row.
 *
 * submitted -> under_review -> assigned -> in_progress
 *   -> resolved_pending_verification -> verified_resolved
 *
 * A verified_resolved issue can be reopened (community dispute) which returns
 * it to in_progress (or under_review) and flags it for admin attention.
 */
export const ISSUE_STATUSES = [
  "submitted",
  "under_review",
  "assigned",
  "in_progress",
  "resolved_pending_verification",
  "verified_resolved",
  "reopened",
  "rejected",
] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

/** Human-friendly labels + chip tones for statuses. */
export const STATUS_META: Record<
  IssueStatus,
  { label: string; tone: Tone }
> = {
  submitted: { label: "Submitted", tone: "neutral" },
  under_review: { label: "Under Review", tone: "info" },
  assigned: { label: "Assigned", tone: "info" },
  in_progress: { label: "In Progress", tone: "warn" },
  resolved_pending_verification: { label: "Pending Verification", tone: "warn" },
  verified_resolved: { label: "Verified Resolved", tone: "success" },
  reopened: { label: "Reopened", tone: "danger" },
  rejected: { label: "Rejected", tone: "danger" },
};

export const PRIORITY_META: Record<IssuePriority, { label: string; tone: Tone; rank: number }> = {
  Critical: { label: "Critical", tone: "danger", rank: 4 },
  High: { label: "High", tone: "danger", rank: 3 },
  Medium: { label: "Medium", tone: "warn", rank: 2 },
  Low: { label: "Low", tone: "neutral", rank: 1 },
};

export type Tone = "neutral" | "info" | "warn" | "danger" | "success" | "brand";

/** Roles used for authorization. Enforced server-side, never trusted from the client. */
export const USER_ROLES = ["resident", "field_staff", "administrator"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_META: Record<UserRole, { label: string; tone: Tone }> = {
  resident: { label: "Resident", tone: "neutral" },
  field_staff: { label: "Field Staff", tone: "info" },
  administrator: { label: "Administrator", tone: "brand" },
};

/** AI confidence bands returned by Gemini analysis. */
export const CONFIDENCE_BANDS = ["High", "Medium", "Low"] as const;
export type ConfidenceBand = (typeof CONFIDENCE_BANDS)[number];

// ---------------------------------------------------------------------------
// Entity interfaces
// ---------------------------------------------------------------------------

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  avatarColor: string;
  /** Optional team assignment for field staff. */
  teamId?: string | null;
  phone?: string | null;
  createdAt: string;
  isActive: boolean;
}

export interface Team {
  id: string;
  name: string;
  specialty: string;
  memberCount: number;
  leadName: string;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface IssueLocation {
  /** Human readable place, e.g. "Main St & 1st Ave". */
  address: string;
  /** Broader area/zone label, e.g. "Central District". */
  area: string;
  coordinates: GeoPoint;
}

/** AI analysis output. Stored separately from human-confirmed values. */
export interface AiAnalysis {
  id: string;
  issueId: string;
  model: string;
  suggestedCategory: IssueCategory;
  summary: string;
  visualFindings?: string;
  detailedReport?: string;
  suggestedPriority: IssuePriority;
  reason: string;
  confidenceBand: ConfidenceBand;
  needsReview: boolean;
  safetyNote: string | null;
  createdAt: string;
}

export interface IssueMedia {
  id: string;
  issueId: string;
  url: string;
  /** Storage path (Supabase) or data/asset key (demo mode). */
  storagePath?: string | null;
  caption?: string | null;
  isEvidence: boolean;
  kind: "before" | "after";
  uploadedAt: string;
}

export interface IssueEvent {
  id: string;
  issueId: string;
  type:
    | "created"
    | "ai_analyzed"
    | "status_changed"
    | "assigned"
    | "comment"
    | "evidence_added"
    | "verification_submitted"
    | "duplicate_linked"
    | "reopened"
    | "group_confirmed";
  title: string;
  description?: string | null;
  actorId: string | null;
  actorName: string;
  createdAt: string;
  meta?: Record<string, unknown> | null;
}

export interface WorkOrder {
  id: string;
  issueId: string;
  title: string;
  assignedToId: string | null;
  assignedToName: string | null;
  teamName: string | null;
  status: WorkOrderStatus;
  priority: IssuePriority;
  dueAt: string;
  createdAt: string;
  acknowledgedAt?: string | null;
  notes: WorkOrderNote[];
}

export const WORK_ORDER_STATUSES = [
  "unassigned",
  "acknowledged",
  "in_progress",
  "submitted_for_verification",
  "completed",
] as const;
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

export const WORK_ORDER_META: Record<WorkOrderStatus, { label: string; tone: Tone }> = {
  unassigned: { label: "Unassigned", tone: "neutral" },
  acknowledged: { label: "Acknowledged", tone: "info" },
  in_progress: { label: "In Progress", tone: "warn" },
  submitted_for_verification: { label: "Pending Verification", tone: "warn" },
  completed: { label: "Completed", tone: "success" },
};

export interface WorkOrderNote {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface Verification {
  id: string;
  issueId: string;
  verifierId: string;
  verifierName: string;
  verdict: "confirm_resolved" | "still_not_fixed";
  reason?: string | null;
  createdAt: string;
}

export interface Issue {
  id: string;
  /** Public-facing human ID, e.g. "FX-2024-0142". */
  publicId: string;
  title: string;
  description: string;
  category: IssueCategory;
  priority: IssuePriority;
  status: IssueStatus;
  location: IssueLocation;
  reporterId: string;
  reporterName: string;
  assignedToId: string | null;
  assignedToName: string | null;
  teamName: string | null;
  createdAt: string;
  updatedAt: string;
  /** Timestamp of first assignment — used to derive real response-time metrics. */
  assignedAt: string | null;
  /** SLA target in hours for this priority. */
  slaHours: number;
  /** Community verification info once resolved. */
  resolutionNote?: string | null;
  resolvedAt?: string | null;
  isDemoData: boolean;
  /** Denormalized counters for fast list rendering. */
  commentCount: number;
  mediaCount: number;
  relatedCount: number;
}

/** A grouped cluster of potential duplicates. */
export interface IssueGroup {
  id: string;
  title: string;
  representativeIssueId: string;
  memberIssueIds: string[];
  similarity: number;
  distanceMeters: number;
  status: "suggested" | "confirmed";
  reason: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string | null; // null = broadcast
  title: string;
  body: string;
  kind: "alert" | "assignment" | "verification" | "system";
  read: boolean;
  linkHref?: string | null;
  createdAt: string;
}

/** Compact record used by the Map Overview issue list. */
export interface MapIssueListItem {
  id: string;
  publicId: string;
  title: string;
  category: IssueCategory;
  priority: IssuePriority;
  status: IssueStatus;
  address: string;
  coordinates: GeoPoint;
  thumbnailUrl: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Derived metric types
// ---------------------------------------------------------------------------

export interface DashboardMetrics {
  openIssues: number;
  overdue: number;
  unassigned: number;
  avgResponseMinutes: number | null;
  avgResolutionMinutes: number | null;
  verifiedResolved: number;
  /** Previous-period comparisons. null when insufficient data. */
  comparisons: {
    openIssues: number | null;
    overdue: number | null;
    unassigned: number | null;
    avgResponseMinutes: number | null;
    avgResolutionMinutes: number | null;
  };
}

export interface AttentionCard {
  key: "overdue" | "unassigned_high" | "sla_breach";
  count: number;
  heading: string;
  subheading: string;
  badge: string;
  actionLabel: string;
  actionHref: string;
}

export interface CategoryCount {
  category: IssueCategory;
  count: number;
}

export interface StatusCount {
  status: IssueStatus;
  count: number;
}

export interface TimeSeriesPoint {
  date: string; // ISO date (yyyy-mm-dd)
  count: number;
}

export interface Hotspot {
  area: string;
  count: number;
  coordinates: GeoPoint;
}
