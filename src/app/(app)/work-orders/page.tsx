import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { WorkOrdersBoard } from "@/components/work-orders/work-orders-board";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Work Orders" };
export const dynamic = "force-dynamic";

export default async function WorkOrdersPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const store = await getStore();
  const orders = await store.getWorkOrders();
  orders.sort((a, b) => {
    const done = Number(a.status === "completed") - Number(b.status === "completed");
    if (done !== 0) return done;
    return +new Date(a.dueAt) - +new Date(b.dueAt);
  });

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Work Orders"
        subtitle="Track field assignments from acknowledgement through community verification."
        actions={
          <Link href="/reports">
            <Button size="sm" variant="outline" className="gap-1.5">
              <ClipboardList className="h-4 w-4" /> Find an issue
            </Button>
          </Link>
        }
      />
      <div className="space-y-4 p-5 lg:p-8">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-white px-6 py-14 text-center text-sm text-slate-500">
            <ClipboardList className="h-10 w-10 text-slate-300" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">No work orders yet</h3>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                Work orders are created automatically when an administrator assigns a report to a
                field team. Start by reviewing unassigned reports.
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/report">
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" /> Submit a report
                </Button>
              </Link>
              <Link href="/alerts?type=unassigned">
                <Button size="sm" variant="outline">Review unassigned</Button>
              </Link>
            </div>
          </div>
        ) : (
          <WorkOrdersBoard orders={orders} role={profile.role} />
        )}
        <p className="text-xs text-slate-400 mt-4">
          Status actions are limited by your role. Every transition is re-validated on the server.
        </p>
      </div>
    </div>
  );
}