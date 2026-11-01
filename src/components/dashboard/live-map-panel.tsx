"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Expand } from "lucide-react";
import { IssueMap } from "@/components/map/issue-map";
import type { MapIssue } from "@/components/map/leaflet-map";

const LEGEND = [
  { color: "#ef4444", label: "High / Critical" },
  { color: "#f59e0b", label: "Medium" },
  { color: "#3b82f6", label: "Low" },
  { color: "#16a34a", label: "Resolved" },
];

export function LiveMapPanel({ issues, center }: { issues: MapIssue[]; center: [number, number] }) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<string | null>(null);

  const onSelect = (id: string) => {
    setSelected(id);
    router.push(`/issues/${id}`);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-white shadow-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-bold text-slate-900">Live map</h2>
        <Link href="/map" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
          <Expand className="h-3.5 w-3.5" /> View full map
        </Link>
      </div>
      <div className="relative min-h-[280px] flex-1">
        <IssueMap
          issues={issues}
          center={center}
          zoom={15}
          theme="light"
          selectedId={selected}
          onSelect={onSelect}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2 text-[11px] text-slate-500">
        {LEGEND.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
