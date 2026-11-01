"use client";

// Full notification feed for the Alerts page — reads via the shared API routes
// so state stays consistent with the header dropdown.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Badge, toneToVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app/app-context";
import { formatDistanceShort } from "@/lib/utils";

export function NotificationFeed({ notifications }: { notifications: import("@/lib/types").Notification[] }) {
  const { notifications: live, setNotifications } = useApp();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  // Prefer live client state (updated optimistically) over the server snapshot.
  const items = live.length > 0 || notifications.length === 0 ? live : notifications;

  const markAll = async () => {
    setBusy(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
    } catch {
      /* best-effort */
    }
    setBusy(false);
    router.refresh();
  };

  const open = async (id: string, href?: string | null) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    } catch {
      /* best-effort */
    }
    if (href) router.push(href);
  };

  const toneFor = (kind: string) =>
    kind === "alert" ? "danger" : kind === "verification" ? "warn" : kind === "assignment" ? "info" : "neutral";

  return (
    <div className="flex flex-col rounded-xl border bg-white shadow-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-bold text-slate-900">Notifications</h2>
        </div>
        {items.some((n) => !n.read) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-brand-700"
            onClick={markAll}
            disabled={busy}
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
            Mark all read
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-500">
          You&apos;re all caught up. New assignments, verifications and alerts will appear here.
        </p>
      ) : (
        <ul className="max-h-[560px] divide-y overflow-y-auto scrollbar-thin">
          {items.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => open(n.id, n.linkHref)}
                className={`flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                  n.read ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />}
                  <span className="flex-1 text-sm font-semibold text-slate-800">{n.title}</span>
                  <Badge variant={toneToVariant(toneFor(n.kind))}>{n.kind}</Badge>
                </div>
                <p className="pl-3.5 text-xs leading-relaxed text-slate-500">{n.body}</p>
                <span className="pl-3.5 text-[11px] text-slate-400">{formatDistanceShort(n.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
