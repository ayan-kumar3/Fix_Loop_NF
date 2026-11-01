import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, CheckCircle2, Clock, Repeat, Timer, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { CategoryDistributionChart, HotspotsChart, ReportsOverTimeChart, StatusDistributionChart } from "@/components/analytics/charts";
import { DemoBadge } from "@/components/shared/issue-badges";
import { Card, CardContent } from "@/components/ui/card";
import { getAnalyticsData } from "@/lib/queries";
import { formatDurationHours } from "@/lib/utils";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const data = await getAnalyticsData();

  const summary = [
    {
      label: "Total reports",
      value: String(data.total),
      icon: TrendingUp,
      tone: "bg-brand-50 text-brand-700",
      sub: "All time",
    },
    {
      label: "Verified resolved",
      value: String(data.verifiedResolved),
      icon: CheckCircle2,
      tone: "bg-success/10 text-success",
      sub: data.total > 0 ? `${Math.round((data.verifiedResolved / data.total) * 100)}% of all reports` : "—",
    },
    {
      label: "Avg. response",
      value: data.avgResponseMinutes == null ? "—" : formatDurationHours(data.avgResponseMinutes / 60),
      icon: Timer,
      tone: "bg-violet-50 text-violet-600",
      sub: "Report → first assignment",
    },
    {
      label: "Avg. resolution",
      value: data.avgResolutionMinutes == null ? "—" : formatDurationHours(data.avgResolutionMinutes / 60),
      icon: Clock,
      tone: "bg-warn/10 text-warn",
      sub: "Report → resolved",
    },
  ];

  return (
    <div className="flex flex-col">
      <PageHeader title="Analytics" subtitle="Community-wide performance computed from stored records." />

      <div className="space-y-5 p-5 lg:p-8">
        {/* Summary row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summary.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label} className="shadow-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{s.label}</span>
                    <span className={`flex h-8 w-8 items-center justify-rounded-lg ${s.tone}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{s.value}</div>
                  <p className="mt-1 text-xs text-slate-400">{s.sub}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Time series */}
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-bold text-slate-900">Reports over time</h2>
              <span className="ml-auto text-xs text-slate-400">Last 14 days</span>
            </div>
            <ReportsOverTimeChart series={data.series} />
          </CardContent>
        </Card>

        {/* Category + Status */}
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-brand-600" />
                <h2 className="text-sm font-bold text-slate-900">Issues by category</h2>
              </div>
              <CategoryDistributionChart data={data.category} />
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-brand-600" />
                <h2 className="text-sm font-bold text-slate-900">Lifecycle breakdown</h2>
              </div>
              <StatusDistributionChart data={data.status} />
            </CardContent>
          </Card>
        </div>

        {/* Hotspots + recurring */}
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-brand-600" />
                <h2 className="text-sm font-bold text-slate-900">Area hotspots</h2>
                <span className="ml-auto text-xs text-slate-400">Reports per area</span>
              </div>
              <HotspotsChart hotspots={data.hotspots} />
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Repeat className="h-4 w-4 text-brand-600" />
                <h2 className="text-sm font-bold text-slate-900">Recurring problem spots</h2>
                <span className="ml-auto text-xs text-slate-400">Clusters within ~80m</span>
              </div>
              {data.recurring.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">
                  No recurring clusters detected. Problem spots appear here when multiple reports land in the same location.
                </p>
              ) : (
                <ul className="divide-y">
                  {data.recurring.slice(0, 8).map((r, idx) => (
                    <li key={`${r.label}-${idx}`} className="flex items-center justify-between py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{r.label}</p>
                        <p className="text-xs tabular-nums text-slate-400">
                          {r.coordinates.lat.toFixed(4)}, {r.coordinates.lng.toFixed(4)}
                        </p>
                      </div>
                      <span className="ml-3 inline-flex items-center rounded-full bg-warn/10 px-2 py-0.5 text-xs font-bold tabular-nums text-warn">
                        {r.count} reports
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-slate-400">
                View these on the{" "}
                <Link href="/map" className="font-semibold text-brand-700 hover:underline">
                  map overview
                </Link>.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-center gap-2 pt-1">
          <DemoBadge isDemo />
          <p className="text-xs text-slate-400">
            Every chart is computed from stored issue rows — no fabricated values. Sample records are synthetic and labelled.
          </p>
        </div>
      </div>
    </div>
  );
}