"use client";

// Lightweight toast system — no external dependency. A module-level store is
// subscribed to by <Toaster /> via useSyncExternalStore. Call toast() from
// anywhere (client components) to surface success / error feedback.

import * as React from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "error" | "info";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
}

let toasts: Toast[] = [];
let listeners: Array<(t: Toast[]) => void> = [];
let seq = 0;

function emit() {
  const snapshot = [...toasts];
  for (const l of listeners) l(snapshot);
}

function subscribe(cb: (t: Toast[]) => void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

function getSnapshot() {
  return toasts;
}

export function toast(input: Omit<Toast, "id">) {
  seq += 1;
  const id = `t_${seq}`;
  toasts = [...toasts, { ...input, id }];
  emit();
  const ttl = input.variant === "error" ? 6000 : 4000;
  setTimeout(() => dismissToast(id), ttl);
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

const ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-success" />,
  error: <AlertCircle className="h-5 w-5 text-danger" />,
  info: <Info className="h-5 w-5 text-brand-600" />,
  default: <Info className="h-5 w-5 text-slate-500" />,
};

export function Toaster() {
  const items = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
    >
      {items.map((t) => {
        const variant = t.variant ?? "default";
        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto w-full overflow-hidden rounded-lg border bg-white p-3.5 shadow-panel animate-in slide-in-from-right-full",
              variant === "error" && "border-danger/30",
              variant === "success" && "border-success/30"
            )}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">{ICONS[variant]}</div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">{t.title}</p>
                {t.description && <p className="mt-0.5 text-xs text-slate-500">{t.description}</p>}
              </div>
              <button
                onClick={() => dismissToast(t.id)}
                className="shrink-0 rounded p-1 text-slate-400 transition-colors hover:text-slate-600"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
