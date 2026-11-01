"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge, toneToVariant } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "@/components/toaster";
import { updateMyProfile } from "@/lib/actions/admin";
import { ROLE_META } from "@/lib/types";
import type { Profile } from "@/lib/types";
import { initials, avatarColor, formatDateShort } from "@/lib/utils";

export function ProfileForm({ profile, mode }: { profile: Profile; mode: "demo" | "supabase" }) {
  const router = useRouter();
  const [fullName, setFullName] = React.useState(profile.fullName);
  const [phone, setPhone] = React.useState(profile.phone ?? "");
  const [saving, setSaving] = React.useState(false);

  const dirty = fullName !== profile.fullName || phone !== (profile.phone ?? "");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await updateMyProfile({ fullName, phone });
    setSaving(false);
    if (res.ok) {
      toast({ title: "Saved", description: res.message, variant: "success" });
      router.refresh();
    } else {
      toast({ title: "Could not save", description: res.error, variant: "error" });
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar className="h-14 w-14">
          <AvatarFallback
            style={{ backgroundColor: profile.avatarColor || avatarColor(profile.fullName) }}
            className="text-lg font-bold"
          >
            {initials(profile.fullName)}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">{profile.fullName}</span>
            <Badge variant={toneToVariant(ROLE_META[profile.role].tone)}>{ROLE_META[profile.role].label}</Badge>
          </div>
          <p className="text-xs text-slate-500">Member since {formatDateShort(profile.createdAt)}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            minLength={2}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 000 1234"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input id="email" value={profile.email} readOnly className="pl-8 bg-slate-50 text-slate-500" />
        </div>
        <p className="text-xs text-slate-400">Email is your sign-in identity and can&apos;t be changed here.</p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!dirty || saving} className="gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </Button>
      </div>

      {mode === "demo" && (
        <div className="flex items-start gap-2 rounded-lg border border-warn/30 bg-warn/5 px-3 py-2.5 text-xs text-warn">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Demo mode: passwords aren&apos;t stored and sessions are cookie-based. Connect Supabase for
            real authentication.
          </span>
        </div>
      )}
    </form>
  );
}
