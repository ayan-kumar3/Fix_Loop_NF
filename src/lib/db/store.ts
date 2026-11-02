// ---------------------------------------------------------------------------
// DataStore abstraction
//
// The app talks to this interface everywhere. Two implementations exist:
//   • DemoStore   — in-memory, seeded. Used when Supabase env vars are absent
//                   so the platform is fully explorable with zero setup.
//   • SupabaseStore — Postgres-backed, used in production.
//
// Derived metrics / analytics / duplicate detection live in shared pure
// selectors (lib/db/selectors.ts) so both stores stay thin: they only fetch
// and persist rows.
// ---------------------------------------------------------------------------

import type {
  AiAnalysis,
  Issue,
  IssueCategory,
  IssueEvent,
  IssueGroup,
  IssueMedia,
  IssuePriority,
  IssueStatus,
  Notification,
  Profile,
  RequestedRole,
  RoleRequest,
  RoleRequestStatus,
  Team,
  Verification,
  WorkOrder,
  WorkOrderStatus,
  GeoPoint,
} from "@/lib/types";
import type { Comment } from "@/lib/seed";

export interface CreateIssueInput {
  title: string;
  description: string;
  category: IssueCategory;
  priority: IssuePriority;
  address: string;
  area: string;
  coordinates: GeoPoint;
  reporterId: string;
  /** Optional raw AI suggestion captured at submission time. */
  aiAnalysis?: Omit<AiAnalysis, "id" | "issueId" | "createdAt">;
  /** Optional uploaded image URL (Supabase Storage path or local asset). */
  mediaUrl?: string | null;
  /** When the reporter confirms an existing similar issue, link to its group. */
  linkToIssueId?: string | null;
}

export interface UpdateIssuePatch {
  status?: IssueStatus;
  priority?: IssuePriority;
  assignedToId?: string | null;
  assignedToName?: string | null;
  teamName?: string | null;
  resolutionNote?: string | null;
  category?: IssueCategory;
}

export interface DataStore {
  readonly mode: "demo" | "supabase";

  // Profiles & teams
  getProfiles(): Promise<Profile[]>;
  getProfile(id: string): Promise<Profile | null>;
  createProfile(input: {
    id?: string;
    fullName: string;
    email: string;
    role: Profile["role"];
    password?: string;
  }): Promise<Profile>;
  updateProfile(id: string, patch: Partial<Pick<Profile, "fullName" | "phone" | "isActive" | "role" | "teamId">>): Promise<Profile>;
  createRoleRequest(userId: string, requestedRole: RequestedRole): Promise<RoleRequest>;
  getRoleRequests(status?: RoleRequestStatus): Promise<RoleRequest[]>;
  reviewRoleRequest(id: string, status: Exclude<RoleRequestStatus, "pending">, reviewedBy: string): Promise<RoleRequest>;
  getTeams(): Promise<Team[]>;

  // Issues
  getIssues(): Promise<Issue[]>;
  getIssue(id: string): Promise<Issue | null>;
  getIssuesByIds(ids: string[]): Promise<Issue[]>;
  createIssue(input: CreateIssueInput): Promise<Issue>;
  updateIssue(id: string, patch: UpdateIssuePatch): Promise<Issue>;

  // Media
  getMedia(issueId: string): Promise<IssueMedia[]>;
  getAllMedia(): Promise<IssueMedia[]>;
  addMedia(media: Omit<IssueMedia, "id" | "uploadedAt">): Promise<IssueMedia>;

  // AI analyses
  getAnalyses(issueId: string): Promise<AiAnalysis[]>;
  addAnalysis(a: Omit<AiAnalysis, "id" | "createdAt">): Promise<AiAnalysis>;

  // Events
  getEvents(issueId: string): Promise<IssueEvent[]>;
  addEvent(e: Omit<IssueEvent, "id" | "createdAt"> & { createdAt?: string }): Promise<IssueEvent>;

  // Comments
  getComments(issueId: string): Promise<Comment[]>;
  addComment(c: Omit<Comment, "id" | "createdAt">): Promise<Comment>;

  // Work orders
  getWorkOrders(): Promise<WorkOrder[]>;
  getWorkOrder(id: string): Promise<WorkOrder | null>;
  createWorkOrder(input: Omit<WorkOrder, "id" | "createdAt" | "notes" | "acknowledgedAt">): Promise<WorkOrder>;
  updateWorkOrder(id: string, patch: Partial<Pick<WorkOrder, "status" | "assignedToId" | "assignedToName" | "teamName" | "dueAt">>): Promise<WorkOrder>;
  addWorkOrderNote(id: string, note: Omit<WorkOrderNoteInput, "id" | "createdAt">): Promise<WorkOrder>;

  // Verifications
  getVerifications(issueId: string): Promise<Verification[]>;
  addVerification(v: Omit<Verification, "id" | "createdAt">): Promise<Verification>;

  // Duplicate groups
  getGroups(): Promise<IssueGroup[]>;
  getGroup(id: string): Promise<IssueGroup | null>;
  createGroup(g: Omit<IssueGroup, "id" | "createdAt">): Promise<IssueGroup>;
  confirmGroup(id: string, actorId: string): Promise<IssueGroup>;

  // Notifications
  getNotifications(userId: string | null): Promise<Notification[]>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(userId: string | null): Promise<void>;
  createNotification(n: Omit<Notification, "id" | "createdAt" | "read">): Promise<Notification>;
}

export interface WorkOrderNoteInput {
  authorName: string;
  body: string;
}

// ---------------------------------------------------------------------------
// Store selection
// ---------------------------------------------------------------------------

export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

let cached: DataStore | null = null;

export async function getStore(): Promise<DataStore> {
  if (cached) return cached;
  if (supabaseConfigured()) {
    const { SupabaseStore } = await import("@/lib/db/supabase-store");
    cached = new SupabaseStore();
  } else {
    const { DemoStore } = await importDemo();
    cached = new DemoStore();
  }
  return cached;
}

async function importDemo() {
  return import("@/lib/db/demo-store");
}

export function runtimeMode(): "demo" | "supabase" {
  return supabaseConfigured() ? "supabase" : "demo";
}
