"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { Sidebar, MobileSidebar } from "@/components/app/sidebar";
import { AppProvider } from "@/components/app/app-context";
import { Wordmark } from "@/components/logo";
import type { Notification, Profile } from "@/lib/types";

export function AppShell({
  profile,
  mode,
  notifications,
  children,
}: {
  profile: Profile;
  mode: "demo" | "supabase";
  notifications: Notification[];
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <AppProvider profile={profile} mode={mode} initialNotifications={notifications}>
      <div className="app-frame flex h-screen overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-slate-200/80 dark:border-slate-800/70 lg:block">
          <Sidebar />
        </aside>

        {/* Mobile drawer */}
        <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />

        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Mobile top bar */}
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur lg:hidden">
            <button
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Wordmark markSize={26} />
          </header>

          <main className="app-scroll flex-1 overflow-y-auto scrollbar-thin">{children}</main>
        </div>
      </div>
    </AppProvider>
  );
}
