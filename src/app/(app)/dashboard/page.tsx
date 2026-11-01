import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { AttentionPanel } from "@/components/dashboard/attention-panel";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { HighPriorityList } from "@/components/dashboard/high-priority-list";
import { LiveMapPanel } from "@/components/dashboard/live-map-panel";
import { RecentReports } from "@/components/dashboard/recent-reports";
import { DemoBadge } from "@/components/shared/issue-badges";
import { getDashboardData } from "@/lib/queries";

export const metadata: Metadata = { title: "Operations Center" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Operations Center"
        subtitle="Here's what's happening in your community today."
      />

      <div className="space-y-5 p-5 lg:p-8">
        {/* Section 1 — Needs Attention */}
        <AttentionPanel cards={data.attention} totalItems={data.attentionTotal} />

        {/* Section 2 — KPI cards */}
        <KpiCards metrics={data.metrics} />

        {/* Section 3 + 4 — High priority + Live map */}
        <div className="grid gap-5 xl:grid-cols-2">
          <HighPriorityList issues={data.highPriority} staff={data.staff} total={data.highPriority.length} />

          <LiveMapPanel issues={data.mapIssues} center={data.center} />
        </div>

        {/* Section 5 — Recent reports */}
        <RecentReports issues={data.recent} />

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