// ---------------------------------------------------------------------------
// Shared selectors — pure functions that derive dashboard metrics, analytics
// series and duplicate detections from raw issue rows. Used by both the demo
// store and the Supabase store so the math is identical and testable.
//
// Period-over-period comparisons are reconstructed from real timestamps
// (createdAt / assignedAt / resolvedAt) rather than invented, and every metric
// returns null when the underlying data is insufficient.
// ---------------------------------------------------------------------------

import type {
  AttentionCard,
  CategoryCount,
  DashboardMetrics,
  GeoPoint,
  Hotspot,
  Issue,
  IssueCategory,
  IssueStatus,
  StatusCount,
  TimeSeriesPoint,
} from "@/lib/types";
import { PRIORITY_META, STATUS_META } from "@/lib/types";
import { distanceMeters, isApproachingSla, isOverdue, isResolvedish, slaDeadline } from "@/lib/utils";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export interface MetricWindows {
  /** Current window length in ms (default 7 days). */
  windowMs: number;
}

function createdMs(i: Issue) {
  return +new Date(i.createdAt);
}
function assignedMs(i: Issue) {
  return i.assignedAt ? +new Date(i.assignedAt) : null;
}
function resolvedMs(i: Issue) {
  return i.resolvedAt ? +new Date(i.resolvedAt) : null;
}
function deadlineMs(i: Issue) {
  return +new Date(slaDeadline(i));
}

function openAsOf(issues: Issue[], t: number): number {
  let n = 0;
  for (const i of issues) {
    if (createdMs(i) > t) continue;
    const r = resolvedMs(i);
    if (r != null && r <= t) continue;
    if (i.status === "rejected") continue;
    n++;
  }
  return n;
}

function overdueAsOf(issues: Issue[], t: number): number {
  let n = 0;
  for (const i of issues) {
    if (createdMs(i) > t) continue;
    const r = resolvedMs(i);
    if (r != null && r <= t) continue;
    if (i.status === "rejected") continue;
    if (deadlineMs(i) <= t) n++;
  }
  return n;
}

function unassignedAsOf(issues: Issue[], t: number): number {
  let n = 0;
  for (const i of issues) {
    if (createdMs(i) > t) continue;
    if (i.status === "rejected") continue;
    const a = assignedMs(i);
    if (a == null || a > t) n++;
  }
  return n;
}

/** Avg minutes from creation to first assignment for issues created in window. */
function avgResponseMinutes(issues: Issue[], start: number, end: number): number | null {
  let sum = 0;
  let n = 0;
  for (const i of issues) {
    const c = createdMs(i);
    if (c < start || c > end) continue;
    const a = assignedMs(i);
    if (a == null || a <= c) continue;
    sum += (a - c) / MIN;
    n++;
  }
  return n === 0 ? null : Math.round(sum / n);
}

/** Avg minutes from creation to resolution for issues resolved in window. */
function avgResolutionMinutes(issues: Issue[], start: number, end: number): number | null {
  let sum = 0;
  let n = 0;
  for (const i of issues) {
    const r = resolvedMs(i);
    if (r == null || r < start || r > end) continue;
    const c = createdMs(i);
    if (r <= c) continue;
    sum += (r - c) / MIN;
    n++;
  }
  return n === 0 ? null : Math.round(sum / n);
}

export function computeMetrics(issues: Issue[], now: number = Date.now(), windows: MetricWindows = { windowMs: 7 * DAY }): DashboardMetrics {
  const w = windows.windowMs;
  const curStart = now - w;
  const prevStart = now - 2 * w;
  const prevEnd = now - w;

  const openNow = openAsOf(issues, now);
  const openPrev = openAsOf(issues, prevEnd);
  const overdueNow = overdueAsOf(issues, now);
  const overduePrev = overdueAsOf(issues, prevEnd);
  const unassignedNow = unassignedAsOf(issues, now);
  const unassignedPrev = unassignedAsOf(issues, prevEnd);
  const respNow = avgResponseMinutes(issues, curStart, now);
  const respPrev = avgResponseMinutes(issues, prevStart, prevEnd);
  const resNow = avgResolutionMinutes(issues, curStart, now);
  const resPrev = avgResolutionMinutes(issues, prevStart, prevEnd);

  return {
    openIssues: openNow,
    overdue: overdueNow,
    unassigned: unassignedNow,
    avgResponseMinutes: respNow,
    avgResolutionMinutes: resNow,
    verifiedResolved: issues.filter((i) => i.status === "verified_resolved").length,
    comparisons: {
      openIssues: hasData(issues, prevStart, prevEnd) ? openPrev : null,
      overdue: hasData(issues, prevStart, prevEnd) ? overduePrev : null,
      unassigned: hasData(issues, prevStart, prevEnd) ? unassignedPrev : null,
      avgResponseMinutes: respPrev,
      avgResolutionMinutes: resPrev,
    },
  };
}

function hasData(issues: Issue[], start: number, end: number): boolean {
  return issues.some((i) => createdMs(i) >= start && createdMs(i) <= end);
}

export function computeAttention(issues: Issue[]): AttentionCard[] {
  const overdue = issues.filter((i) => isOverdue(i));
  const unassignedHigh = issues.filter(
    (i) => !i.assignedToId && !isResolvedish(i.status) && (PRIORITY_META[i.priority].rank >= 3)
  );
  const breach = issues.filter((i) => isApproachingSla(i));

  const cards: AttentionCard[] = [];
  if (overdue.length > 0) {
    cards.push({
      key: "overdue",
      count: overdue.length,
      heading: `${overdue.length} overdue issue${overdue.length > 1 ? "s" : ""}`,
      subheading: "Every active report is still on the clock.",
      badge: "PAST SLA TARGET",
      actionLabel: "Resolve now",
      actionHref: "/alerts?type=overdue",
    });
  }
  if (unassignedHigh.length > 0) {
    cards.push({
      key: "unassigned_high",
      count: unassignedHigh.length,
      heading: `${unassignedHigh.length} unassigned high-priority issue${unassignedHigh.length > 1 ? "s" : ""}`,
      subheading: "Assign a team to start the clock.",
      badge: "NEEDS AN OWNER",
      actionLabel: "Assign now",
      actionHref: "/alerts?type=unassigned",
    });
  }
  if (breach.length > 0) {
    cards.push({
      key: "sla_breach",
      count: breach.length,
      heading: `${breach.length} nearing SLA breach`,
      subheading: "Less than 25% of the SLA window remaining.",
      badge: "TIGHT DEADLINE",
      actionLabel: "Review now",
      actionHref: "/alerts?type=breach",
    });
  }
  return cards;
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export function computeCategoryDistribution(issues: Issue[]): CategoryCount[] {
  const map = new Map<IssueCategory, number>();
  for (const i of issues) map.set(i.category, (map.get(i.category) ?? 0) + 1);
  return [...map.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

export function computeStatusDistribution(issues: Issue[]): StatusCount[] {
  const map = new Map<IssueStatus, number>();
  for (const i of issues) map.set(i.status, (map.get(i.status) ?? 0) + 1);
  // keep lifecycle order
  return (Object.keys(STATUS_META) as IssueStatus[])
    .filter((s) => map.has(s))
    .map((status) => ({ status, count: map.get(status)! }));
}

export function computeTimeSeries(issues: Issue[], days = 14, now: number = Date.now()): TimeSeriesPoint[] {
  const buckets: TimeSeriesPoint[] = [];
  const dayMs = DAY;
  const startDay = Math.floor((now - days * dayMs) / dayMs) * dayMs;
  const counts = new Map<number, number>();
  for (let d = 0; d < days; d++) {
    const key = startDay + d * dayMs;
    counts.set(key, 0);
  }
  for (const i of issues) {
    const c = createdMs(i);
    if (c < startDay || c > now) continue;
    const key = Math.floor((c - startDay) / dayMs) * dayMs + startDay;
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const [key, count] of [...counts.entries()].sort((a, b) => a[0] - b[0])) {
    buckets.push({ date: new Date(key).toISOString().slice(0, 10), count });
  }
  return buckets;
}

/** Average centroid per area → hotspot ranking. */
export function computeHotspots(issues: Issue[]): Hotspot[] {
  const byArea = new Map<string, { count: number; lat: number; lng: number }>();
  for (const i of issues) {
    const area = i.location.area || "Unknown";
    const e = byArea.get(area) ?? { count: 0, lat: 0, lng: 0 };
    e.count += 1;
    e.lat += i.location.coordinates.lat;
    e.lng += i.location.coordinates.lng;
    byArea.set(area, e);
  }
  return [...byArea.entries()]
    .map(([area, e]) => ({
      area,
      count: e.count,
      coordinates: { lat: e.lat / e.count, lng: e.lng / e.count },
    }))
    .sort((a, b) => b.count - a.count);
}

/** Locations that keep recurring: coordinates clustered within ~80m, count >= 2. */
export function computeRecurring(issues: Issue[], thresholdM = 80): Array<{ label: string; count: number; coordinates: GeoPoint }> {
  const used = new Set<string>();
  const results: Array<{ label: string; count: number; coordinates: GeoPoint }> = [];
  const open = issues.filter((i) => !isResolvedish(i.status) || true);
  for (let a = 0; a < open.length; a++) {
    const ia = open[a];
    if (used.has(ia.id)) continue;
    const cluster = [ia];
    for (let b = a + 1; b < open.length; b++) {
      const ib = open[b];
      if (used.has(ib.id)) continue;
      if (distanceMeters(ia.location.coordinates, ib.location.coordinates) <= thresholdM) {
        cluster.push(ib);
        used.add(ib.id);
      }
    }
    if (cluster.length >= 2) {
      used.add(ia.id);
      const lat = cluster.reduce((s, x) => s + x.location.coordinates.lat, 0) / cluster.length;
      const lng = cluster.reduce((s, x) => s + x.location.coordinates.lng, 0) / cluster.length;
      results.push({ label: ia.location.address, count: cluster.length, coordinates: { lat, lng } });
    }
  }
  return results.sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

export interface DuplicateConfig {
  distanceMeters: number;
  similarity: number;
}

export const DEFAULT_DUPLICATE_CONFIG: DuplicateConfig = {
  distanceMeters: Number(process.env.DUPLICATE_DISTANCE_METERS ?? 250),
  similarity: Number(process.env.DUPLICATE_SIMILARITY_THRESHOLD ?? 0.55),
};

export interface DuplicateMatch {
  issueId: string;
  publicId: string;
  title: string;
  address: string;
  distanceMeters: number;
  score: number;
  categoryMatch: boolean;
  tokenSimilarity: number;
  relatedCount: number;
  explanation: string;
}

const STOP = new Set(["the", "a", "an", "on", "in", "near", "at", "of", "to", "and", "is", "are", "for", "with", "this", "that", "it", "has", "been", "was"]);

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOP.has(t))
  );
}

export function tokenSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = new Set([...ta, ...tb]).size;
  return union === 0 ? 0 : inter / union;
}

/**
 * Find existing open issues that the given draft may duplicate. Combines
 * geographic proximity, category similarity, description token overlap and
 * time proximity into an explainable score.
 */
export function findPotentialDuplicates(
  draft: { title: string; description: string; category: IssueCategory; coordinates: GeoPoint; createdAt?: string },
  issues: Issue[],
  config: DuplicateConfig = DEFAULT_DUPLICATE_CONFIG,
  groupSizes?: Map<string, number>
): DuplicateMatch[] {
  const text = `${draft.title} ${draft.description}`;
  const draftTime = draft.createdAt ? +new Date(draft.createdAt) : Date.now();
  const matches: DuplicateMatch[] = [];

  for (const i of issues) {
    if (isResolvedish(i.status)) continue;
    const dist = distanceMeters(draft.coordinates, i.location.coordinates);
    if (dist > config.distanceMeters) continue;

    const categoryMatch = i.category === draft.category;
    const tsim = tokenSimilarity(text, `${i.title} ${i.description}`);
    const timeDays = Math.abs(draftTime - createdMs(i)) / DAY;
    const timeProximity = Math.max(0, 1 - timeDays / 14); // within 2 weeks

    // Weighted, explainable score.
    const score = 0.45 * (categoryMatch ? 1 : tsim * 0.6) + 0.35 * tsim + 0.2 * timeProximity;
    if (!categoryMatch && tsim < config.similarity) continue;
    if (score < config.similarity) continue;

    const relatedCount = groupSizes?.get(i.id) ?? 1;
    matches.push({
      issueId: i.id,
      publicId: i.publicId,
      title: i.title,
      address: i.location.address,
      distanceMeters: Math.round(dist),
      score: Math.min(1, score),
      categoryMatch,
      tokenSimilarity: tsim,
      relatedCount,
      explanation: buildExplanation(categoryMatch, tsim, dist, timeDays),
    });
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, 3);
}

function buildExplanation(categoryMatch: boolean, tsim: number, dist: number, timeDays: number): string {
  const parts: string[] = [];
  parts.push(categoryMatch ? "same category" : "similar wording");
  if (tsim >= 0.2) parts.push(`~${Math.round(tsim * 100)}% description match`);
  parts.push(`${Math.round(dist)} m away`);
  if (timeDays <= 7) parts.push(`reported ${timeDays < 1 ? "today" : `${Math.round(timeDays)}d`} apart`);
  return parts.join(" · ");
}
