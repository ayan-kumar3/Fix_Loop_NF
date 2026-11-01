// ---------------------------------------------------------------------------
// SupabaseStore — Postgres-backed implementation of the DataStore interface.
//
// Reads use the authenticated (cookie) client and therefore respect Row Level
// Security. Privileged writes use the service-role client and are only ever
// reached after the calling server action has enforced the caller's role and
// the lifecycle transition rules.
//
// This store is used automatically when NEXT_PUBLIC_SUPABASE_URL and the anon
// key are present. It maps snake_case rows to the camelCase domain types.
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
import { createServerClient, getServiceClient } from "@/lib/supabase/server";
import type { CreateIssueInput, DataStore, UpdateIssuePatch, WorkOrderNoteInput } from "@/lib/db/store";
import type { Comment } from "@/lib/seed";

type Session = ReturnType<typeof createServerClient>;

interface IssueRow {
  id: string;
  public_id: string;
  title: string;
  description: string;
  category: Issue["category"];
  priority: Issue["priority"];
  status: Issue["status"];
  address: string;
  area: string | null;
  lat: number;
  lng: number;
  reporter_id: string | null;
  reporter_name: string | null;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
  team_name: string | null;
  created_at: string;
  updated_at: string;
  assigned_at: string | null;
  sla_hours: number;
  resolution_note: string | null;
  resolved_at: string | null;
  is_demo_data: boolean;
  comment_count?: number;
  media_count?: number;
  related_count?: number;
}

function mapIssue(r: IssueRow): Issue {
  return {
    id: r.id,
    publicId: r.public_id,
    title: r.title,
    description: r.description,
    category: r.category,
    priority: r.priority,
    status: r.status,
    location: { address: r.address, area: r.area ?? "Unzoned", coordinates: { lat: r.lat, lng: r.lng } },
    reporterId: r.reporter_id ?? "",
    reporterName: r.reporter_name ?? "Resident",
    assignedToId: r.assigned_to_id,
    assignedToName: r.assigned_to_name,
    teamName: r.team_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    assignedAt: r.assigned_at,
    slaHours: r.sla_hours,
    resolutionNote: r.resolution_note,
    resolvedAt: r.resolved_at,
    isDemoData: r.is_demo_data,
    commentCount: r.comment_count ?? 0,
    mediaCount: r.media_count ?? 0,
    relatedCount: r.related_count ?? 0,
  };
}

export class SupabaseStore implements DataStore {
  readonly mode = "supabase" as const;
  private db: Session;
  private admin = getServiceClient();

  constructor() {
    this.db = createServerClient();
  }

  private get write() {
    return (this.admin ?? this.db) as Session;
  }

  // ---- Profiles & teams --------------------------------------------------
  async getProfiles(): Promise<Profile[]> {
    const { data, error } = await this.db.from("profiles").select("*").order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => this.mapProfile(r));
  }
  async getProfile(id: string): Promise<Profile | null> {
    const { data, error } = await this.db.from("profiles").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? this.mapProfile(data as Record<string, unknown>) : null;
  }
  async createProfile(input: { fullName: string; email: string; role: Profile["role"] }): Promise<Profile> {
    const id = crypto.randomUUID();
    const row = {
      id,
      full_name: input.fullName,
      email: input.email,
      role: input.role,
      avatar_color: avatarColor(input.email),
      created_at: new Date().toISOString(),
      is_active: true,
    };
    const { data, error } = await this.write.from("profiles").insert(row).select().single();
    if (error) throw error;
    return this.mapProfile(data as Record<string, unknown>);
  }
  async updateProfile(id: string, patch: Partial<Profile>): Promise<Profile> {
    const row: Record<string, unknown> = {};
    if (patch.fullName !== undefined) row.full_name = patch.fullName;
    if (patch.phone !== undefined) row.phone = patch.phone;
    if (patch.isActive !== undefined) row.is_active = patch.isActive;
    if (patch.role !== undefined) row.role = patch.role;
    if (patch.teamId !== undefined) row.team_id = patch.teamId;
    const { data, error } = await this.write.from("profiles").update(row).eq("id", id).select().single();
    if (error) throw error;
    return this.mapProfile(data as Record<string, unknown>);
  }
  async getTeams(): Promise<Team[]> {
    const { data, error } = await this.db.from("teams").select("*");
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      name: r.name as string,
      specialty: (r.specialty as string) ?? "",
      memberCount: (r.member_count as number) ?? 0,
      leadName: (r.lead_name as string) ?? "",
    }));
  }

  private mapProfile(r: Record<string, unknown>): Profile {
    return {
      id: r.id as string,
      fullName: (r.full_name as string) ?? "",
      email: (r.email as string) ?? "",
      role: r.role as Profile["role"],
      avatarColor: (r.avatar_color as string) || avatarColor((r.email as string) ?? ""),
      teamId: (r.team_id as string) ?? null,
      phone: (r.phone as string) ?? null,
      createdAt: r.created_at as string,
      isActive: (r.is_active as boolean) ?? true,
    };
  }

  // ---- Issues ------------------------------------------------------------
  async getIssues(): Promise<Issue[]> {
    const { data, error } = await this.db
      .from("issues")
      .select("*, comment_count:comments(count), media_count:issue_media(count)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => {
      const issue = mapIssue(r as unknown as IssueRow);
      const cc = r.comment_count as Array<{ count: number }> | number | undefined;
      const mc = r.media_count as Array<{ count: number }> | number | undefined;
      issue.commentCount = Array.isArray(cc) ? (cc[0]?.count ?? 0) : (cc ?? 0);
      issue.mediaCount = Array.isArray(mc) ? (mc[0]?.count ?? 0) : (mc ?? 0);
      return issue;
    });
  }
  async getIssue(id: string): Promise<Issue | null> {
    const { data, error } = await this.db.from("issues").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const issue = mapIssue(data as unknown as IssueRow);
    const [comments, media, groups] = await Promise.all([
      this.getComments(issue.id),
      this.getMedia(issue.id),
      this.getGroups(),
    ]);
    issue.commentCount = comments.length;
    issue.mediaCount = media.length;
    issue.relatedCount = groups.reduce((s, g) => (g.memberIssueIds.includes(issue.id) ? s + g.memberIssueIds.length - 1 : s), 0);
    return issue;
  }
  async getIssuesByIds(ids: string[]): Promise<Issue[]> {
    if (ids.length === 0) return [];
    const { data, error } = await this.db.from("issues").select("*").in("id", ids);
    if (error) throw error;
    return (data ?? []).map((r) => mapIssue(r as unknown as IssueRow));
  }
  async createIssue(input: CreateIssueInput): Promise<Issue> {
    const now = new Date().toISOString();
    const row = {
      public_id: `FX-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 8999)}`,
      title: input.title,
      description: input.description,
      category: input.category,
      priority: input.priority,
      status: "submitted",
      address: input.address,
      area: input.area,
      lat: input.coordinates.lat,
      lng: input.coordinates.lng,
      reporter_id: input.reporterId,
      sla_hours: slaHoursFor(input.priority),
      created_at: now,
      updated_at: now,
      is_demo_data: false,
    };
    const { data, error } = await this.write.from("issues").insert(row).select().single();
    if (error) throw error;
    const issue = mapIssue(data as unknown as IssueRow);

    if (input.mediaUrl) {
      await this.addMedia({ issueId: issue.id, url: input.mediaUrl, kind: "before", isEvidence: false, caption: "As reported", storagePath: null });
    }
    if (input.aiAnalysis) {
      await this.addAnalysis({ issueId: issue.id, ...input.aiAnalysis });
    }
    await this.addEvent({ issueId: issue.id, type: "created", title: "Report submitted", description: `${issue.reporterName} submitted the report.`, actorId: issue.reporterId, actorName: issue.reporterName });
    return issue;
  }
  async updateIssue(id: string, patch: UpdateIssuePatch): Promise<Issue> {
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.status) row.status = patch.status;
    if (patch.priority) {
      row.priority = patch.priority;
      row.sla_hours = slaHoursFor(patch.priority);
    }
    if (patch.category) row.category = patch.category;
    if (patch.assignedToId !== undefined) {
      row.assigned_to_id = patch.assignedToId;
      row.assigned_to_name = patch.assignedToName ?? null;
      row.team_name = patch.teamName ?? null;
      if (patch.assignedToId) {
        const { data: existing } = await this.db.from("issues").select("assigned_at").eq("id", id).single();
        if (!existing?.assigned_at) row.assigned_at = new Date().toISOString();
      }
    }
    if (patch.resolutionNote !== undefined) row.resolution_note = patch.resolutionNote;
    if (patch.status === "resolved_pending_verification") {
      const { data: existing } = await this.db.from("issues").select("resolved_at").eq("id", id).single();
      if (!existing?.resolved_at) row.resolved_at = new Date().toISOString();
    }
    const { data, error } = await this.write.from("issues").update(row).eq("id", id).select().single();
    if (error) throw error;
    return mapIssue(data as unknown as IssueRow);
  }

  // ---- Media -------------------------------------------------------------
  async getMedia(issueId: string): Promise<IssueMedia[]> {
    const { data, error } = await this.db.from("issue_media").select("*").eq("issue_id", issueId).order("uploaded_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => this.mapMedia(r as Record<string, unknown>));
  }
  async getAllMedia(): Promise<IssueMedia[]> {
    const { data, error } = await this.db.from("issue_media").select("*");
    if (error) throw error;
    return (data ?? []).map((r) => this.mapMedia(r as Record<string, unknown>));
  }
  async addMedia(media: Omit<IssueMedia, "id" | "uploadedAt">): Promise<IssueMedia> {
    const { data, error } = await this.write
      .from("issue_media")
      .insert({
        issue_id: media.issueId,
        url: media.url,
        storage_path: media.storagePath ?? null,
        caption: media.caption ?? null,
        is_evidence: media.isEvidence,
        kind: media.kind,
        uploaded_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return this.mapMedia(data as Record<string, unknown>);
  }
  private mapMedia(r: Record<string, unknown>): IssueMedia {
    return {
      id: r.id as string,
      issueId: r.issue_id as string,
      url: r.url as string,
      storagePath: (r.storage_path as string) ?? null,
      caption: (r.caption as string) ?? null,
      isEvidence: (r.is_evidence as boolean) ?? false,
      kind: (r.kind as "before" | "after") ?? "before",
      uploadedAt: r.uploaded_at as string,
    };
  }

  // ---- AI analyses -------------------------------------------------------
  async getAnalyses(issueId: string): Promise<AiAnalysis[]> {
    const { data, error } = await this.db.from("ai_analyses").select("*").eq("issue_id", issueId).order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => this.mapAnalysis(r as Record<string, unknown>));
  }
  async addAnalysis(a: Omit<AiAnalysis, "id" | "createdAt">): Promise<AiAnalysis> {
    const { data, error } = await this.write
      .from("ai_analyses")
      .insert({
        issue_id: a.issueId,
        model: a.model,
        suggested_category: a.suggestedCategory,
        summary: a.summary,
        visual_findings: a.visualFindings ?? null,
        detailed_report: a.detailedReport ?? null,
        suggested_priority: a.suggestedPriority,
        reason: a.reason,
        confidence_band: a.confidenceBand,
        needs_review: a.needsReview,
        safety_note: a.safetyNote,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return this.mapAnalysis(data as Record<string, unknown>);
  }
  private mapAnalysis(r: Record<string, unknown>): AiAnalysis {
    return {
      id: r.id as string,
      issueId: r.issue_id as string,
      model: (r.model as string) ?? "gemini",
      suggestedCategory: r.suggested_category as AiAnalysis["suggestedCategory"],
      summary: (r.summary as string) ?? "",
      visualFindings: (r.visual_findings as string) ?? undefined,
      detailedReport: (r.detailed_report as string) ?? undefined,
      suggestedPriority: r.suggested_priority as AiAnalysis["suggestedPriority"],
      reason: (r.reason as string) ?? "",
      confidenceBand: (r.confidence_band as AiAnalysis["confidenceBand"]) ?? "Medium",
      needsReview: (r.needs_review as boolean) ?? false,
      safetyNote: (r.safety_note as string) ?? null,
      createdAt: r.created_at as string,
    };
  }

  // ---- Events ------------------------------------------------------------
  async getEvents(issueId: string): Promise<IssueEvent[]> {
    const { data, error } = await this.db.from("issue_events").select("*").eq("issue_id", issueId).order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => this.mapEvent(r as Record<string, unknown>));
  }
  async addEvent(e: Omit<IssueEvent, "id" | "createdAt"> & { createdAt?: string }): Promise<IssueEvent> {
    const { data, error } = await this.write
      .from("issue_events")
      .insert({
        issue_id: e.issueId,
        type: e.type,
        title: e.title,
        description: e.description ?? null,
        actor_id: e.actorId ?? null,
        actor_name: e.actorName,
        meta: e.meta ?? null,
        created_at: e.createdAt ?? new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return this.mapEvent(data as Record<string, unknown>);
  }
  private mapEvent(r: Record<string, unknown>): IssueEvent {
    return {
      id: r.id as string,
      issueId: r.issue_id as string,
      type: r.type as IssueEvent["type"],
      title: r.title as string,
      description: (r.description as string) ?? null,
      actorId: (r.actor_id as string) ?? null,
      actorName: (r.actor_name as string) ?? "System",
      createdAt: r.created_at as string,
      meta: (r.meta as Record<string, unknown>) ?? null,
    };
  }

  // ---- Comments ----------------------------------------------------------
  async getComments(issueId: string): Promise<Comment[]> {
    const { data, error } = await this.db.from("comments").select("*").eq("issue_id", issueId).order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id as string,
      issueId: r.issue_id as string,
      authorName: (r.author_name as string) ?? "Resident",
      authorRole: (r.author_role as string) ?? "resident",
      body: r.body as string,
      createdAt: r.created_at as string,
    }));
  }
  async addComment(c: Omit<Comment, "id" | "createdAt">): Promise<Comment> {
    const { data, error } = await this.write
      .from("comments")
      .insert({ issue_id: c.issueId, author_name: c.authorName, author_role: c.authorRole, body: c.body, created_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return {
      id: data.id as string,
      issueId: data.issue_id as string,
      authorName: (data.author_name as string) ?? "Resident",
      authorRole: (data.author_role as string) ?? "resident",
      body: data.body as string,
      createdAt: data.created_at as string,
    };
  }

  // ---- Work orders -------------------------------------------------------
  async getWorkOrders(): Promise<WorkOrder[]> {
    const { data, error } = await this.db.from("work_orders").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => this.mapWorkOrder(r as Record<string, unknown>));
  }
  async getWorkOrder(id: string): Promise<WorkOrder | null> {
    const { data, error } = await this.db.from("work_orders").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? this.mapWorkOrder(data as Record<string, unknown>) : null;
  }
  async createWorkOrder(input: Omit<WorkOrder, "id" | "createdAt" | "notes" | "acknowledgedAt">): Promise<WorkOrder> {
    const { data, error } = await this.write
      .from("work_orders")
      .insert({
        issue_id: input.issueId,
        title: input.title,
        assigned_to_id: input.assignedToId,
        assigned_to_name: input.assignedToName,
        team_name: input.teamName,
        status: input.status,
        priority: input.priority,
        due_at: input.dueAt,
        created_at: new Date().toISOString(),
        notes: [],
      })
      .select()
      .single();
    if (error) throw error;
    return this.mapWorkOrder(data as Record<string, unknown>);
  }
  async updateWorkOrder(id: string, patch: Partial<WorkOrder>): Promise<WorkOrder> {
    const row: Record<string, unknown> = {};
    if (patch.status) row.status = patch.status;
    if (patch.assignedToId !== undefined) row.assigned_to_id = patch.assignedToId;
    if (patch.assignedToName !== undefined) row.assigned_to_name = patch.assignedToName;
    if (patch.teamName !== undefined) row.team_name = patch.teamName;
    if (patch.dueAt) row.due_at = patch.dueAt;
    const { data, error } = await this.write.from("work_orders").update(row).eq("id", id).select().single();
    if (error) throw error;
    return this.mapWorkOrder(data as Record<string, unknown>);
  }
  async addWorkOrderNote(id: string, note: WorkOrderNoteInput): Promise<WorkOrder> {
    const wo = await this.getWorkOrder(id);
    if (!wo) throw new Error("Work order not found");
    const notes = [...wo.notes, { ...note, id: crypto.randomUUID(), createdAt: new Date().toISOString() }];
    const { data, error } = await this.write.from("work_orders").update({ notes }).eq("id", id).select().single();
    if (error) throw error;
    return this.mapWorkOrder(data as Record<string, unknown>);
  }
  private mapWorkOrder(r: Record<string, unknown>): WorkOrder {
    return {
      id: r.id as string,
      issueId: r.issue_id as string,
      title: (r.title as string) ?? "",
      assignedToId: (r.assigned_to_id as string) ?? null,
      assignedToName: (r.assigned_to_name as string) ?? null,
      teamName: (r.team_name as string) ?? null,
      status: r.status as WorkOrder["status"],
      priority: r.priority as WorkOrder["priority"],
      dueAt: r.due_at as string,
      createdAt: r.created_at as string,
      acknowledgedAt: (r.acknowledged_at as string) ?? null,
      notes: (r.notes as WorkOrder["notes"]) ?? [],
    };
  }

  // ---- Verifications -----------------------------------------------------
  async getVerifications(issueId: string): Promise<Verification[]> {
    const { data, error } = await this.db.from("verifications").select("*").eq("issue_id", issueId).order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id as string,
      issueId: r.issue_id as string,
      verifierId: (r.verifier_id as string) ?? "",
      verifierName: (r.verifier_name as string) ?? "Resident",
      verdict: r.verdict as Verification["verdict"],
      reason: (r.reason as string) ?? null,
      createdAt: r.created_at as string,
    }));
  }
  async addVerification(v: Omit<Verification, "id" | "createdAt">): Promise<Verification> {
    const { data, error } = await this.write
      .from("verifications")
      .insert({ issue_id: v.issueId, verifier_id: v.verifierId, verifier_name: v.verifierName, verdict: v.verdict, reason: v.reason, created_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return {
      id: data.id as string,
      issueId: data.issue_id as string,
      verifierId: (data.verifier_id as string) ?? "",
      verifierName: (data.verifier_name as string) ?? "Resident",
      verdict: data.verdict as Verification["verdict"],
      reason: (data.reason as string) ?? null,
      createdAt: data.created_at as string,
    };
  }

  // ---- Duplicate groups --------------------------------------------------
  async getGroups(): Promise<IssueGroup[]> {
    const { data, error } = await this.db.from("issue_groups").select("*");
    if (error) throw error;
    return (data ?? []).map((r) => this.mapGroup(r as Record<string, unknown>));
  }
  async getGroup(id: string): Promise<IssueGroup | null> {
    const { data, error } = await this.db.from("issue_groups").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? this.mapGroup(data as Record<string, unknown>) : null;
  }
  async createGroup(g: Omit<IssueGroup, "id" | "createdAt">): Promise<IssueGroup> {
    const { data, error } = await this.write
      .from("issue_groups")
      .insert({
        title: g.title,
        representative_issue_id: g.representativeIssueId,
        member_issue_ids: g.memberIssueIds,
        similarity: g.similarity,
        distance_meters: g.distanceMeters,
        status: g.status,
        reason: g.reason,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return this.mapGroup(data as Record<string, unknown>);
  }
  async confirmGroup(id: string, actorId: string): Promise<IssueGroup> {
    const group = await this.getGroup(id);
    if (!group) throw new Error("Group not found");
    const { data, error } = await this.write.from("issue_groups").update({ status: "confirmed" }).eq("id", id).select().single();
    if (error) throw error;
    for (const iid of group.memberIssueIds) {
      await this.addEvent({ issueId: iid, type: "group_confirmed", title: "Duplicate group confirmed", description: `Grouped under “${group.title}”.`, actorId, actorName: "Administrator", meta: { groupId: id } });
    }
    return this.mapGroup(data as Record<string, unknown>);
  }
  private mapGroup(r: Record<string, unknown>): IssueGroup {
    return {
      id: r.id as string,
      title: (r.title as string) ?? "Duplicate group",
      representativeIssueId: (r.representative_issue_id as string) ?? "",
      memberIssueIds: (r.member_issue_ids as string[]) ?? [],
      similarity: (r.similarity as number) ?? 0,
      distanceMeters: (r.distance_meters as number) ?? 0,
      status: r.status as IssueGroup["status"],
      reason: (r.reason as string) ?? "",
      createdAt: r.created_at as string,
    };
  }

  // ---- Notifications -----------------------------------------------------
  async getNotifications(userId: string | null): Promise<Notification[]> {
    let q = this.db.from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
    if (userId) q = q.or(`user_id.eq.${userId},user_id.is.null`);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id as string,
      userId: (r.user_id as string) ?? null,
      title: r.title as string,
      body: (r.body as string) ?? "",
      kind: r.kind as Notification["kind"],
      read: (r.read as boolean) ?? false,
      linkHref: (r.link_href as string) ?? null,
      createdAt: r.created_at as string,
    }));
  }
  async markNotificationRead(id: string): Promise<void> {
    const { error } = await this.write.from("notifications").update({ read: true }).eq("id", id);
    if (error) throw error;
  }
  async markAllNotificationsRead(userId: string | null): Promise<void> {
    let q = this.write.from("notifications").update({ read: true });
    q = userId ? q.eq("user_id", userId) : q.is("user_id", null);
    const { error } = await q;
    if (error) throw error;
  }
  async createNotification(n: Omit<Notification, "id" | "createdAt" | "read">): Promise<Notification> {
    const { data, error } = await this.write
      .from("notifications")
      .insert({ user_id: n.userId, title: n.title, body: n.body, kind: n.kind, link_href: n.linkHref ?? null, read: false, created_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return {
      id: data.id as string,
      userId: (data.user_id as string) ?? null,
      title: data.title as string,
      body: (data.body as string) ?? "",
      kind: data.kind as Notification["kind"],
      read: false,
      linkHref: (data.link_href as string) ?? null,
      createdAt: data.created_at as string,
    };
  }
}
