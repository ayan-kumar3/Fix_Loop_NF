"use client";

import * as React from "react";
import type { Notification, Profile } from "@/lib/types";

export interface AppContextValue {
  profile: Profile;
  mode: "demo" | "supabase";
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
}

const AppContext = React.createContext<AppContextValue | null>(null);

export function AppProvider({
  profile,
  mode,
  initialNotifications,
  children,
}: {
  profile: Profile;
  mode: "demo" | "supabase";
  initialNotifications: Notification[];
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = React.useState(initialNotifications);
  const value = React.useMemo(
    () => ({ profile, mode, notifications, setNotifications }),
    [profile, mode, notifications]
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = React.useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export function useProfile(): Profile {
  return useApp().profile;
}

export function useUnreadCount(): number {
  const { notifications } = useApp();
  return notifications.filter((n) => !n.read).length;
}
