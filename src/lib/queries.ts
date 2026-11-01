// ---------------------------------------------------------------------------
// Query helpers — compose the DataStore with the pure selectors so pages stay
// thin and consistent. All functions are async and server-side.
// ---------------------------------------------------------------------------

import { getStore } from "@/lib/db/store";
import {
  computeAttention,
  computeCategoryDistribution,
  computeHotspots,
  computeMetrics,
  computeRecurring,
  computeStatusDistribution,
  computeTimeSeries,
} from "@/lib/db/selectors";
import { toMapIssue } from "@/lib/map-issue";
import type { MapIssue } from "@/lib/map-issue";
import type { Issue, IssueMedia, Profile } from "@/lib/types";
import { CATEGORY_THUMBNAIL } from "@/lib/seed";
import { PRIORITY_META } from "@/lib/types";

/** Build an issueId -> "before" thumbnail lookup from a full media list. */
export function buildThumbnails(media: IssueMedia[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of media) {
    if (m.kind === "before" && !map.has(m.issueId)) map.set(m.issueId, m.url);
  }
  return map;
}

export function thumbnailFor(issue: Issue, thumbs: Map<string, string>): string | null {
  return thumbs.get(issue.id) ?? CATEGORY_THUMBNAIL[issue.category] ?? null;
}

export function toMapIssues(issues: Issue[], thumbs: Map<string, string>): MapIssue[] {
  return issues.map((i) => toMapIssue(i, thumbnailFor(i, thumbs)));
}

/** Average center of a set of issues (for defaulting the map viewport). */
export function centerOf(issues: Issue[]): [number, number] {
  if (issues.length === 0) return [28.6139, 77.209];
  const lat = issues.reduce((s, i) => s + i.location.coordinates.lat, 0) / issues.length;
  const lng = issues.reduce((s, i) => s + i.location.coordinates.lng, 0) / issues.length;
  return [lat, lng];
}

export async function getStaff(): Promise<Profile[]> {
  const store = await getStore();
  const profiles = await store.getProfiles();
  return profiles.filter((p) => p.role === "field_staff" && p.isActive);
}

export interface DashboardData {
  issues: Issue[];
  thumbs: Map<string, string>;
  metrics: ReturnType<typeof computeMetrics>;
  attention: ReturnType<typeof computeAttention>;
  attentionTotal: number;
  highPriority: Issue[];
  recent: Issue[];
  mapIssues: MapIssue[];
  center: [number, number];
  staff: Profile[];
}

export async function getDashboardData(): Promise<DashboardData> {
  const store = await getStore();
  const [issues, media, profiles] = await Promise.all([
    store.getIssues(),
    store.getAllMedia(),
    store.getProfiles(),
  ]);
  const thumbs = buildThumbnails(media);
  const metrics = computeMetrics(issues);
  const attention = computeAttention(issues);
  const attentionTotal = attention.reduce((s, c) => s + c.count, 0);

  const live = issues.filter((i) => i.status !== "verified_resolved" && i.status !== "rejected");
  const highPriority = [...live]
    .filter((i) => PRIORITY_META[i.priority].rank >= 3)
    .sort((a, b) => PRIORITY_META[b.priority].rank - PRIORITY_META[a.priority].rank || +new Date(a.createdAt) - +new Date(b.createdAt))
    .slice(0, 6);

  const recent = issues.slice(0, 20);
  const mapIssues = toMapIssues(live.slice(0, 60), thumbs);

  return {
    issues,
    thumbs,
    metrics,
    attention,
    attentionTotal,
    highPriority,
    recent,
    mapIssues,
    center: centerOf(live),
    staff: profiles.filter((p) => p.role === "field_staff" && p.isActive),
  };
}

export interface AnalyticsData {
  total: number;
  category: ReturnType<typeof computeCategoryDistribution>;
  status: ReturnType<typeof computeStatusDistribution>;
  series: ReturnType<typeof computeTimeSeries>;
  hotspots: ReturnType<typeof computeHotspots>;
  recurring: ReturnType<typeof computeRecurring>;
  verifiedResolved: number;
  avgResponseMinutes: number | null;
  avgResolutionMinutes: number | null;
}

export async function getAnalyticsData(): Promise<AnalyticsData> {
  const store = await getStore();
  const issues = await store.getIssues();
  const metrics = computeMetrics(issues);
  return {
    total: issues.length,
    category: computeCategoryDistribution(issues),
    status: computeStatusDistribution(issues),
    series: computeTimeSeries(issues, 14),
    hotspots: computeHotspots(issues),
    recurring: computeRecurring(issues),
    verifiedResolved: metrics.verifiedResolved,
    avgResponseMinutes: metrics.avgResponseMinutes,
    avgResolutionMinutes: metrics.avgResolutionMinutes,
  };
}
