import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertTriangle, BellRing, Clock, UserX, Zap } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { AlertsQueue, type AlertType } from "@/components/alerts/alerts-queue";
import { NotificationFeed } from "@/components/alerts/notification-feed";
import { getCurrentProfile } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import { isApproachingSla, isOverdue, isResolvedish } from "@/lib/utils";
import { PRIORITY_META } from "@/lib/types";
import type { Issue, Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Alerts" };
export const dynamic = "force-dynamic";

const VALID_TYPES: AlertType[] = ["overdue", "unassigned", "breach", "reopened"];

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const store = await getStore();
  const [issues, notifications, staff] = await Promise.all([
    store.getIssues(),
    store.getNotifications(profile.id),
    store.getProfiles(),
  ]);

  const overdue = issues.filter((i) => isOverdue(i));
  const unassigned = issues.filter(
    (i) => !i.assignedToId && !isResolvedish(i.status) && PRIORITY_META[i.priority].rank >= 3
  );
  const breach = issues.filter((i) => isApproachingSla(i));
  const reopened = issues.filter((i) => i.status === "reopened");

  const buckets: Record<AlertType, Issue[]> = {
    overdue,
    unassigned,
    breach,
    reopened,
  };

  const requested = searchParams.type as AlertType | undefined;
  const active: AlertType = requested && VALID_TYPES.includes(requested) ? requested : "overdue";

  const total = VALID_TYPES.reduce((s, t) => s + buckets[t].length, 0);
  const unread = notifications.filter((n) => !n.read).length;

  const meta: Record<AlertType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
    overdue: { label: "Overdue", icon: Clock },
    unassigned: { label: "Unassigned high-priority", icon: UserX },
    breach: { label: "Nearing SLA breach", icon: Zap },
    reopened: { label: "Reopened", icon: AlertTriangle },
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Alerts"
        subtitle={
          total === 0
            ? "No SLA issues need attention right now."
            : `${total} item${total === 1 ? "" : "s"} need${total === 1 ? "s" : ""} attention across the queue.`
        }
      />
      <div className="grid gap-5 p-5 lg:grid-cols-3 lg:p-8">
        {/* Left: SLA attention queues */}
        <div className="space-y-4 lg:col-span-2">
          {/* Queue picker */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {VALID_TYPES.map((t) => {
              const Icon = meta[t].icon;
              const isActive = active === t;
              const count = buckets[t].length;
              const tone =
                t === "overdue"
                  ? "text-danger bg-danger/10"
                  : t === "unassigned"
                    ? "text-warn bg-warn/10"
                    : t === "breach"
                      ? "text-violet-600 bg-violet-50"
                      : "text-brand-700 bg-brand-50";
              return (
                <a
                  key={t}
                  href={`/alerts?type=${t}`}
                  className={`flex flex-col gap-2 rounded-xl border p-3 transition-colors ${isActive ? "border-brand-300 bg-brand-50/60 shadow-card" : "bg-white hover:bg-slate-50"}`}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-xl font-bold tabular-nums text-slate-900">{count}</span>
                  <span className="text-xs font-medium leading-tight text-slate-600">{meta[t].label}</span>
                </a>
              );
            })}
          </div>

          <AlertsQueue type={active} issues={buckets[active]} staffRole={profile.role} staff={staff} />

          {total === 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 px-4 py-4">
              <BellRing className="h-5 w-5 shrink-0 text-success" />
              <div>
                <p className="text-sm font-semibold text-slate-900">All clear</p>
                <p className="text-xs text-slate-500">
                  No overdue, unassigned high-priority, or SLA-breaching issues. Keep the loop moving.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right: notification feed */}
        <div className="space-y-4">
          <NotificationFeed notifications={notifications} />
          <div className="flex items-center justify-center gap-2">
            <p className="text-xs text-slate-400">
              {unread} unread notification{unread === 1 ? "" : "s"}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}