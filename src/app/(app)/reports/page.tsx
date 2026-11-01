import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { RecentReports } from "@/components/dashboard/recent-reports";
import { Button } from "@/components/ui/button";
import { getStore } from "@/lib/db/store";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const store = await getStore();
  const issues = await store.getIssues();

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Reports"
        subtitle="Every community report, searchable and filterable in one place."
        actions={
          <Link href="/report">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> New report
            </Button>
          </Link>
        }
      />
      <div className="space-y-4 p-5 lg:p-8">
        <RecentReports issues={issues} pageSize={15} showViewAll={false} />
        <div className="flex items-center justify-center gap-2">
          <p className="text-xs text-slate-400">
            {issues.length === 0 ? (
              <>No reports yet. <Link href="/report" className="font-semibold text-brand-700 hover:underline">Submit the first one</Link>.</>
            ) : (
              <>Showing all {issues.length} stored reports. Sample records are labelled.</>
            )}
          </p>
          {issues.length === 0 && <FileText className="h-3.5 w-3.5 text-slate-300" />}
        </div>
      </div>
    </div>
  );
}