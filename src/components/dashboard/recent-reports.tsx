"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusChip, PriorityChip } from "@/components/shared/issue-badges";
import { ageLabel, formatDateTime, truncate, cn } from "@/lib/utils";
import { ISSUE_CATEGORIES, ISSUE_STATUSES, ISSUE_PRIORITIES, STATUS_META } from "@/lib/types";
import type { Issue } from "@/lib/types";

type SortKey = "title" | "createdAt" | "priority" | "status";

const PAGE_SIZE = 8;

export function RecentReports({
  issues,
  pageSize = PAGE_SIZE,
  showViewAll = true,
}: {
  issues: Issue[];
  pageSize?: number;
  showViewAll?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [sortKey, setSortKey] = React.useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [page, setPage] = React.useState(1);
  const PAGE = pageSize;

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = issues.filter((i) => {
      if (category !== "all" && i.category !== category) return false;
      if (status !== "all" && i.status !== status) return false;
      if (!q) return true;
      return (
        i.title.toLowerCase().includes(q) ||
        i.publicId.toLowerCase().includes(q) ||
        i.location.address.toLowerCase().includes(q)
      );
    });

    const prioRank = (p: Issue["priority"]) => ({ Critical: 4, High: 3, Medium: 2, Low: 1 })[p];
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "title") cmp = a.title.localeCompare(b.title);
      else if (sortKey === "createdAt") cmp = +new Date(a.createdAt) - +new Date(b.createdAt);
      else if (sortKey === "priority") cmp = prioRank(a.priority) - prioRank(b.priority);
      else cmp = STATUS_META[a.status].label.localeCompare(STATUS_META[b.status].label);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [issues, query, category, status, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE, safePage * PAGE);

  React.useEffect(() => {
    setPage(1);
  }, [query, category, status, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "title" ? "asc" : "desc");
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const statusTabs: Array<{ value: string; label: string; count: number }> = [
    { value: "all", label: "All", count: issues.length },
    ...ISSUE_STATUSES.filter((s) => issues.some((i) => i.status === s)).map((s) => ({
      value: s,
      label: STATUS_META[s].label,
      count: issues.filter((i) => i.status === s).length,
    })),
  ];

  return (
    <div className="rounded-xl border bg-white shadow-card">
      <div className="flex flex-col gap-3 border-b px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">Recent reports</h2>
            <span className="rounded-full bg-brand-700 px-2 py-0.5 text-[11px] font-semibold text-white">
              {filtered.length}
            </span>
          </div>
          {showViewAll && (
            <Link href="/reports" className="text-xs font-semibold text-brand-700 hover:underline">
              View all
            </Link>
          )}
        </div>

        {/* Status quick tabs */}
        <div className="flex flex-wrap gap-1.5">
          {statusTabs.map((t) => (
            <button
              key={t.value}
              onClick={() => setStatus(t.value)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                status === t.value ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {t.label}
              {t.value === "all" ? ` ${t.count}` : ` ${t.count}`}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search issue, ID or location…"
              className="h-8 pl-8 text-sm"
            />
          </div>

          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-8 w-[160px] text-sm">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {ISSUE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>
              <button onClick={() => toggleSort("title")} className="inline-flex items-center gap-1 hover:text-slate-700">
                Issue <SortIcon k="title" />
              </button>
            </TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>
              <button onClick={() => toggleSort("status")} className="inline-flex items-center gap-1 hover:text-slate-700">
                Status <SortIcon k="status" />
              </button>
            </TableHead>
            <TableHead>
              <button onClick={() => toggleSort("priority")} className="inline-flex items-center gap-1 hover:text-slate-700">
                Priority <SortIcon k="priority" />
              </button>
            </TableHead>
            <TableHead>
              <button onClick={() => toggleSort("createdAt")} className="inline-flex items-center gap-1 hover:text-slate-700">
                Reported <SortIcon k="createdAt" />
              </button>
            </TableHead>
            <TableHead>Age</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-10 text-center text-sm text-slate-500">
                No reports match your filters.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((i) => (
              <TableRow
                key={i.id}
                className="cursor-pointer"
                onClick={() => router.push(`/issues/${i.id}`)}
              >
                <TableCell>
                  <div className="max-w-[240px]">
                    <div className="truncate text-sm font-medium text-slate-900">{truncate(i.title, 48)}</div>
                    <div className="text-xs text-slate-400">{i.publicId}</div>
                  </div>
                </TableCell>
                <TableCell className="max-w-[160px]">
                  <div className="truncate text-sm text-slate-600">{i.location.address}</div>
                  <div className="text-xs text-slate-400">{i.location.area}</div>
                </TableCell>
                <TableCell className="text-sm text-slate-600">{i.category}</TableCell>
                <TableCell>
                  <StatusChip status={i.status} />
                </TableCell>
                <TableCell>
                  <PriorityChip priority={i.priority} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-slate-500" title={formatDateTime(i.createdAt)}>
                  {formatDateTime(i.createdAt).replace(" at ", ", ")}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm font-medium tabular-nums text-slate-600">
                  {ageLabel(i)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between border-t px-4 py-2.5">
        <p className="text-xs text-slate-500">
          {filtered.length === 0 ? "0" : (safePage - 1) * PAGE + 1}–
          {Math.min(safePage * PAGE, filtered.length)} of {filtered.length}
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-1 text-xs font-medium tabular-nums text-slate-600">
            {safePage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
