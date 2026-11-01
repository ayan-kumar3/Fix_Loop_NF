"use client";

// Work-orders board: grouped list with quick status advancement. The server
// re-validates every transition — this component only offers affordances the
// signed-in role is allowed to use.

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  Search,
  ChevronRight,
  Loader2,
  UserCog,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, toneToVariant } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/issue-badges";
import { toast } from "@/components/toaster";
import { updateWorkOrderStatus } from "@/lib/actions/issues";
import { WORK_ORDER_NEXT, canSetWorkStatus, allowedNextStatuses } from "@/lib/work-orders";
import { WORK_ORDER_META } from "@/lib/types";
import type { UserRole, WorkOrder, WorkOrderStatus } from "@/lib/types";
import { formatDateShort, truncate, cn } from "@/lib/utils";

const STATUS_FILTERS: Array<{ value: WorkOrderStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "unassigned", label: "Unassigned" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "in_progress", label: "In Progress" },
  { value: "submitted_for_verification", label: "Pending Verification" },
  { value: "completed", label: "Completed" },
];

export function WorkOrdersBoard({
  orders,
  role,
}: {
  orders: WorkOrder[];
  role: UserRole;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<WorkOrderStatus | "all">("all");
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (!q) return true;
      return (
        o.title.toLowerCase().includes(q) ||
        (o.assignedToName ?? "").toLowerCase().includes(q) ||
        (o.teamName ?? "").toLowerCase().includes(q)
      );
    });
  }, [orders, query, status]);

  const counts = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) map.set(o.status, (map.get(o.status) ?? 0) + 1);
    return map;
  }, [orders]);

  const advance = async (wo: WorkOrder) => {
    const next = WORK_ORDER_NEXT[wo.status];
    if (!next || !canSetWorkStatus(role, next)) return;
    setBusyId(wo.id);
    const res = await updateWorkOrderStatus(wo.id, next);
    setBusyId(null);
    if (res.ok) {
      toast({ title: "Work order updated", description: res.message, variant: "success" });
      router.refresh();
    } else {
      toast({ title: "Could not update", description: res.error, variant: "error" });
    }
  };

  const now = Date.now();

  return (
    <div className="rounded-xl border bg-white shadow-card">
      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search work orders…"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as WorkOrderStatus | "all")}>
          <SelectTrigger className="h-9 w-full text-sm sm:w-[220px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
                {f.value !== "all" && counts.get(f.value) ? ` (${counts.get(f.value)})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title="No work orders match"
          description={
            orders.length === 0
              ? "Work orders are created automatically when an administrator assigns an issue."
              : "Try a different search or status filter."
          }
        />
      ) : (
        <ul className="divide-y">
          {filtered.map((wo) => {
            const overdue = new Date(wo.dueAt).getTime() < now && wo.status !== "completed";
            const next = WORK_ORDER_NEXT[wo.status];
            const nextAllowed = next ? canSetWorkStatus(role, next) : false;
            const alternatives = allowedNextStatuses(role, wo.status);
            return (
              <li key={wo.id} className="flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-slate-50/70 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/issues/${wo.issueId}`}
                      className="truncate text-sm font-semibold text-slate-900 hover:text-brand-700 hover:underline"
                    >
                      {truncate(wo.title, 64)}
                    </Link>
                    <Badge variant={toneToVariant(WORK_ORDER_META[wo.status].tone)}>
                      {WORK_ORDER_META[wo.status].label}
                    </Badge>
                    <Badge variant={toneToVariant(wo.priority === "Critical" || wo.priority === "High" ? "danger" : wo.priority === "Medium" ? "warn" : "neutral")}>
                      {wo.priority}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    {wo.assignedToName ? (
                      <span className="inline-flex items-center gap-1">
                        <UserCog className="h-3.5 w-3.5" /> {wo.assignedToName}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-warn">
                        <UserCog className="h-3.5 w-3.5" /> Unassigned
                      </span>
                    )}
                    {wo.teamName && <span className="text-slate-400">· {wo.teamName}</span>}
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 tabular-nums",
                        overdue ? "font-semibold text-danger" : "text-slate-400"
                      )}
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      Due {formatDateShort(wo.dueAt)}{overdue ? " · overdue" : ""}
                    </span>
                  </div>
                  {wo.notes.length > 0 && (
                    <p className="mt-1 truncate text-xs text-slate-400">
                      Latest note: “{truncate(wo.notes[wo.notes.length - 1].body, 90)}”
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {next && (
                    <Button
                      size="sm"
                      variant={next === "completed" ? "default" : "outline"}
                      className="h-8 gap-1.5 text-xs"
                      disabled={!nextAllowed || busyId === wo.id}
                      onClick={() => advance(wo)}
                    >
                      {busyId === wo.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : next === "completed" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                      {next === "completed" ? "Mark completed" : `Move to ${WORK_ORDER_META[next].label}`}
                    </Button>
                  )}
                  {!nextAllowed && alternatives.length > 0 && (
                    <span className="text-[11px] text-slate-400">Waiting on another role</span>
                  )}
                  <Button asChild size="sm" variant="ghost" className="h-8 text-xs">
                    <Link href={`/issues/${wo.issueId}`}>Open issue</Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t px-4 py-2.5 text-xs text-slate-500">
        {filtered.length} of {orders.length} work order{orders.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}
