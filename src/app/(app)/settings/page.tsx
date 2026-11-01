import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Cpu, MapPin, Palette, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ProfileForm } from "@/components/settings/profile-form";
import { Badge, toneToVariant } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { getStore, runtimeMode } from "@/lib/db/store";
import { ISSUE_STATUSES, STATUS_META, ROLE_META } from "@/lib/types";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const store = await getStore();
  const mode = runtimeMode();

  return (
    <div className="flex flex-col">
      <PageHeader title="Settings" subtitle="Your profile and this workspace's configuration." />
      <div className="grid gap-5 p-5 lg:grid-cols-3 lg:p-8">
        <Card className="shadow-card lg:col-span-2">
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-sm">Profile</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ProfileForm profile={profile} mode={mode} />
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="shadow-card">
            <CardHeader className="border-b pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Cpu className="h-4 w-4 text-brand-600" /> Workspace status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-start justify-between gap-3 text-xs">
                <span className="text-slate-500">Runtime mode</span>
                <span className={`text-right font-medium ${mode === "demo" ? "text-slate-700" : "text-warn"}`}>
                  {mode === "demo" ? "Demo (in-memory, seeded)" : "Supabase (PostgreSQL)"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t pt-3 text-xs">
                <span className="text-slate-500">Data source</span>
                <span className="font-medium text-slate-700">
                  {mode === "demo" ? "Seeded sample dataset" : "Connected database"}
                </span>
              </div>
              {mode === "demo" && <Badge variant="info">Demo</Badge>}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="border-b pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Palette className="h-4 w-4 text-brand-600" /> Lifecycle
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="mb-2.5 text-xs text-slate-500">
                Every status change is validated server-side and logged to the issue timeline.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ISSUE_STATUSES.map((s) => (
                  <Badge key={s} variant={toneToVariant(STATUS_META[s].tone)}>
                    {STATUS_META[s].label}
                  </Badge>
                ))
                }
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="border-b pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-brand-600" /> Your access
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <Badge variant={toneToVariant(ROLE_META[profile.role].tone)}>
                  {ROLE_META[profile.role].label}
                </Badge>
                <span>{profile.role}</span>
              </div>
              <p className="mt-3 flex items-start gap-1.5">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                Roles are stored on your profile and enforced on the server — the client never decides.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}