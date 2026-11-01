import Link from "next/link";
import { AlertTriangle, UserPlus, Timer, Zap, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AttentionCard } from "@/lib/types";

const ICONS: Record<AttentionCard["key"], React.ComponentType<{ className?: string }>> = {
  overdue: AlertTriangle,
  unassigned_high: UserPlus,
  sla_breach: Timer,
};

const ACTION_TONES: Record<AttentionCard["key"], string> = {
  overdue: "bg-danger text-white hover:bg-danger/90",
  unassigned_high: "bg-warn text-white hover:bg-warn/90",
  sla_breach: "bg-brand-700 text-white hover:bg-brand-800",
};

export function AttentionPanel({ cards, totalItems }: { cards: AttentionCard[]; totalItems: number }) {
  return (
    <section className="rounded-xl border border-warn/25 bg-gradient-to-b from-warn/10 to-warn/5 p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-warn text-white">
          <Zap className="h-4 w-4" />
        </span>
        <h2 className="text-sm font-bold text-slate-900">Needs Attention</h2>
        <Badge variant="warn" className="uppercase tracking-wide">
          Action required
        </Badge>
        <span className="ml-auto text-xs font-medium text-slate-500">
          {totalItems} item{totalItems === 1 ? "" : "s"} need action right now
        </span>
      </div>

      {cards.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-warn/30 bg-white/60 px-4 py-6 text-center">
          <p className="text-sm font-medium text-slate-600">Nothing needs immediate attention. Nice work.</p>
        </div>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {cards.map((card) => {
            const Icon = ICONS[card.key];
            return (
              <div
                key={card.key}
                className="flex flex-col rounded-lg border border-warn/20 bg-white p-3.5 shadow-sm"
              >
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-danger/10 text-danger">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{card.heading}</p>
                    <span className="mt-1 inline-flex items-center gap-1 rounded border border-warn/30 bg-warn/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warn">
                      {card.badge}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">{card.subheading}</p>
                <Link
                  href={card.actionHref}
                  className={cn(
                    "mt-3 inline-flex w-fit items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                    ACTION_TONES[card.key]
                  )}
                >
                  {card.actionLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
