"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Clock,
  User,
  Tag,
  Sparkles,
  GitMerge,
  MessageSquare,
  Camera,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  ClipboardList,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, toneToVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IssueMap } from "@/components/map/issue-map";
import { toMapIssue } from "@/lib/map-issue";
import { StatusChip, PriorityChip, DemoBadge } from "@/components/shared/issue-badges";
import { toast } from "@/components/toaster";
import { useProfile } from "@/components/app/app-context";
import {
  assignIssue,
  changeIssueStatus,
  submitVerification,
  addComment,
  confirmGroup,
  updateWorkOrderStatus,
  addWorkOrderNoteAction,
} from "@/lib/actions/issues";
import { canSetStatus, canTransition } from "@/lib/transitions";
import { STATUS_META, PRIORITY_META } from "@/lib/types";
import type {
  AiAnalysis,
  Issue,
  IssueEvent,
  IssueGroup,
  IssueMedia,
  IssueStatus,
  Profile,
  Verification,
  WorkOrder,
} from "@/lib/types";
import type { Comment } from "@/lib/seed";
import {
  formatDateTime,
  formatDistanceShort,
  remainingLabel,
  isOverdue,
  isApproachingSla,
  cn,
  slaDeadline,
  formatDurationMinutes,
} from "@/lib/utils";

const NEXT_STATUS_LABEL: Partial<Record<IssueStatus, string>> = {
  under_review: "Move to review",
  assigned: "Assign",
  in_progress: "Start work",
  resolved_pending_verification: "Mark resolved",
  verified_resolved: "Verify resolved",
  rejected: "Reject",
  reopened: "Reopen",
};

export interface IssueDetailData {
  issue: Issue;
  media: IssueMedia[];
  analysis: AiAnalysis | null;
  events: IssueEvent[];
  comments: Comment[];
  verifications: Verification[];
  group: IssueGroup | null;
  workOrder: WorkOrder | null;
  staff: Profile[];
}

export function IssueDetailView({ data }: { data: IssueDetailData }) {
  const { issue, media, analysis, events, comments, verifications, group, workOrder, staff } = data;
  const profile = useProfile();
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [comment, setComment] = React.useState("");
  const [verifyReason, setVerifyReason] = React.useState("");

  const refresh = () => router.refresh();
  const run = async (key: string, fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, successMsg?: string) => {
    setBusy(key);
    const res = await fn();
    setBusy(null);
    if (res.ok) {
      toast({ title: "Done", description: successMsg ?? res.message ?? "Updated.", variant: "success" });
      refresh();
    } else {
      toast({ title: "Action failed", description: res.error, variant: "error" });
    }
  };

  const before = media.filter((m) => !m.isEvidence);
  const after = media.filter((m) => m.isEvidence);
  const overdue = isOverdue(issue);
  const breaching = isApproachingSla(issue);
  const mapIssue = toMapIssue(issue, before[0]?.url ?? null);

  const isReporter = profile.id === issue.reporterId;
  const isAdmin = profile.role === "administrator";
  const isStaff = profile.role === "field_staff";
  const canVerify = issue.status === "resolved_pending_verification" && (isReporter || isAdmin || profile.role === "resident");

  // Statuses the current user may transition to.
  const allowedStatuses = (Object.keys(NEXT_STATUS_LABEL) as IssueStatus[]).filter(
    (s) => canTransition(issue.status, s) && s !== issue.status && canSetStatus(profile.role, s)
  );

  return (
    <div className="grid gap-5 p-5 lg:grid-cols-[1.6fr_1fr] lg:p-8">
      {/* ---------------- Main column ---------------- */}
      <div className="space-y-5">
        {/* Header card */}
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-brand-700">{issue.publicId}</span>
              <StatusChip status={issue.status} />
              <PriorityChip priority={issue.priority} />
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{issue.title}</h1>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5"><Tag className="h-4 w-4 text-slate-400" /> {issue.category}</span>
              <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-slate-400" /> {issue.location.address}{issue.location.area ? ` · ${issue.location.area}` : ""}</span>
              <span className="inline-flex items-center gap-1.5"><User className="h-4 w-4 text-slate-400" /> {issue.reporterName}</span>
              <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4 text-slate-400" /> {formatDateTime(issue.createdAt)}</span>
            </div>

            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{issue.description}</p>
          </CardContent>
        </Card>

        {/* Photos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Camera className="h-4 w-4" /> Photos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">As reported</p>
              {before.length === 0 ? (
                <p className="text-sm text-slate-400">No photos attached.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {before.map((m) => (
                    <PhotoThumb key={m.id} url={m.url} caption={m.caption} />
                  ))}
                </div>
              )}
            </div>
            {after.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-success"><ShieldCheck className="h-3.5 w-3.5" /> Resolution evidence</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {after.map((m) => (
                    <PhotoThumb key={m.id} url={m.url} caption={m.caption} />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Location map */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Location</CardTitle>
            <CardDescription>{issue.location.coordinates.lat.toFixed(5)}, {issue.location.coordinates.lng.toFixed(5)}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 overflow-hidden rounded-lg border">
              <IssueMap issues={[mapIssue]} center={[issue.location.coordinates.lat, issue.location.coordinates.lng]} zoom={17} theme="light" showPopup={false} interactive={false} />
            </div>
          </CardContent>
        </Card>

        {/* AI analysis */}
        {analysis && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand-600" /> AI analysis</CardTitle>
              <CardDescription>Suggested by {analysis.model}. Stored separately from human-confirmed values.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <Info label="Suggested category" value={analysis.suggestedCategory} />
                <Info label="Suggested priority" value={analysis.suggestedPriority} />
                <div>
                  <div className="text-xs text-slate-500">Confidence</div>
                  <Badge variant={toneToVariant(analysis.confidenceBand === "High" ? "success" : analysis.confidenceBand === "Medium" ? "warn" : "danger")}>
                    {analysis.confidenceBand}
                  </Badge>
                </div>
              </div>
              <Info label="Summary" value={analysis.summary} />
              {analysis.visualFindings && (
                <div className="report-ai-result rounded-lg border p-3">
                  <div className="report-ai-label flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                    <Eye className="h-3.5 w-3.5" /> What Gemini sees
                  </div>
                  <p className="report-ai-copy mt-1 whitespace-pre-line text-sm leading-6">{analysis.visualFindings}</p>
                </div>
              )}
              {analysis.detailedReport && (
                <div className="report-ai-result rounded-lg border p-3">
                  <div className="report-ai-label text-xs font-semibold uppercase tracking-wide">Detailed municipal report</div>
                  <p className="report-ai-copy mt-1 whitespace-pre-line text-sm leading-6">{analysis.detailedReport}</p>
                </div>
              )}
              <Info label="Reason" value={analysis.reason} />
              {analysis.needsReview && <Badge variant="warn">Flagged for human review</Badge>}
              {analysis.safetyNote && (
                <div className="rounded-md border border-danger/30 bg-danger/5 p-2.5 text-sm text-danger">
                  <strong className="flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Safety note:</strong> {analysis.safetyNote}
                </div>
              )}
              <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-600">
                <strong>Confirmed:</strong> {issue.category} · {issue.priority}
                {analysis.suggestedCategory !== issue.category || analysis.suggestedPriority !== issue.priority
                  ? " (human overrode the AI suggestion)"
                  : " (matches AI suggestion)"}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Duplicate group */}
        {group && (
          <Card className="border-brand-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><GitMerge className="h-4 w-4" /> Related reports</CardTitle>
              <CardDescription>{group.reason}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="info">{group.memberIssueIds.length} grouped reports</Badge>
                <Badge variant="neutral">~{Math.round(group.similarity * 100)}% similarity</Badge>
                <Badge variant="neutral">{Math.round(group.distanceMeters)}m apart</Badge>
                <Badge variant={group.status === "confirmed" ? "success" : "warn"}>{group.status === "confirmed" ? "Confirmed" : "Suggested"}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.memberIssueIds.filter((id) => id !== issue.id).map((id) => (
                  <Button key={id} asChild variant="outline" size="sm">
                    <Link href={`/issues/${id}`}>View related <ChevronRight className="h-3.5 w-3.5" /></Link>
                  </Button>
                ))}
              </div>
              {group.status === "suggested" && isAdmin && (
                <Button variant="brand" size="sm" disabled={busy === "group"} onClick={() => run("group", () => confirmGroup(group.id), "Group confirmed. Original reports preserved.")}>
                  {busy === "group" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />} Confirm grouping
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Activity timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" /> Activity timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <Lifecycle current={issue.status} />
            <Separator className="my-4" />
            <ol className="relative space-y-4 border-l pl-5">
              {events.map((e) => (
                <li key={e.id} className="relative">
                  <span className={cn("absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-white", eventDot(e.type))} />
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{e.title}</span>
                  </div>
                  {e.description && <p className="text-sm text-slate-600">{e.description}</p>}
                  <p className="mt-0.5 text-xs text-slate-400">{e.actorName} · {formatDateTime(e.createdAt)}</p>
                </li>
              ))}
              {events.length === 0 && <p className="text-sm text-slate-400">No activity yet.</p>}
            </ol>
          </CardContent>
        </Card>

        {/* Comments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Comments & updates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add an update or ask a question…"
                rows={2}
              />
              <Button
                disabled={!comment.trim() || busy === "comment"}
                onClick={() => run("comment", () => addComment({ issueId: issue.id, body: comment.trim() }).then((r) => ({ ok: r.ok, error: r.error })), "Comment posted.").then(() => setComment(""))}
              >
                {busy === "comment" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
              </Button>
            </div>
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="rounded-lg border bg-slate-50 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{c.authorName}</span>
                    <Badge variant="neutral">{c.authorRole.replace("_", " ")}</Badge>
                    <span className="ml-auto text-xs text-slate-400">{formatDistanceShort(c.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{c.body}</p>
                </li>
              ))}
              {comments.length === 0 && <p className="text-sm text-slate-400">No comments yet.</p>}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* ---------------- Side column ---------------- */}
      <div className="space-y-5">
        {/* SLA + status */}
        <Card className={cn(overdue && "border-danger/30")}>
          <CardHeader>
            <CardTitle className="text-base">Status & SLA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className={cn("rounded-lg border p-3", overdue ? "border-danger/30 bg-danger/5" : breaching ? "border-warn/30 bg-warn/5" : "border-slate-200 bg-slate-50")}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Time remaining</span>
                <span className={cn("text-sm font-bold tabular-nums", overdue ? "text-danger" : breaching ? "text-warn" : "text-slate-800")}>
                  {remainingLabel(issue)}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-500">SLA target: {issue.slaHours}h · due {formatDateTime(slaDeadline(issue).toISOString())}</div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <Info label="Assigned to" value={issue.assignedToName ?? "Unassigned"} />
              <Info label="Team" value={issue.teamName ?? "—"} />
            </div>

            {/* Assign (admin) */}
            {isAdmin && (
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-slate-500">Assign to team member</span>
                <Select onValueChange={(id) => run("assign", () => assignIssue(issue.id, id))}>
                  <SelectTrigger><SelectValue placeholder="Choose staff…" /></SelectTrigger>
                  <SelectContent>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Status transitions */}
            {(allowedStatuses.length > 0 || (isStaff && workOrder)) && (
              <div className="flex flex-wrap gap-2">
                {allowedStatuses.map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={s === "resolved_pending_verification" ? "success" : s === "rejected" ? "destructive" : "outline"}
                    disabled={busy === s}
                    onClick={() => run(s, () => changeIssueStatus(issue.id, s).then((r) => ({ ok: r.ok, error: r.error })), `Moved to ${STATUS_META[s].label}.`)}
                  >
                    {busy === s ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {NEXT_STATUS_LABEL[s]}
                  </Button>
                ))}
              </div>
            )}

            {/* Field staff work order actions */}
            {workOrder && (isStaff || isAdmin) && workOrder.status !== "completed" && (
              <WorkOrderActions workOrder={workOrder} busy={busy} onAction={run} />
            )}
          </CardContent>
        </Card>

        {/* Community verification */}
        {issue.status === "resolved_pending_verification" && (
          <Card className="border-brand-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-brand-600" /> Awaiting community verification</CardTitle>
              <CardDescription>Field staff marked this resolved. Confirm whether it is actually fixed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {issue.resolutionNote && (
                <div className="rounded-md border bg-slate-50 p-3 text-sm">
                  <div className="text-xs font-medium text-slate-500">Resolution note</div>
                  <p className="text-slate-700">{issue.resolutionNote}</p>
                </div>
              )}
              {canVerify ? (
                <>
                  <Textarea value={verifyReason} onChange={(e) => setVerifyReason(e.target.value)} rows={2} placeholder="Add a note (optional)…" />
                  <div className="flex gap-2">
                    <Button className="flex-1" variant="success" disabled={busy === "confirm"} onClick={() => run("confirm", () => submitVerification({ issueId: issue.id, verdict: "confirm_resolved", reason: verifyReason || undefined }).then((r) => ({ ok: r.ok, error: r.error })), "Confirmed resolved. Thank you!")}>
                      {busy === "confirm" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Confirm resolved
                    </Button>
                    <Button className="flex-1" variant="destructive" disabled={busy === "dispute"} onClick={() => run("dispute", () => submitVerification({ issueId: issue.id, verdict: "still_not_fixed", reason: verifyReason || undefined }).then((r) => ({ ok: r.ok, error: r.error })), "Issue reopened for review.")}>
                      {busy === "dispute" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Still not fixed
                    </Button>
                  </div>
                  {!isReporter && <p className="text-[11px] text-slate-400">As a resident you can help verify this fix.</p>}
                </>
              ) : (
                <p className="text-sm text-slate-500">Only the reporter or eligible community members can verify this resolution.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Verification history */}
        {verifications.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Verification history</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {verifications.map((v) => (
                  <li key={v.id} className="flex items-start gap-2 rounded-md border p-2.5 text-sm">
                    {v.verdict === "confirm_resolved" ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> : <RotateCcw className="mt-0.5 h-4 w-4 text-danger" />}
                    <div>
                      <p className="font-medium text-slate-800">{v.verdict === "confirm_resolved" ? "Confirmed resolved" : "Reported still not fixed"} — {v.verifierName}</p>
                      {v.reason && <p className="text-slate-600">{v.reason}</p>}
                      <p className="text-xs text-slate-400">{formatDateTime(v.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Work order summary */}
        {workOrder && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="h-4 w-4" /> Work order</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Info label="Assigned" value={workOrder.assignedToName ?? "Unassigned"} />
              <Info label="Status" value={workOrder.status.replace(/_/g, " ")} />
              <Info label="Due" value={formatDateTime(workOrder.dueAt)} />
              {workOrder.notes.length > 0 && (
                <div className="space-y-1 pt-1">
                  <span className="text-xs font-medium text-slate-500">Notes</span>
                  {workOrder.notes.map((n) => (
                    <div key={n.id} className="rounded border bg-slate-50 p-2 text-xs">
                      <p className="text-slate-700">{n.body}</p>
                      <p className="text-slate-400">{n.authorName} · {formatDateTime(n.createdAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Button asChild variant="outline" className="w-full">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PhotoThumb({ url, caption }: { url: string; caption?: string | null }) {
  const [open, setOpen] = React.useState(false);
  return (
    <figure className="overflow-hidden rounded-lg border">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={caption ?? "issue photo"} onClick={() => setOpen(true)} className="h-32 w-full cursor-zoom-in object-cover transition-transform hover:scale-105" />
      {caption && <figcaption className="truncate px-2 py-1 text-xs text-slate-500">{caption}</figcaption>}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" onClick={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </figure>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm font-medium text-slate-800">{value}</div>
    </div>
  );
}

function eventDot(type: IssueEvent["type"]): string {
  switch (type) {
    case "created": return "bg-brand-600";
    case "ai_analyzed": return "bg-violet-500";
    case "assigned": return "bg-info bg-brand-500";
    case "status_changed": return "bg-slate-400";
    case "evidence_added": return "bg-success";
    case "verification_submitted": return "bg-success";
    case "reopened": return "bg-danger";
    case "duplicate_linked":
    case "group_confirmed": return "bg-warn";
    default: return "bg-slate-400";
  }
}

const LIFECYCLE: Array<{ key: IssueStatus; label: string }> = [
  { key: "submitted", label: "Submitted" },
  { key: "under_review", label: "Under Review" },
  { key: "assigned", label: "Assigned" },
  { key: "in_progress", label: "In Progress" },
  { key: "resolved_pending_verification", label: "Pending Verification" },
  { key: "verified_resolved", label: "Verified Resolved" },
];

function Lifecycle({ current }: { current: IssueStatus }) {
  const currentIdx = LIFECYCLE.findIndex((s) => s.key === current);
  const reopened = current === "reopened";
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span>Lifecycle</span>
        <span className={cn(reopened ? "text-danger" : "text-brand-700")}>{reopened ? "Reopened" : STATUS_META[current]?.label}</span>
      </div>
      <div className="flex items-center">
        {LIFECYCLE.map((stage, i) => {
          const done = currentIdx >= i && !reopened;
          const active = stage.key === current;
          return (
            <React.Fragment key={stage.key}>
              <div className="flex flex-col items-center">
                <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold", done ? "bg-brand-700 text-white" : active ? "bg-brand-100 text-brand-700 ring-2 ring-brand-600" : "bg-slate-100 text-slate-400")}>
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                </span>
              </div>
              {i < LIFECYCLE.length - 1 && <div className={cn("h-0.5 flex-1 rounded", done && currentIdx > i ? "bg-brand-700" : "bg-slate-200")} />}
            </React.Fragment>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-slate-400">
        {LIFECYCLE.map((s) => (
          <span key={s.key} className="w-1/6 text-center leading-tight">{s.label.replace(" ", "\u00A0")}</span>
        ))}
      </div>
    </div>
  );
}

function WorkOrderActions({
  workOrder,
  busy,
  onAction,
}: {
  workOrder: WorkOrder;
  busy: string | null;
  onAction: (key: string, fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string) => Promise<void>;
}) {
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [evidenceUrl, setEvidenceUrl] = React.useState("");

  const nextActions: Array<{ status: WorkOrder["status"]; label: string; variant: "default" | "outline" | "success" }> = [];
  if (workOrder.status === "acknowledged") nextActions.push({ status: "in_progress", label: "Start work", variant: "default" });
  if (workOrder.status === "in_progress") nextActions.push({ status: "submitted_for_verification", label: "Submit for verification", variant: "success" });

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Update work</span>
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Progress note…" />
      {workOrder.status === "in_progress" && (
        <input
          value={evidenceUrl}
          onChange={(e) => setEvidenceUrl(e.target.value)}
          placeholder="After-photo URL (optional)"
          className="h-8 w-full rounded-md border border-input px-2 text-sm"
        />
      )}
      <div className="flex flex-wrap gap-2">
        {nextActions.map((a) => (
          <Button
            key={a.status}
            size="sm"
            variant={a.variant}
            disabled={busy === a.status || (a.status === "submitted_for_verification" && !note.trim())}
            onClick={() => onAction(a.status, () => updateWorkOrderStatus(workOrder.id, a.status, note.trim() || undefined, evidenceUrl || null).then((r) => ({ ok: r.ok, error: r.error })), `Work order ${a.status.replace(/_/g, " ")}.`)}
          >
            {busy === a.status ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {a.label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" disabled={!note.trim() || busy === "note"} onClick={() => onAction("note", () => addWorkOrderNoteAction({ workOrderId: workOrder.id, body: note.trim() }).then((r) => ({ ok: r.ok, error: r.error })), "Note added.").then(() => setNote(""))}>
          Add note
        </Button>
      </div>
    </div>
  );
}
