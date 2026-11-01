"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Map,
  FileText,
  ClipboardList,
  BellRing,
  BarChart3,
  Users,
  UserCog,
  Settings,
  LogOut,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";
import { LogoMark } from "@/components/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_META } from "@/lib/types";
import { toneToVariant, Badge } from "@/components/ui/badge";
import { logout } from "@/lib/actions/auth";
import { useApp, useUnreadCount } from "@/components/app/app-context";
import { ThemeToggle } from "@/components/theme-toggle";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const SECTIONS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Workspace",
    items: [{ href: "/dashboard", label: "Overview", icon: LayoutDashboard }],
  },
  {
    title: "Operations",
    items: [
      { href: "/map", label: "Map", icon: Map },
      { href: "/reports", label: "Reports", icon: FileText },
      { href: "/work-orders", label: "Work Orders", icon: ClipboardList },
      { href: "/alerts", label: "Alerts", icon: BellRing },
    ],
  },
  {
    title: "Management",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/team", label: "Team", icon: Users },
      { href: "/members", label: "Members", icon: UserCog },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { profile, mode } = useApp();
  const unread = useUnreadCount();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <div className="app-sidebar-inner flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-4">
        <LogoMark size={30} />
        <div className="leading-tight">
          <div className="text-[15px] font-bold tracking-tight text-slate-900">
            Fix<span className="text-brand-600">Loop</span>
          </div>
          <div className="text-[10px] font-medium text-slate-500">Community Operations Platform</div>
        </div>
      </div>

      {mode === "demo" && (
        <div className="mx-4 mb-1 rounded-md border border-warn/30 bg-warn/10 px-2.5 py-1.5">
          <p className="text-[10px] font-medium text-warn">Demo mode · sample data</p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3">
        {SECTIONS.map((section) => (
          <div key={section.title} className="mb-4">
            <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {section.title}
            </div>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-brand-50 text-brand-700"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      <Icon className={cn("h-4.5 w-4.5 h-[18px] w-[18px] shrink-0", active ? "text-brand-700" : "text-slate-400 group-hover:text-slate-600")} />
                      <span className="flex-1">{item.label}</span>
                      {item.label === "Alerts" && unread > 0 && (
                        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                          {unread}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Account */}
      <div className="border-t p-3">
        <ThemeToggle className="mb-2 w-full justify-start" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-slate-50">
              <Avatar className="h-9 w-9">
                <AvatarFallback style={{ backgroundColor: profile.avatarColor || "#1d4ed8" }}>
                  {initials(profile.fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-900">{profile.fullName}</div>
                <div className="truncate text-xs text-slate-500">{ROLE_META[profile.role].label}</div>
              </div>
              <ChevronUp className="h-4 w-4 text-slate-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col">
                <span className="text-sm font-medium">{profile.fullName}</span>
                <span className="text-xs text-slate-500">{profile.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="h-4 w-4" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/members`}>
                <UserCog className="h-4 w-4" /> Members
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                void logout();
              }}
              className="text-danger focus:text-danger"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function MobileSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="absolute inset-y-0 left-0 w-72 animate-in slide-in-from-left shadow-2xl">
        <Sidebar onNavigate={onClose} />
      </div>
    </div>
  );
}

export { Button, Badge, toneToVariant };
