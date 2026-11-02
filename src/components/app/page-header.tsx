"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { format } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge, toneToVariant } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/utils";
import { ROLE_META } from "@/lib/types";
import { useApp, useUnreadCount } from "@/components/app/app-context";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  const { profile, notifications, setNotifications } = useApp();
  const unread = useUnreadCount();
  const router = useRouter();
  const today = format(new Date(), "EEEE, MMMM d");

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
    } catch {
      /* best-effort */
    }
  };

  const openNotification = async (id: string, href?: string | null) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    } catch {
      /* best-effort */
    }
    if (href) router.push(href);
  };

  return (
    <div className="app-page-header flex flex-col gap-3 border-b px-5 py-4 md:flex-row md:items-center md:justify-between lg:px-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2.5">
        {actions}

        <div className="hidden items-center gap-2 rounded-md border bg-slate-50 px-3 py-1.5 text-sm text-slate-600 md:flex">
          <span className="font-medium">{today}</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="relative" aria-label="Notifications">
              <Bell className="h-[18px] w-[18px]" />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[min(20rem,calc(100vw-1rem))] p-0">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-semibold">Notifications</span>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto scrollbar-thin">
              {notifications.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-slate-500">You&apos;re all caught up.</p>
              ) : (
                notifications.slice(0, 12).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => openNotification(n.id, n.linkHref)}
                    className={`flex w-full flex-col gap-1 border-b px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-slate-50 ${
                      n.read ? "opacity-70" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />}
                      <span className="flex-1 text-sm font-medium text-slate-800">{n.title}</span>
                      <Badge variant={toneToVariant(n.kind === "alert" ? "danger" : n.kind === "verification" ? "warn" : "info")}>
                        {n.kind}
                      </Badge>
                    </div>
                    <p className="pl-3.5 text-xs text-slate-500">{n.body}</p>
                  </button>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <Link href="/settings" className="flex items-center gap-2 rounded-md p-1 hover:bg-slate-50">
          <Avatar className="h-8 w-8">
            <AvatarFallback style={{ backgroundColor: profile.avatarColor || "#1d4ed8" }}>
              {initials(profile.fullName)}
            </AvatarFallback>
          </Avatar>
          <div className="hidden text-left lg:block">
            <div className="text-sm font-medium leading-tight text-slate-900">{profile.fullName}</div>
            <div className="text-xs leading-tight text-slate-500">{ROLE_META[profile.role].label}</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
