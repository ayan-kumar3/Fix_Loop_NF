import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  differenceInHours,
  differenceInMinutes,
  format,
  formatDistanceToNowStrict,
  isBefore,
  subHours,
} from "date-fns";
import type { Issue, IssuePriority } from "@/lib/types";

/** Merge Tailwind classes with conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Default SLA window (hours) per priority. Used for overdue / breach logic. */
export const SLA_HOURS: Record<IssuePriority, number> = {
  Critical: 6,
  High: 24,
  Medium: 48,
  Low: 96,
};

export function slaHoursFor(priority: IssuePriority): number {
  return SLA_HOURS[priority];
}

const NOW = () => new Date();

/** Absolute deadline for an issue given its creation time and priority. */
export function slaDeadline(issue: Pick<Issue, "createdAt" | "priority" | "slaHours">): Date {
  const created = new Date(issue.createdAt);
  const hours = issue.slaHours || slaHoursFor(issue.priority);
  return new Date(created.getTime() + hours * 3600 * 1000);
}

/** True when an issue is past its SLA deadline and not yet resolved/verified. */
export function isOverdue(issue: Issue): boolean {
  if (isResolvedish(issue.status)) return false;
  return isBefore(slaDeadline(issue), NOW());
}

/** True when an issue is within the last 25% of its SLA window (approaching breach). */
export function isApproachingSla(issue: Issue): boolean {
  if (isResolvedish(issue.status)) return false;
  const deadline = slaDeadline(issue);
  if (isBefore(deadline, NOW())) return false;
  const created = new Date(issue.createdAt);
  const totalMs = deadline.getTime() - created.getTime();
  if (totalMs <= 0) return false;
  const remainingMs = deadline.getTime() - NOW().getTime();
  return remainingMs / totalMs <= 0.25;
}

export function isTerminal(status: Issue["status"]): boolean {
  return status === "verified_resolved" || status === "rejected";
}

export function isResolvedish(status: Issue["status"]): boolean {
  return (
    status === "resolved_pending_verification" ||
    status === "verified_resolved" ||
    status === "rejected"
  );
}

/** Minutes until deadline (negative if overdue). */
export function minutesRemaining(issue: Issue): number {
  return differenceInMinutes(slaDeadline(issue), NOW());
}

/** Human phrase for the remaining SLA time, e.g. "7h left" or "2d overdue". */
export function remainingLabel(issue: Issue): string {
  const mins = minutesRemaining(issue);
  const absMin = Math.abs(mins);
  const label = formatDurationMinutes(absMin);
  return mins < 0 ? `${label} overdue` : `${label} left`;
}

export function formatDurationMinutes(minutes: number): string {
  if (minutes < 1) return "<1m";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h < 1) return `${m}m`;
  if (h < 24) {
    const d = Math.floor(h / 24);
    if (d >= 1) return `${d}d ${h % 24}h`;
    return `${h}h ${m}m`;
  }
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function formatDurationHours(hours: number | null): string {
  if (hours == null) return "—";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(hours / 24);
  const remH = Math.round(hours - d * 24);
  return remH > 0 ? `${d}d ${remH}h` : `${d}d`;
}

/** Age of an issue since creation as a compact phrase. */
export function ageLabel(issue: Pick<Issue, "createdAt">): string {
  return formatDistanceToNowStrict(new Date(issue.createdAt), { addSuffix: false });
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const hours = date.getUTCHours();
  const hour12 = hours % 12 || 12;
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()} at ${hour12}:${minutes} ${hours >= 12 ? "PM" : "AM"}`;
}

export function formatDateShort(iso: string): string {
  return format(new Date(iso), "MMM d, h:mm a");
}

export function formatDayShort(iso: string): string {
  return format(new Date(iso), "MMM d");
}

/** Compact relative time, e.g. "5h ago", "3d ago", "just now". */
export function formatDistanceShort(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/** Hours between two ISO timestamps. */
export function hoursBetween(startIso: string, endIso: string): number {
  return differenceInHours(new Date(endIso), new Date(startIso));
}

export function minutesBetween(startIso: string, endIso: string): number {
  return differenceInMinutes(new Date(endIso), new Date(startIso));
}

/** Shorten long text for compact UI. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

/** Initials for avatar fallbacks. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic avatar background color from a string seed. */
export function avatarColor(seed: string): string {
  const palette = [
    "#1d4ed8", "#0f766e", "#b45309", "#be123c", "#6d28d9",
    "#0369a1", "#15803d", "#a21caf", "#c2410c", "#334155",
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 100000;
  return palette[h % palette.length];
}

export function subHoursFromNow(hours: number): string {
  return subHours(NOW(), hours).toISOString();
}

/** Approximate distance between two coordinates in meters (haversine). */
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
