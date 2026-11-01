import Link from "next/link";
import { CircleDashed } from "lucide-react";
import { Badge, toneToVariant } from "@/components/ui/badge";
import { PRIORITY_META, STATUS_META } from "@/lib/types";
import type { IssuePriority, IssueStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusChip({ status, className }: { status: IssueStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <Badge variant={toneToVariant(meta.tone)} className={className}>
      {meta.label}
    </Badge>
  );
}

export function PriorityChip({ priority, className }: { priority: IssuePriority; className?: string }) {
  const meta = PRIORITY_META[priority];
  return (
    <Badge variant={toneToVariant(meta.tone)} className={className}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {meta.label}
    </Badge>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center", className)}>
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        {icon ?? <CircleDashed className="h-5 w-5" />}
      </div>
      <h3 className="mt-3 text-sm font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function DemoBadge({ isDemo }: { isDemo: boolean }) {
  if (!isDemo) return null;
  return (
    <span className="inline-flex items-center rounded border border-warn/30 bg-warn/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warn">
      Demo
    </span>
  );
}

export function IssueLink({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={`/issues/${id}`} className={cn("font-medium text-slate-900 hover:text-brand-700 hover:underline", className)}>
      {children}
    </Link>
  );
}
