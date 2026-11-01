import {
  FolderOpen,
  Clock,
  UserX,
  Zap,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatDurationMinutes, formatDurationHours } from "@/lib/utils";
import type { DashboardMetrics } from "@/lib/types";

interface KpiDef {
  key: keyof DashboardMetrics;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconTone: string;
  /** For time metrics we display formatted duration instead of a raw number. */
  kind: "count" | "duration";
  /** Lower is better for all of these operational metrics. */
  lowerIsBetter: boolean;
}

const KPIS: KpiDef[] = [
  { key: "openIssues", label: "Open Issues", icon: FolderOpen, iconTone: "bg-brand-50 text-brand-700", kind: "count", lowerIsBetter: true },
  { key: "overdue", label: "Overdue", icon: Clock, iconTone: "bg-danger/10 text-danger", kind: "count", lowerIsBetter: true },
  { key: "unassigned", label: "Unassigned", icon: UserX, iconTone: "bg-warn/10 text-warn", kind: "count", lowerIsBetter: true },
  { key: "avgResponseMinutes", label: "Avg. Response Time", icon: Zap, iconTone: "bg-violet-50 text-violet-600", kind: "duration", lowerIsBetter: true },
  { key: "avgResolutionMinutes", label: "Avg. Resolution Time", icon: CheckCircle2, iconTone: "bg-success/10 text-success", kind: "duration", lowerIsBetter: true },
];

function formatValue(value: number | null, kind: "count" | "duration"): string {
  if (value == null) return "—";
  if (kind === "count") return String(value);
  return formatDurationHours(value / 60);
}

export function KpiCards({ metrics }: { metrics: DashboardMetrics }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {KPIS.map((kpi) => {
        const Icon = kpi.icon;
        const current = metrics[kpi.key] as number | null;
        const previous = metrics.comparisons[kpi.key as keyof DashboardMetrics["comparisons"]] as number | null;
        return (
          <Card key={kpi.key} className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</span>
                <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", kpi.iconTone)}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
                {formatValue(current, kpi.kind)}
              </div>
              <Trend current={current} previous={previous} lowerIsBetter={kpi.lowerIsBetter} kind={kpi.kind} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Trend({
  current,
  previous,
  lowerIsBetter,
  kind,
}: {
  current: number | null;
  previous: number | null;
  lowerIsBetter: boolean;
  kind: "count" | "duration";
}) {
  // Insufficient prior-period data → honest unavailable state.
  if (previous == null || current == null || previous === 0) {
    return (
      <div className="mt-1.5 flex items-center gap-1 text-xs text-slate-400">
        <Minus className="h-3 w-3" />
        <span>No prior-period data</span>
      </div>
    );
  }

  const delta = current - previous;
  const pct = Math.round((delta / previous) * 100);
  const flat = delta === 0;
  const good = lowerIsBetter ? delta < 0 : delta > 0;

  const deltaLabel =
    kind === "duration"
      ? `${delta > 0 ? "+" : ""}${formatDurationMinutes(Math.abs(delta))}`
      : `${Math.abs(pct)}%`;

  const Icon = flat ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  const tone = flat ? "text-slate-500" : good ? "text-success" : "text-danger";

  return (
    <div className="mt-1.5 flex items-center gap-1 text-xs">
      <span className={cn("inline-flex items-center gap-0.5 font-semibold", tone)}>
        <Icon className="h-3.5 w-3.5" />
        {flat ? "No change" : deltaLabel}
      </span>
      <span className="text-slate-400">vs. last week</span>
    </div>
  );
}
