// ---------------------------------------------------------------------------
// FixLoop seed dataset
//
// Everything is generated relative to "now" so SLA, overdue, breach, age and
// time-series logic stay truthful whenever the app boots. All records are
// flagged isDemoData = true and surfaced in the UI as sample data.
//
// The dataset is deliberately constructed so that live dashboard queries return
// a meaningful, non-fabricated result:
//   • exactly 2 overdue issues
//   • exactly 3 unassigned high-priority issues
//   • exactly 1 issue approaching its SLA breach
//   • a confirmed duplicate cluster of 3 sanitation reports
//   • resolved / verified / reopened issues to exercise verification flows
//   • ~18 historical records so period-over-period comparisons and the
//     "reports over time" chart are computed from real rows, not invented.
// ---------------------------------------------------------------------------

import type {
  AiAnalysis,
  ConfidenceBand,
  Issue,
  IssueCategory,
  IssueEvent,
  IssueGroup,
  IssueMedia,
  IssuePriority,
  IssueStatus,
  Notification,
  Profile,
  Team,
  Verification,
  WorkOrder,
  WorkOrderNote,
} from "@/lib/types";

export interface Comment {
  id: string;
  issueId: string;
  authorName: string;
  authorRole: string;
  body: string;
  createdAt: string;
}

export interface SeedData {
  profiles: Profile[];
  teams: Team[];
  issues: Issue[];
  issueMedia: IssueMedia[];
  aiAnalyses: AiAnalysis[];
  issueEvents: IssueEvent[];
  comments: Comment[];
  workOrders: WorkOrder[];
  verifications: Verification[];
  issueGroups: IssueGroup[];
  notifications: Notification[];
}

export const CATEGORY_THUMBNAIL: Record<IssueCategory, string> = {
  Sanitation: "/demo/sanitation.svg",
  "Water Leakage": "/demo/water.svg",
  Roads: "/demo/roads.svg",
  "Street Lighting": "/demo/lighting.svg",
  Drainage: "/demo/drainage.svg",
  Footpath: "/demo/footpath.svg",
  "Public Infrastructure": "/demo/infrastructure.svg",
  "Waste Management": "/demo/waste.svg",
};

export const CATEGORY_THUMBNAIL_AFTER: Record<IssueCategory, string> = {
  Sanitation: "/demo/sanitation-after.svg",
  "Water Leakage": "/demo/water-after.svg",
  Roads: "/demo/roads-after.svg",
  "Street Lighting": "/demo/lighting-after.svg",
  Drainage: "/demo/drainage-after.svg",
  Footpath: "/demo/footpath-after.svg",
  "Public Infrastructure": "/demo/infrastructure-after.svg",
  "Waste Management": "/demo/waste-after.svg",
};

// Sample neighbourhood centre (New Delhi / India Gate area) with consistent
// nearby coordinates so map clustering and duplicate distance checks behave.
const CENTER = { lat: 28.6139, lng: 77.209 };

let idc = 0;
function nid(prefix: string) {
  idc += 1;
  return `${prefix}_${String(idc).padStart(4, "0")}`;
}
function resetIds() {
  idc = 0;
}

const H = 3600_000;
const D = 24 * H;

function iso(nowMs: number, msAgo: number) {
  return new Date(nowMs - msAgo).toISOString();
}
function publicId(seq: number) {
  return `FX-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`;
}

interface RecentSpec {
  seq: number;
  title: string;
  description: string;
  category: IssueCategory;
  priority: IssuePriority;
  status: IssueStatus;
  address: string;
  area: string;
  lat: number;
  lng: number;
  createdH: number;
  reporter: string;
  assignee?: string;
  team?: string;
  assignedH?: number;
  resolvedH?: number;
  verifiedH?: number;
  resolutionNote?: string;
  aiCategory?: IssueCategory;
  aiPriority?: IssuePriority;
  aiConfidence?: ConfidenceBand;
  aiNeedsReview?: boolean;
  safetyNote?: string | null;
}

export function buildSeed(nowMs: number = Date.now()): SeedData {
  resetIds();

  // ---- People ------------------------------------------------------------
  const profiles: Profile[] = [
    mkProfile("p_admin", "Sarah Khan", "sarah.khan@fixloop.gov", "administrator", nowMs - 90 * D),
    mkProfile("p_s1", "Mike Torres", "mike.torres@fixloop.gov", "field_staff", nowMs - 80 * D, "t_san"),
    mkProfile("p_s2", "Dana Liu", "dana.liu@fixloop.gov", "field_staff", nowMs - 80 * D, "t_pub"),
    mkProfile("p_s3", "Omar Reyes", "omar.reyes@fixloop.gov", "field_staff", nowMs - 75 * D, "t_wat"),
    mkProfile("p_s4", "Priya Nair", "priya.nair@fixloop.gov", "field_staff", nowMs - 70 * D, "t_lit"),
    mkProfile("p_r1", "Aisha Patel", "aisha.patel@mail.com", "resident", nowMs - 40 * D),
    mkProfile("p_r2", "John Rivera", "john.rivera@mail.com", "resident", nowMs - 35 * D),
    mkProfile("p_r3", "Emily Chen", "emily.chen@mail.com", "resident", nowMs - 30 * D),
    mkProfile("p_r4", "David Okafor", "david.okafor@mail.com", "resident", nowMs - 22 * D),
    mkProfile("p_r5", "Maria Garcia", "maria.garcia@mail.com", "resident", nowMs - 15 * D),
  ];
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.fullName ?? "System";

  const teams: Team[] = [
    { id: "t_san", name: "Sanitation Crew", specialty: "Waste collection & cleaning", memberCount: 4, leadName: "Mike Torres" },
    { id: "t_pub", name: "Public Works", specialty: "Roads, footpaths & structures", memberCount: 6, leadName: "Dana Liu" },
    { id: "t_wat", name: "Water & Drainage", specialty: "Supply lines & stormwater", memberCount: 5, leadName: "Omar Reyes" },
    { id: "t_lit", name: "Electrical & Lighting", specialty: "Streetlights & power", memberCount: 3, leadName: "Priya Nair" },
  ];

  // ---- Recent issues (0–40h) --------------------------------------------
  const recent: RecentSpec[] = [
    // Duplicate sanitation cluster on Main Street (3 reports, same location family)
    { seq: 1, title: "Garbage accumulation near Main Street market", description: "Large pile of uncollected garbage has built up beside the market entrance. Smell is strong and it is blocking part of the walkway.", category: "Sanitation", priority: "Medium", status: "submitted", address: "Main St & 1st Ave", area: "Market Quarter", lat: 28.6147, lng: 77.2094, createdH: 5, reporter: "p_r1", aiCategory: "Sanitation", aiPriority: "Medium", aiConfidence: "High" },
    { seq: 2, title: "Uncollected waste bags piling up — Main St", description: "Several black waste bags left uncollected near the corner shop since this morning.", category: "Sanitation", priority: "Medium", status: "submitted", address: "Main St & 2nd Ave", area: "Market Quarter", lat: 28.6144, lng: 77.2091, createdH: 4, reporter: "p_r2", aiCategory: "Sanitation", aiPriority: "Medium", aiConfidence: "Medium" },
    { seq: 3, title: "Garbage bins overflowing on Main Street", description: "The public bins are overflowing and litter is scattering across the pavement.", category: "Sanitation", priority: "Medium", status: "under_review", address: "Main St & 1st Ave", area: "Market Quarter", lat: 28.6148, lng: 77.2096, createdH: 3, reporter: "p_r3", aiCategory: "Waste Management", aiPriority: "Medium", aiConfidence: "Medium", aiNeedsReview: true },

    // The two OVERDUE issues
    { seq: 4, title: "Blocked drainage culvert behind Block B", description: "Storm drain is completely blocked with silt and plastic. Water is backing up toward the residential entrance after every rain.", category: "Drainage", priority: "Critical", status: "in_progress", address: "Behind Residential Block B", area: "North Block", lat: 28.6126, lng: 77.2076, createdH: 30, reporter: "p_r4", assignee: "p_s3", team: "Water & Drainage", assignedH: 28, aiCategory: "Drainage", aiPriority: "Critical", aiConfidence: "High", safetyNote: "Standing water near electrical points — treat with caution." },
    { seq: 5, title: "Damaged footpath slab — Market Quarter", description: "A raised and cracked slab creates a trip hazard right on the busy market footpath.", category: "Footpath", priority: "High", status: "in_progress", address: "Market Quarter footpath", area: "Market Quarter", lat: 28.6152, lng: 77.2085, createdH: 40, reporter: "p_r5", assignee: "p_s2", team: "Public Works", assignedH: 36, aiCategory: "Footpath", aiPriority: "High", aiConfidence: "High" },

    // The one APPROACHING SLA breach
    { seq: 6, title: "Water leakage at Block B tap line", description: "A joint has failed on the tap line and clean water is spraying out onto the path.", category: "Water Leakage", priority: "High", status: "in_progress", address: "Block B water tap line", area: "North Block", lat: 28.613, lng: 77.208, createdH: 20, reporter: "p_r1", assignee: "p_s3", team: "Water & Drainage", assignedH: 18, aiCategory: "Water Leakage", aiPriority: "High", aiConfidence: "High", safetyNote: "Risk of slippery surface." },

    // The three UNASSIGNED high-priority issues
    { seq: 7, title: "Pothole near the main entrance gate", description: "Deep pothole formed where the tarmac has given way. Vehicles are swerving to avoid it.", category: "Roads", priority: "High", status: "submitted", address: "Main entrance gate", area: "Central District", lat: 28.6156, lng: 77.2111, createdH: 6, reporter: "p_r4", aiCategory: "Roads", aiPriority: "High", aiConfidence: "High" },
    { seq: 8, title: "Broken streetlight near the parking area", description: "The lamp post has been hit and the light is out, leaving the corner dark at night.", category: "Street Lighting", priority: "High", status: "submitted", address: "Parking area, east corner", area: "Parking Zone", lat: 28.6119, lng: 77.2116, createdH: 4, reporter: "p_r5", aiCategory: "Street Lighting", aiPriority: "Medium", aiConfidence: "Medium", aiNeedsReview: true, safetyNote: "Reduced visibility after dark." },
    { seq: 9, title: "Damaged public sign at crosswalk", description: "The pedestrian crossing sign has been bent flat and is no longer visible to drivers.", category: "Public Infrastructure", priority: "High", status: "submitted", address: "Crosswalk, Elm St", area: "Central District", lat: 28.6149, lng: 77.2128, createdH: 8, reporter: "p_r2", aiCategory: "Public Infrastructure", aiPriority: "High", aiConfidence: "Medium" },

    // Remaining recent issues for volume / analytics
    { seq: 10, title: "Overflowing dustbin near the cafeteria", description: "The bin outside the cafeteria is full and people are leaving bags next to it.", category: "Waste Management", priority: "Medium", status: "in_progress", address: "Cafeteria rear yard", area: "Central District", lat: 28.6136, lng: 77.2121, createdH: 10, reporter: "p_r3", assignee: "p_s1", team: "Sanitation Crew", assignedH: 9, aiCategory: "Waste Management", aiPriority: "Medium", aiConfidence: "High" },
    { seq: 11, title: "Streetlight flickering on Elm Street", description: "The light flickers constantly through the evening.", category: "Street Lighting", priority: "Low", status: "in_progress", address: "Elm St, near library", area: "Central District", lat: 28.6159, lng: 77.2074, createdH: 26, reporter: "p_r1", assignee: "p_s4", team: "Electrical & Lighting", assignedH: 24, aiCategory: "Street Lighting", aiPriority: "Low", aiConfidence: "Medium" },
    { seq: 12, title: "Broken public bench in Central Park", description: "One bench has a collapsed slat and exposed screws.", category: "Public Infrastructure", priority: "Medium", status: "assigned", address: "Central Park path", area: "Riverside", lat: 28.6143, lng: 77.2064, createdH: 14, reporter: "p_r5", assignee: "p_s2", team: "Public Works", assignedH: 12, aiCategory: "Public Infrastructure", aiPriority: "Medium", aiConfidence: "High" },
    { seq: 13, title: "Water logging near the underpass", description: "Rain water collects at the underpass and takes hours to drain.", category: "Drainage", priority: "High", status: "in_progress", address: "Underpass near Riverside", area: "Riverside", lat: 28.6134, lng: 77.2058, createdH: 16, reporter: "p_r4", assignee: "p_s3", team: "Water & Drainage", assignedH: 15, aiCategory: "Drainage", aiPriority: "High", aiConfidence: "Medium" },
    { seq: 14, title: "Cracked road surface — Market Street", description: "Long cracks running along the lane, worsening near the drain covers.", category: "Roads", priority: "Medium", status: "under_review", address: "Market Street lane", area: "Market Quarter", lat: 28.6132, lng: 77.2104, createdH: 20, reporter: "p_r2", aiCategory: "Roads", aiPriority: "Medium", aiConfidence: "Medium" },
    { seq: 15, title: "Graffiti on the community wall", description: "Large spray-paint tagging across the community centre wall.", category: "Public Infrastructure", priority: "Low", status: "submitted", address: "Community centre wall", area: "Riverside", lat: 28.6125, lng: 77.2067, createdH: 30, reporter: "p_r3", aiCategory: "Public Infrastructure", aiPriority: "Low", aiConfidence: "High" },
    { seq: 16, title: "Leaking pipe near the overhead tank", description: "Water is dripping steadily from a joint near the tank base.", category: "Water Leakage", priority: "Critical", status: "in_progress", address: "Overhead tank base", area: "North Block", lat: 28.6123, lng: 77.2082, createdH: 2, reporter: "p_r1", assignee: "p_s3", team: "Water & Drainage", assignedH: 1, aiCategory: "Water Leakage", aiPriority: "Critical", aiConfidence: "High", safetyNote: "Electrical panel nearby." },
    { seq: 17, title: "Overflowing community dustbin — Riverside", description: "The bin by the riverside path was overflowing.", category: "Waste Management", priority: "Medium", status: "resolved_pending_verification", address: "Riverside path bin", area: "Riverside", lat: 28.614, lng: 77.2055, createdH: 40, reporter: "p_r5", assignee: "p_s1", team: "Sanitation Crew", assignedH: 30, resolvedH: 6, aiCategory: "Waste Management", aiPriority: "Medium", aiConfidence: "High", resolutionNote: "Bin emptied and an additional collection was scheduled for this spot. Area swept clean." },
    { seq: 18, title: "Pothole repaired on the service road", description: "A pothole had opened up on the service road.", category: "Roads", priority: "Medium", status: "verified_resolved", address: "Service road, north gate", area: "Central District", lat: 28.6154, lng: 77.2102, createdH: 70, reporter: "p_r4", assignee: "p_s2", team: "Public Works", assignedH: 60, resolvedH: 30, verifiedH: 24, aiCategory: "Roads", aiPriority: "Medium", aiConfidence: "High", resolutionNote: "Pothole cleaned, filled and compacted. Road reopened." },
    { seq: 19, title: "Streetlight replaced in the parking lot", description: "The lamp had failed entirely.", category: "Street Lighting", priority: "Medium", status: "verified_resolved", address: "Parking lot row 2", area: "Parking Zone", lat: 28.6117, lng: 77.2119, createdH: 90, reporter: "p_r5", assignee: "p_s4", team: "Electrical & Lighting", assignedH: 80, resolvedH: 44, verifiedH: 38, aiCategory: "Street Lighting", aiPriority: "Medium", aiConfidence: "High", resolutionNote: "Failed LED module and driver replaced. Light tested working." },
    { seq: 20, title: "Blocked storm drain reopened", description: "The drain grate was completely blocked with leaves and silt.", category: "Drainage", priority: "High", status: "verified_resolved", address: "Storm drain, Riverside", area: "Riverside", lat: 28.6138, lng: 77.2061, createdH: 100, reporter: "p_r1", assignee: "p_s3", team: "Water & Drainage", assignedH: 92, resolvedH: 54, verifiedH: 50, aiCategory: "Drainage", aiPriority: "High", aiConfidence: "High", resolutionNote: "Grate cleared, silt removed and flow tested free." },
    { seq: 21, title: "Garbage not cleared after claimed cleanup", description: "Residents report waste is still present after the cleanup was marked done.", category: "Sanitation", priority: "High", status: "reopened", address: "Main St side lane", area: "Market Quarter", lat: 28.6146, lng: 77.2089, createdH: 12, reporter: "p_r3", assignee: "p_s1", team: "Sanitation Crew", assignedH: 10, aiCategory: "Sanitation", aiPriority: "High", aiConfidence: "Medium", resolutionNote: "First pass completed." },
    { seq: 22, title: "Footpath tile replacement — library approach", description: "Several tiles are loose or missing on the library approach.", category: "Footpath", priority: "Low", status: "assigned", address: "Library approach path", area: "Central District", lat: 28.6161, lng: 77.2077, createdH: 22, reporter: "p_r2", assignee: "p_s2", team: "Public Works", assignedH: 20, aiCategory: "Footpath", aiPriority: "Low", aiConfidence: "Medium" },
    { seq: 23, title: "Damaged playground swing", description: "A swing seat is cracked and its chain is loose.", category: "Public Infrastructure", priority: "Medium", status: "submitted", address: "Children's playground", area: "Riverside", lat: 28.6129, lng: 77.2062, createdH: 12, reporter: "p_r4", aiCategory: "Public Infrastructure", aiPriority: "Medium", aiConfidence: "Medium", safetyNote: "Risk to children." },
    { seq: 24, title: "Leaking drinking fountain", description: "The fountain does not shut off fully and constantly dribbles.", category: "Water Leakage", priority: "Low", status: "under_review", address: "Park drinking fountain", area: "Riverside", lat: 28.6136, lng: 77.2069, createdH: 28, reporter: "p_r5", assignee: "p_s3", team: "Water & Drainage", assignedH: 26, aiCategory: "Water Leakage", aiPriority: "Low", aiConfidence: "Medium" },
    { seq: 25, title: "Clogged drain grate — cafeteria", description: "The grate outside the cafeteria is packed with food waste.", category: "Drainage", priority: "Medium", status: "in_progress", address: "Cafeteria front drain", area: "Central District", lat: 28.6134, lng: 77.2118, createdH: 16, reporter: "p_r3", assignee: "p_s3", team: "Water & Drainage", assignedH: 14, aiCategory: "Drainage", aiPriority: "Medium", aiConfidence: "High" },
    { seq: 26, title: "Road sign blown down after high winds", description: "A directional road sign has toppled and is lying across the verge.", category: "Public Infrastructure", priority: "High", status: "in_progress", address: "Verge near north gate", area: "Central District", lat: 28.6157, lng: 77.2106, createdH: 9, reporter: "p_r1", assignee: "p_s2", team: "Public Works", assignedH: 7, aiCategory: "Public Infrastructure", aiPriority: "High", aiConfidence: "High" },
  ];

  const issues: Issue[] = [];
  const issueMedia: IssueMedia[] = [];
  const aiAnalyses: AiAnalysis[] = [];
  const issueEvents: IssueEvent[] = [];
  const comments: Comment[] = [];
  const workOrders: WorkOrder[] = [];
  const verifications: Verification[] = [];

  for (const spec of recent) {
    createIssueFromSpec(spec, nowMs, { issues, issueMedia, aiAnalyses, issueEvents, comments, workOrders, verifications }, nameOf);
  }

  // ---- Historical issues (days 2–16) for honest period comparisons --------
  const histSpecs = generateHistorical(nowMs, profiles, nameOf);
  for (const spec of histSpecs) {
    createIssueFromSpec(spec, nowMs, { issues, issueMedia, aiAnalyses, issueEvents, comments, workOrders, verifications }, nameOf);
  }

  // ---- Duplicate group (confirmed) for the 3 sanitation reports ----------
  const dupIds = ["iss_" + String(1).padStart(4, "0"), "iss_" + String(2).padStart(4, "0"), "iss_" + String(3).padStart(4, "0")];
  const issueGroups: IssueGroup[] = [
    {
      id: "grp_0001",
      title: "Garbage accumulation — Main Street market",
      representativeIssueId: dupIds[0],
      memberIssueIds: dupIds,
      similarity: 0.82,
      distanceMeters: 46,
      status: "confirmed",
      reason:
        "Same category (Sanitation), descriptions share the terms “garbage / waste / bins”, and all three reports are within 46 m of each other, reported within 2 hours.",
      createdAt: iso(nowMs, 2 * H),
    },
  ];
  // Link the duplicate event to each member.
  for (const id of dupIds) {
    issueEvents.push({
      id: nid("evt"),
      issueId: id,
      type: "duplicate_linked",
      title: "Linked to duplicate group",
      description: "Automatically matched with other reports of the same garbage accumulation.",
      actorId: null,
      actorName: "FixLoop AI",
      createdAt: iso(nowMs, 2 * H),
      meta: { groupId: "grp_0001" },
    });
  }

  // ---- Notifications -----------------------------------------------------
  const notifications: Notification[] = [
    { id: nid("ntf"), userId: "p_admin", title: "2 issues are overdue", body: "Blocked drainage culvert and damaged footpath have passed their SLA targets.", kind: "alert", read: false, linkHref: "/alerts", createdAt: iso(nowMs, 0.2 * H) },
    { id: nid("ntf"), userId: "p_admin", title: "3 unassigned high-priority reports", body: "New high-priority reports are waiting for an owner.", kind: "alert", read: false, linkHref: "/alerts", createdAt: iso(nowMs, 0.6 * H) },
    { id: nid("ntf"), userId: "p_admin", title: "Resolution awaiting verification", body: "Overflowing community dustbin is ready for community confirmation.", kind: "verification", read: false, linkHref: "/issues/iss_0017", createdAt: iso(nowMs, 6 * H) },
    { id: nid("ntf"), userId: "p_s3", title: "New assignment", body: "You were assigned “Water leakage at Block B tap line”.", kind: "assignment", read: false, linkHref: "/issues/iss_0006", createdAt: iso(nowMs, 18 * H) },
    { id: nid("ntf"), userId: null, title: "Duplicate cluster confirmed", body: "3 sanitation reports on Main Street were grouped.", kind: "system", read: true, linkHref: "/map", createdAt: iso(nowMs, 2 * H) },
  ];

  return { profiles, teams, issues, issueMedia, aiAnalyses, issueEvents, comments, workOrders, verifications, issueGroups, notifications };
}

// ---------------------------------------------------------------------------

interface Sink {
  issues: Issue[];
  issueMedia: IssueMedia[];
  aiAnalyses: AiAnalysis[];
  issueEvents: IssueEvent[];
  comments: Comment[];
  workOrders: WorkOrder[];
  verifications: Verification[];
}

function mkProfile(
  id: string,
  fullName: string,
  email: string,
  role: Profile["role"],
  createdMs: number,
  teamId?: string
): Profile {
  return {
    id,
    fullName,
    email,
    role,
    teamId: teamId ?? null,
    avatarColor: "",
    phone: null,
    createdAt: new Date(createdMs).toISOString(),
    isActive: true,
  };
}

function createIssueFromSpec(
  spec: RecentSpec,
  nowMs: number,
  sink: Sink,
  nameOf: (id: string) => string
) {
  const id = `iss_${String(spec.seq).padStart(4, "0")}`;
  const createdAt = iso(nowMs, spec.createdH * H);
  const assignedAt = spec.assignedH != null ? iso(nowMs, spec.assignedH * H) : null;
  const resolvedAt = spec.resolvedH != null ? iso(nowMs, spec.resolvedH * H) : null;
  const verifiedAt = spec.verifiedH != null ? iso(nowMs, spec.verifiedH * H) : null;
  const slaHours = spec.priority === "Critical" ? 6 : spec.priority === "High" ? 24 : spec.priority === "Medium" ? 48 : 96;

  const issue: Issue = {
    id,
    publicId: publicId(spec.seq),
    title: spec.title,
    description: spec.description,
    category: spec.category,
    priority: spec.priority,
    status: spec.status,
    location: { address: spec.address, area: spec.area, coordinates: { lat: spec.lat, lng: spec.lng } },
    reporterId: spec.reporter,
    reporterName: nameOf(spec.reporter),
    assignedToId: spec.assignee ?? null,
    assignedToName: spec.assignee ? nameOf(spec.assignee) : null,
    teamName: spec.team ?? null,
    createdAt,
    updatedAt: verifiedAt ?? resolvedAt ?? assignedAt ?? createdAt,
    assignedAt,
    slaHours,
    resolutionNote: spec.resolutionNote ?? null,
    resolvedAt,
    isDemoData: true,
    commentCount: 0,
    mediaCount: 0,
    relatedCount: 0,
  };

  // Media (before + optional after/evidence)
  sink.issueMedia.push({
    id: nid("med"),
    issueId: id,
    url: CATEGORY_THUMBNAIL[spec.category],
    kind: "before",
    isEvidence: false,
    caption: "As reported",
    uploadedAt: createdAt,
  });
  issue.mediaCount += 1;
  if (resolvedAt && spec.resolutionNote) {
    sink.issueMedia.push({
      id: nid("med"),
      issueId: id,
      url: CATEGORY_THUMBNAIL_AFTER[spec.category],
      kind: "after",
      isEvidence: true,
      caption: "After resolution",
      uploadedAt: resolvedAt,
    });
    issue.mediaCount += 1;
  }

  // AI analysis (stored separately from human-confirmed values)
  const ai: AiAnalysis = {
    id: nid("ai"),
    issueId: id,
    model: "gemini-1.5-flash",
    suggestedCategory: spec.aiCategory ?? spec.category,
    summary: summarise(spec.description),
    suggestedPriority: spec.aiPriority ?? spec.priority,
    reason: `Based on the reported description and image, the report best matches ${spec.aiCategory ?? spec.category} and a ${spec.aiPriority ?? spec.priority} priority.`,
    confidenceBand: spec.aiConfidence ?? "Medium",
    needsReview: spec.aiNeedsReview ?? false,
    safetyNote: spec.safetyNote ?? null,
    createdAt: iso(nowMs, spec.createdH * H - 0.02 * H),
  };
  sink.aiAnalyses.push(ai);

  // Events
  sink.issueEvents.push({ id: nid("evt"), issueId: id, type: "created", title: "Report submitted", description: `${issue.reporterName} submitted the report.`, actorId: spec.reporter, actorName: issue.reporterName, createdAt });
  sink.issueEvents.push({ id: nid("evt"), issueId: id, type: "ai_analyzed", title: "AI analysis completed", description: `Suggested ${ai.suggestedCategory} · ${ai.suggestedPriority} · ${ai.confidenceBand} confidence${ai.needsReview ? " · needs review" : ""}.`, actorId: null, actorName: "FixLoop AI", createdAt: ai.createdAt });
  if (spec.status !== "submitted" && spec.status !== "under_review") {
    sink.issueEvents.push({ id: nid("evt"), issueId: id, type: "status_changed", title: "Moved to review", description: "An administrator triaged the report.", actorId: "p_admin", actorName: nameOf("p_admin"), createdAt: iso(nowMs, Math.max(0.05, spec.createdH - (spec.assignedH ?? spec.createdH) - 0.05) * H) });
  }
  if (assignedAt && spec.assignee) {
    sink.issueEvents.push({ id: nid("evt"), issueId: id, type: "assigned", title: `Assigned to ${nameOf(spec.assignee)}`, description: `Routed to ${spec.team ?? "field team"}.`, actorId: "p_admin", actorName: nameOf("p_admin"), createdAt: assignedAt });
    sink.issueEvents.push({ id: nid("evt"), issueId: id, type: "status_changed", title: "Work started", description: "Field staff began work.", actorId: spec.assignee, actorName: nameOf(spec.assignee), createdAt: iso(nowMs, Math.max(0, (spec.assignedH ?? 0) - 0.5) * H) });
  }
  if (resolvedAt && spec.resolutionNote) {
    sink.issueEvents.push({ id: nid("evt"), issueId: id, type: "evidence_added", title: "Resolution evidence uploaded", description: "After-photos attached.", actorId: spec.assignee ?? null, actorName: spec.assignee ? nameOf(spec.assignee) : "Field Staff", createdAt: resolvedAt });
    sink.issueEvents.push({ id: nid("evt"), issueId: id, type: "status_changed", title: "Marked resolved — pending verification", description: spec.resolutionNote, actorId: spec.assignee ?? null, actorName: spec.assignee ? nameOf(spec.assignee) : "Field Staff", createdAt: resolvedAt });
  }
  if (verifiedAt) {
    sink.issueEvents.push({ id: nid("evt"), issueId: id, type: "verification_submitted", title: "Community confirmed resolved", description: "The reporter verified the fix.", actorId: spec.reporter, actorName: issue.reporterName, createdAt: verifiedAt });
    sink.verifications.push({ id: nid("ver"), issueId: id, verifierId: spec.reporter, verifierName: issue.reporterName, verdict: "confirm_resolved", reason: "Confirmed fixed — thank you!", createdAt: verifiedAt });
  }
  if (spec.status === "reopened") {
    sink.issueEvents.push({ id: nid("evt"), issueId: id, type: "reopened", title: "Reopened by community", description: "Residents disputed the resolution.", actorId: spec.reporter, actorName: issue.reporterName, createdAt: iso(nowMs, 6 * H) });
  }

  // Work order for assigned work
  if (spec.assignee) {
    const wstatus: WorkOrder["status"] =
      spec.status === "verified_resolved" ? "completed"
        : spec.status === "resolved_pending_verification" ? "submitted_for_verification"
          : spec.status === "in_progress" ? "in_progress"
            : "acknowledged";
    const notes: WorkOrderNote[] = spec.resolutionNote
      ? [{ id: nid("note"), authorName: nameOf(spec.assignee), body: spec.resolutionNote, createdAt: resolvedAt ?? assignedAt ?? createdAt }]
      : [];
    sink.workOrders.push({
      id: nid("wo"),
      issueId: id,
      title: spec.title,
      assignedToId: spec.assignee,
      assignedToName: nameOf(spec.assignee),
      teamName: spec.team ?? null,
      status: wstatus,
      priority: spec.priority,
      dueAt: new Date(new Date(createdAt).getTime() + slaHours * H).toISOString(),
      createdAt: assignedAt ?? createdAt,
      acknowledgedAt: assignedAt,
      notes,
    });
  }

  // A few sample comments
  if ([1, 4, 6, 17, 21].includes(spec.seq)) {
    const body =
      spec.seq === 21
        ? "This was reported as fixed but waste is still here. Please re-open."
        : spec.seq === 17
          ? "Thanks for the quick response — the bin looks much better now."
          : "Also noticed this today, adding my report so it gets seen.";
    sink.comments.push({ id: nid("cmt"), issueId: id, authorName: nameOf(spec.reporter), authorRole: "Resident", body, createdAt: iso(nowMs, Math.max(0.2, spec.createdH - 1) * H) });
    issue.commentCount += 1;
  }

  sink.issues.push(issue);
}

function summarise(desc: string): string {
  const first = desc.split(/[.!?]/)[0]?.trim();
  if (!first) return "Reported issue.";
  return first.length > 120 ? first.slice(0, 117) + "…" : first + ".";
}

function generateHistorical(nowMs: number, profiles: Profile[], nameOf: (id: string) => string): RecentSpec[] {
  const pool: Array<Pick<RecentSpec, "category" | "title" | "description" | "address" | "area" | "lat" | "lng">> = [
    { category: "Roads", title: "Minor road cracking near the roundabout", description: "Hairline cracks spreading across the lane.", address: "Roundabout, north approach", area: "North Block", lat: 28.6165, lng: 77.2088 },
    { category: "Sanitation", title: "Litter along the riverside walk", description: "Cups and packets scattered along the walking path.", address: "Riverside walk", area: "Riverside", lat: 28.6142, lng: 77.2052 },
    { category: "Street Lighting", title: "Faint streetlight near the crossing", description: "Light is too dim to illuminate the crossing.", area: "Central District", address: "Pedestrian crossing", lat: 28.6151, lng: 77.2125 },
    { category: "Water Leakage", title: "Slow leak at a garden tap", description: "Tap drips continuously onto the soil.", area: "Riverside", address: "Community garden tap", lat: 28.6131, lng: 77.206 },
    { category: "Drainage", title: "Leaves blocking a drain", description: "Drainage grate covered in fallen leaves.", area: "Central District", address: "Drake lane drain", lat: 28.6137, lng: 77.2113 },
    { category: "Footpath", title: "Uneven paving near the bus stop", description: "Paving slabs have settled unevenly.", area: "Market Quarter", address: "Bus stop, Market St", lat: 28.6133, lng: 77.2101 },
    { category: "Public Infrastructure", title: "Damaged notice board", description: "The glass on the community notice board is cracked.", area: "Central District", address: "Community notice board", lat: 28.6145, lng: 77.2079 },
    { category: "Waste Management", title: "Recycling bin lid broken", description: "The recycling bin lid will not close.", area: "Parking Zone", address: "Parking recycling point", lat: 28.6121, lng: 77.2114 },
    { category: "Roads", title: "Loose manhole cover", description: "Manhole cover rattles when cars pass.", area: "Market Quarter", address: "Market St manhole", lat: 28.6129, lng: 77.2107 },
    { category: "Sanitation", title: "Dog waste bin not emptied", description: "The pet waste bin is full to the brim.", area: "Riverside", address: "Riverside pet bin", lat: 28.6144, lng: 77.2059 },
    { category: "Street Lighting", title: "Hanging cable near the sub-station", description: "A low-hanging cable drooped after the storm.", area: "North Block", address: "Sub-station lane", lat: 28.6127, lng: 77.2084 },
    { category: "Drainage", title: "Blocked gully in the car park", description: "Gully standing full of stagnant water.", area: "Parking Zone", address: "Car park gully", lat: 28.6118, lng: 77.2117 },
  ];

  const staffByCat: Record<string, { assignee: string; team: string }> = {
    Roads: { assignee: "p_s2", team: "Public Works" },
    Footpath: { assignee: "p_s2", team: "Public Works" },
    Sanitation: { assignee: "p_s1", team: "Sanitation Crew" },
    "Waste Management": { assignee: "p_s1", team: "Sanitation Crew" },
    Drainage: { assignee: "p_s3", team: "Water & Drainage" },
    "Water Leakage": { assignee: "p_s3", team: "Water & Drainage" },
    "Street Lighting": { assignee: "p_s4", team: "Electrical & Lighting" },
    "Public Infrastructure": { assignee: "p_s2", team: "Public Works" },
  };
  const reporters = ["p_r1", "p_r2", "p_r3", "p_r4", "p_r5"];
  const priorities: IssuePriority[] = ["Medium", "Low", "High", "Medium", "Low", "High"];

  const specs: RecentSpec[] = [];
  let seq = 100;
  // Days 2..16, ~1–2 issues per day. All end resolved/verified to feed
  // resolution metrics + verified counts + the time-series chart.
  for (let day = 2; day <= 16; day++) {
    const perDay = day % 3 === 0 ? 2 : 1;
    for (let k = 0; k < perDay; k++) {
      const base = pool[(day * 2 + k) % pool.length];
      const staff = staffByCat[base.category];
      const priority = priorities[(day + k) % priorities.length];
      const createdH = day * 24 + (k === 0 ? 4 : 14);
      const assignedH = createdH - 3 - k;
      const resolvedH = Math.max(1, createdH - 20 - k * 4);
      const verifiedH = Math.max(0.5, resolvedH - 4);
      seq += 1;
      specs.push({
        seq,
        title: base.title,
        description: base.description,
        category: base.category,
        priority,
        status: day % 4 === 0 && k === 0 ? "verified_resolved" : "verified_resolved",
        address: base.address,
        area: base.area,
        lat: base.lat,
        lng: base.lng,
        createdH,
        reporter: reporters[(day + k) % reporters.length],
        assignee: staff.assignee,
        team: staff.team,
        assignedH,
        resolvedH,
        verifiedH,
        resolutionNote: "Carried out during scheduled maintenance round and verified.",
        aiCategory: base.category,
        aiPriority: priority,
        aiConfidence: "High",
      });
    }
  }
  return specs;
}
