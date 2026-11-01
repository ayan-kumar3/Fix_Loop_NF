"use client";

// SLA attention queue: lists the issues behind a selected alert bucket with
// inline assignment (administrators) so an operator can act without leaving
// the page.

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Loader2, MapPin, UserPlus, ChevronDown, Eye, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusChip, PriorityChip, EmptyState } from "@/components/shared/issue-badges";
import { toast } from "@/components/toaster";
import { assignIssue } from "@/lib/actions/issues";
import type { Issue, Profile, UserRole } from "@/lib/types";
import { remainingLabel, truncate, cn } from "@/lib/utils";

export type AlertType = "overdue" | "unassigned" | "breach" | "reopened";

const COPY: Record<AlertType, { title: string; description: string; icon: React.ReactNode }> = {
  overdue: {
    title: "Overdue issues",
    description: "Past their SLA deadline and still open. Escalate or reassign.",
    icon: <Clock className="h-5 w-5" />,
  },
  unassigned: {
    title: "Unassigned high-priority issues",
    description: "No owner yet — the response clock can't start until someone is assigned.",
    icon: <UserPlus className="h-5 w-5" />,
  },
  breach: {
    title: "Nearing SLA breach",
    description: "Less than 25% of the SLA window remains. Act now to stay inside target.",
    icon: <Clock className="h-5 w-5" />,
  },
  reopened: {
    title: "Reopened issues",
    description: "The community disputed a resolution. These need re-investigation.",
    icon: <CheckCircle2 className="h-5 w-5" />,
  },
};

export function AlertsQueue({
  type,
  issues,
  staffRole,
  staff,
}: {
  type: AlertType;
  issues: Issue[];
  staffRole: UserRole;
  staff: Profile[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const handleAssign = async (issueId: string, assigneeId: string) => {
    setBusyId(issueId);
    const res = await assignIssue(issueId, assigneeId);
    setBusyId(null);
    if (res.ok) {
      toast({ title: "Assigned", description: res.message, variant: "success" });
      router.refresh();
    } else {
      toast({ title: "Could not assign", description: res.error, variant: "error" });
    }
  };

  const copy = COPY[type];

  return (
    <div className="flex flex-col rounded-xl border bg-white shadow-card">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          {copy.icon}
        </span>
        <div>
          <h2 className="text-sm font-bold text-slate-900">{copy.title}</h2>
          <p className="text-xs text-slate-500">{copy.description}</p>
        </div>
        <span className="ml-auto rounded-full bg-slate-900 px-2 py-0.5 text-xs font-bold tabular-nums text-white">
          {issues.length}
        </span>
      </div>

      {issues.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-5 w-5 text-success" />}
          title="Nothing in this queue"
          description="No issues currently match this alert type."
        />
      ) : (
        <ul className="divide-y">
          {issues.map((issue) => (
            <li
              key={issue.id}
              className="flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center"
            >
              <Link href={`/issues/${issue.id}`} className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold text-slate-900 hover:text-brand-700">
                    {truncate(issue.title, 64)}
                  </span>
                  <PriorityChip priority={issue.priority} />
                  <StatusChip status={issue.status} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 text-slate-400">
                    <MapPin className="h-3.5 w-3.5" /> {truncate(issue.location.address, 40)}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 font-medium tabular-nums",
                      remainingLabel(issue).includes("overdue") ? "text-danger" : "text-slate-500"
                    )}
                  >
                    <Clock className="h-3.5 w-3.5" /> {remainingLabel(issue)}
                  </span>
                  <span className="text-slate-400">
                    {issue.assignedToName ? `Owner: ${issue.assignedToName}` : "No owner"}
                  </span>
                </div>
              </Link>

              <div className="flex shrink-0 items-center gap-2">
                {staffRole === "administrator" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        disabled={busyId === issue.id}
                      >
                        {busyId === issue.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UserPlus className="h-3.5 w-3.5" />
                        )}
                        {issue.assignedToName ? "Reassign" : "Assign"}
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Assign to</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {staff.length === 0 ? (
                        <DropdownMenuItem disabled>No field staff available</DropdownMenuItem>
                      ) : (
                        staff.map((s) => (
                          <DropdownMenuItem key={s.id} onSelect={() => handleAssign(issue.id, s.id)}>
                            {s.fullName}
                          </DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <Button asChild size="sm" variant="ghost" className="h-8 gap-1 text-xs">
                  <Link href={`/issues/${issue.id}`}>
                    <Eye className="h-3.5 w-3.5" /> Open
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
