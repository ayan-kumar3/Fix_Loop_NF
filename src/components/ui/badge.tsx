import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/types";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-tight transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        destructive: "bg-destructive text-destructive-foreground",
        outline: "text-foreground border",
        success: "bg-success/10 text-success border border-success/20",
        warn: "bg-warn/10 text-warn border border-warn/20",
        danger: "bg-danger/10 text-danger border border-danger/20",
        info: "bg-brand-50 text-brand-700 border border-brand-100",
        neutral: "bg-slate-100 text-slate-600 border border-slate-200",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Map our semantic Tone to a badge variant. */
export function toneToVariant(tone: Tone): NonNullable<BadgeProps["variant"]> {
  switch (tone) {
    case "success":
      return "success";
    case "warn":
      return "warn";
    case "danger":
      return "danger";
    case "info":
      return "info";
    case "brand":
      return "info";
    default:
      return "neutral";
  }
}

export { Badge, badgeVariants };
