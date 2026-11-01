"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  SlidersHorizontal,
  X,
  MapPin,
  Clock,
  ArrowRight,
  Layers,
  List,
  Map as MapIcon,
  ChevronLeft,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge, toneToVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IssueMap } from "@/components/map/issue-map";
import type { MapIssue } from "@/components/map/leaflet-map";
import { PRIORITY_META, STATUS_META, ISSUE_CATEGORIES } from "@/lib/types";
import type { IssueCategory, IssuePriority, IssueStatus } from "@/lib/types";
import { formatDateTime, formatDistanceShort, cn } from "@/lib/utils";

const STATUS_FILTERS: Array<{ value: IssueStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "submitted", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "verified_resolved", label: "Resolved" },
];

const PRIORITY_FILTERS: Array<{ value: IssuePriority | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "Critical", label: "Critical" },
  { value: "High", label: "High" },
  { value: "Medium", label: "Medium" },
  { value: "Low", label: "Low" },
];

export function MapWorkspace({
  issues,
  initialFocusId,
}: {
  issues: MapIssue[];
  initialFocusId?: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<IssueCategory | "all">("all");
  const [status, setStatus] = React.useState<IssueStatus | "all">("all");
  const [priority, setPriority] = React.useState<IssuePriority | "all">("all");
  const [showFilters, setShowFilters] = React.useState(false);

  const [selectedId, setSelectedId] = React.useState<string | null>(initialFocusId ?? null);
  const [focusCenter, setFocusCenter] = React.useState<[number, number] | null>(null);
  const [mobileView, setMobileView] = React.useState<"list" | "map">("map");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return issues.filter((i) => {
      if (category !== "all" && i.category !== category) return false;
      if (priority !== "all" && i.priority !== priority) return false;
      if (status !== "all") {
        if (status === "verified_resolved") {
          if (i.status !== "verified_resolved" && i.status !== "resolved_pending_verification") return false;
        } else if (i.status !== status) return false;
      }
      if (!q) return true;
      return (
        i.title.toLowerCase().includes(q) ||
        i.publicId.toLowerCase().includes(q) ||
        i.address.toLowerCase().includes(q)
      );
    });
  }, [issues, query, category, status, priority]);

  const selected = React.useMemo(() => filtered.find((i) => i.id === selectedId) ?? issues.find((i) => i.id === selectedId) ?? null, [filtered, issues, selectedId]);

  const selectFromList = (issue: MapIssue) => {
    setSelectedId(issue.id);
    setFocusCenter([issue.coordinates.lat, issue.coordinates.lng]);
    setMobileView("map");
  };

  const onMarkerSelect = (id: string) => {
    setSelectedId(id);
    const issue = issues.find((i) => i.id === id);
    if (issue) setFocusCenter([issue.coordinates.lat, issue.coordinates.lng]);
  };

  const activeFilterCount = (category !== "all" ? 1 : 0) + (status !== "all" ? 1 : 0) + (priority !== "all" ? 1 : 0);

  const defaultCenter: [number, number] = issues[0]
    ? [issues[0].coordinates.lat, issues[0].coordinates.lng]
    : [28.6139, 77.209];

  return (
    <div className="flex h-full min-h-[60vh] flex-col bg-navy-950 lg:flex-row">
      {/* ---- Left panel ---- */}
      <aside
        className={cn(
          "flex flex-col border-r border-white/10 bg-navy-950 text-slate-200",
          mobileView === "map" ? "hidden lg:flex" : "flex",
          "w-full lg:w-[360px] lg:shrink-0"
        )}
      >
        <div className="border-b border-white/10 p-3">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-300 hover:bg-white/10"
              aria-label="Back to dashboard"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by ID, type or street…"
                className="h-9 border-white/10 bg-white/5 pl-8 text-sm text-white placeholder:text-slate-500 focus-visible:ring-brand-500"
              />
              {query && (
                <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-md border",
                showFilters || activeFilterCount > 0
                  ? "border-brand-500 bg-brand-500/20 text-brand-300"
                  : "border-white/10 text-slate-300 hover:bg-white/10"
              )}
              aria-label="Filters"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>

          {showFilters && (
            <div className="mt-3 space-y-3">
              <FilterGroup label="Category">
                <FilterChip active={category === "all"} onClick={() => setCategory("all")}>All</FilterChip>
                {ISSUE_CATEGORIES.map((c) => (
                  <FilterChip key={c} active={category === c} onClick={() => setCategory(c)}>{c}</FilterChip>
                ))}
              </FilterGroup>
              <FilterGroup label="Status">
                {STATUS_FILTERS.map((s) => (
                  <FilterChip key={s.value} active={status === s.value} onClick={() => setStatus(s.value)}>{s.label}</FilterChip>
                ))}
              </FilterGroup>
              <FilterGroup label="Priority">
                {PRIORITY_FILTERS.map((p) => (
                  <FilterChip key={p.value} active={priority === p.value} onClick={() => setPriority(p.value)}>{p.label}</FilterChip>
                ))}
              </FilterGroup>
              {activeFilterCount > 0 && (
                <button
                  onClick={() => { setCategory("all"); setStatus("all"); setPriority("all"); }}
                  className="text-xs font-medium text-brand-300 hover:underline"
                >
                  Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-400">
          <span>{filtered.length} issue{filtered.length === 1 ? "" : "s"}</span>
          <span className="inline-flex items-center gap-1"><Layers className="h-3 w-3" /> Live</span>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-slate-500">No issues match your filters.</p>
          ) : (
            <ul className="space-y-1.5">
              {filtered.map((issue) => (
                <li key={issue.id}>
                  <button
                    onClick={() => selectFromList(issue)}
                    className={cn(
                      "flex w-full gap-3 rounded-lg border p-2 text-left transition-colors",
                      issue.id === selectedId ? "border-brand-500 bg-brand-500/15" : "border-white/5 bg-white/5 hover:bg-white/10"
                    )}
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-white/10">
                      {issue.thumbnailUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={issue.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{issue.title}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                        <span className="font-mono">{issue.publicId}</span>
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-400">
                        <MapPin className="h-3 w-3 shrink-0" /> {issue.address}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant={toneToVariant(PRIORITY_META[issue.priority].tone)}>{issue.priority}</Badge>
                        <span className="text-[11px] text-slate-500">{formatDistanceShort(issue.createdAt)}</span>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* ---- Map area ---- */}
      <div className={cn("relative flex-1", mobileView === "list" ? "hidden lg:block" : "block")}>
        <IssueMap
          issues={filtered}
          center={focusCenter ?? defaultCenter}
          zoom={focusCenter ? 17 : 15}
          theme="dark"
          selectedId={selectedId}
          onSelect={onMarkerSelect}
        />

        {/* Mobile view toggle */}
        <div className="absolute left-1/2 top-3 z-[1000] flex -translate-x-1/2 gap-1 rounded-lg bg-navy-900/90 p-1 lg:hidden">
          <button
            onClick={() => setMobileView("map")}
            className={cn("flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium", mobileView === "map" ? "bg-brand-600 text-white" : "text-slate-300")}
          >
            <MapIcon className="h-3.5 w-3.5" /> Map
          </button>
          <button
            onClick={() => setMobileView("list")}
            className={cn("flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium", mobileView === "list" ? "bg-brand-600 text-white" : "text-slate-300")}
          >
            <List className="h-3.5 w-3.5" /> List
          </button>
        </div>

        {/* Floating selected issue card */}
        {selected && (
          <div className="absolute bottom-4 left-1/2 z-[1000] w-[calc(100%-2rem)] max-w-xs -translate-x-1/2 overflow-hidden rounded-xl bg-navy-900 shadow-2xl lg:left-4 lg:translate-x-0">
            <button
              onClick={() => setSelectedId(null)}
              className="absolute right-2 top-2 z-10 rounded-full bg-black/50 p-1 text-white hover:bg-black"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            {selected.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.thumbnailUrl} alt="" className="h-28 w-full object-cover" />
            )}
            <div className="p-3">
              <div className="flex items-center gap-1.5">
                <Badge variant={toneToVariant(PRIORITY_META[selected.priority].tone)}>{selected.priority}</Badge>
                <Badge variant={toneToVariant(STATUS_META[selected.status].tone)}>{STATUS_META[selected.status].label}</Badge>
              </div>
              <h3 className="mt-1.5 text-sm font-bold text-white">{selected.title}</h3>
              <p className="text-xs text-slate-400">{selected.publicId}</p>
              <div className="mt-2 space-y-1 text-xs text-slate-300">
                <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-slate-500" /> {selected.address}</p>
                <p className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-slate-500" /> {formatDateTime(selected.createdAt)}</p>
              </div>
              <Button asChild className="mt-3 w-full" size="sm">
                <Link href={`/issues/${selected.id}`}>
                  View Details <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active ? "border-brand-500 bg-brand-600 text-white" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
      )}
    >
      {children}
    </button>
  );
}
