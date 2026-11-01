"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Clock,
  MoreHorizontal,
  UserPlus,
  Eye,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, toneToVariant } from "@/components/ui/badge";
import { StatusChip, PriorityChip } from "@/components/shared/issue-badges";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { assignIssue } from "@/lib/actions/issues";
import { toast } from "@/components/toaster";
import { PRIORITY_META, STATUS_META } from "@/lib/types";
import type { Issue, Profile } from "@/lib/types";
import { remainingLabel, isOverdue, isApproachingSla, cn } from "@/lib/utils";

export function HighPriorityList({
  issues,
  staff,
  total,
}: {
  issues: Issue[];
  staff: Profile[];
  total: number;
}) {
  const router = useRouter();
  const [assigning, setAssigning] = React.useState<string | null>(null);

  const handleAssign = async (issueId: string, assigneeId: string) => {
    setAssigning(issueId);
    const res = await assignIssue(issueId, assigneeId);
    setAssigning(null);
    if (res.ok) {
      toast({ title: "Assigned", description: res.message, variant: "success" });
      router.refresh();
    } else {
      toast({ title: "Could not assign", description: res.error, variant: "error" });
    }
  };

  return (
    <div className="flex h-full flex-col rounded-xl border bg-white shadow-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-slate-900">High-priority issues</h2>
          <Badge variant="danger">High</Badge>
        </div>
        <Link href="/reports" className="text-xs font-semibold text-brand-700 hover:underline">
          View all
        </Link>
      </div>

      <div className="flex-1 divide-y overflow-y-auto scrollbar-thin">
        {issues.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">No high-priority issues right now.</p>
        ) : (
          issues.map((issue) => {
            const overdue = isOverdue(issue);
            const breaching = isApproachingSla(issue);
            return (
              <div
                key={issue.id}
                className="group flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50"
                onClick={() => router.push(`/issues/${issue.id}`)}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    overdue ? "bg-danger/10 text-danger" : "bg-warn/10 text-warn"
                  )}
                >
                  <MapPin className="h-4 w-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{issue.title}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                    <span className="truncate">{issue.location.coordinates.lat.toFixed(4)}, {issue.location.coordinates.lng.toFixed(4)}</span>
                    <span className="text-slate-300">·</span>
                    <span className="truncate">{issue.location.address}</span>
                  </p>
                </div>

                <PriorityChip priority={issue.priority} className="hidden sm:inline-flex" />

                <span
                  className={cn(
                    "hidden w-20 items-center justify-end gap-1 text-xs font-medium tabular-nums md:flex",
                    overdue ? "text-danger" : breaching ? "text-warn" : "text-slate-500"
                  )}
                >
                  <Clock className="h-3.5 w-3.5" />
                  {remainingLabel(issue)}
                </span>

                <StatusChip status={issue.status} className="hidden lg:inline-flex" />

                {/* Assign */}
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" disabled={assigning === issue.id}>
                        {assigning === issue.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                        {issue.assignedToName ? issue.assignedToName.split(" ")[0] : "Assign"}
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Assign to</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {staff.length === 0 ? (
                        <DropdownMenuItem disabled>No field staff</DropdownMenuItem>
                      ) : (
                        staff.map((s) => (
                          <DropdownMenuItem key={s.id} onSelect={() => handleAssign(issue.id, s.id)}>
                            {s.fullName}
                          </DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="More actions">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/issues/${issue.id}`}>
                          <Eye className="h-4 w-4" /> View details
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/map?focus=${issue.id}`}>
                          <MapPin className="h-4 w-4" /> Show on map
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t px-4 py-2.5 text-xs text-slate-500">
        Showing <span className="font-semibold text-slate-700">{issues.length}</span> of{" "}
        <span className="font-semibold text-slate-700">{total}</span> high-priority issues
      </div>
    </div>
  );
}
