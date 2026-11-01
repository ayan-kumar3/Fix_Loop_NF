"use client";

// Analytics charts built with Recharts. All inputs are computed server-side
// from stored rows — nothing here invents numbers.

import * as React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { STATUS_META } from "@/lib/types";
import type { CategoryCount, Hotspot, StatusCount, TimeSeriesPoint } from "@/lib/types";
import { EmptyState } from "@/components/shared/issue-badges";

const CATEGORY_COLORS = [
  "#1d4ed8", "#0ea5e9", "#f59e0b", "#16a34a", "#dc2626", "#7c3aed", "#0d9488", "#db2777",
];
const STATUS_COLORS: Record<string, string> = {
  submitted: "#64748b",
  under_review: "#0ea5e9",
  assigned: "#2563eb",
  in_progress: "#f59e0b",
  resolved_pending_verification: "#f97316",
  verified_resolved: "#16a34a",
  reopened: "#dc2626",
  rejected: "#475569",
};

const tooltipStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  fontSize: 12,
  color: "#0f172a",
  boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
};

export function ReportsOverTimeChart({ series }: { series: TimeSeriesPoint[] }) {
  const data = series.map((p) => ({
    ...p,
    label: new Date(p.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }));
  const total = series.reduce((s, p) => s + p.count, 0);

  if (total === 0) {
    return (
      <EmptyState
        title="No reports in this window"
        description="Once reports start coming in, the daily volume chart appears here."
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="reportsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "#cbd5e1" }} />
        <Area type="monotone" dataKey="count" name="Reports" stroke="#1d4ed8" strokeWidth={2} fill="url(#reportsFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CategoryDistributionChart({ data }: { data: CategoryCount[] }) {
  if (data.length === 0) {
    return <EmptyState title="No category data yet" description="Category breakdown appears once issues are stored." />;
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="category" width={130} tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="count" name="Issues" radius={[0, 6, 6, 0]} barSize={18}>
          {data.map((entry, idx) => (
            <Cell key={entry.category} fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatusDistributionChart({ data }: { data: StatusCount[] }) {
  if (data.length === 0) {
    return <EmptyState title="No status data yet" description="Lifecycle breakdown appears once issues are stored." />;
  }
  const pie = data.map((d) => ({
    name: STATUS_META[d.status].label,
    value: d.count,
    fill: STATUS_COLORS[d.status] ?? "#64748b",
  }));
  return (
    <div className="flex flex-col items-center gap-2 sm:flex-row">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={pie} dataKey="value" nameKey="name" innerRadius={52} outerRadius={86} paddingAngle={2}>
            {pie.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value: string) => <span style={{ fontSize: 11, color: "#475569" }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HotspotsChart({ hotspots }: { hotspots: Hotspot[] }) {
  if (hotspots.length === 0) {
    return <EmptyState title="No hotspot data yet" description="Area-level hotspot ranking appears once issues have locations." />;
  }
  const data = hotspots.slice(0, 6).map((h) => ({ area: h.area, count: h.count }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="area" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="count" name="Issues" fill="#1d4ed8" radius={[6, 6, 0, 0]} barSize={34} />
      </BarChart>
    </ResponsiveContainer>
  );
}
