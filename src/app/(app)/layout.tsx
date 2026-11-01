import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { getCurrentProfile } from "@/lib/auth";
import { getStore } from "@/lib/db/store";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const store = await getStore();
  const notifications = await store.getNotifications(profile.id);

  return (
    <AppShell profile={profile} mode={store.mode} notifications={notifications}>
      {children}
    </AppShell>
  );
}
