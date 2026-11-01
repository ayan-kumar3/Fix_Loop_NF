"use client";

// Member management table for administrators: change role, activate or
// deactivate accounts. Every mutation is a server action that re-checks the
// caller's role — this UI only offers affordances.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, UserCog, UserX, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge, toneToVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/toaster";
import { setMemberActive, setMemberRole } from "@/lib/actions/admin";
import { ROLE_META, USER_ROLES } from "@/lib/types";
import type { Profile, UserRole } from "@/lib/types";
import { initials, avatarColor, formatDateShort, truncate, cn } from "@/lib/utils";

export function MembersTable({
  profiles,
  viewerId,
}: {
  profiles: Profile[];
  viewerId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<UserRole | "all">("all");
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return profiles.filter((p) => {
      if (roleFilter !== "all" && p.role !== roleFilter) return false;
      if (!q) return true;
      return p.fullName.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
    });
  }, [profiles, query, roleFilter]);

  const changeRole = async (memberId: string, role: UserRole) => {
    setBusyId(memberId);
    const res = await setMemberRole(memberId, role);
    setBusyId(null);
    if (res.ok) {
      toast({ title: "Role updated", description: res.message, variant: "success" });
      router.refresh();
    } else {
      toast({ title: "Could not update role", description: res.error, variant: "error" });
    }
  };

  const toggleActive = async (member: Profile) => {
    setBusyId(member.id);
    const res = await setMemberActive(member.id, !member.isActive);
    setBusyId(null);
    if (res.ok) {
      toast({ title: "Account updated", description: res.message, variant: "success" });
      router.refresh();
    } else {
      toast({ title: "Could not update account", description: res.error, variant: "error" });
    }
  };

  return (
    <div className="rounded-xl border bg-white shadow-card">
      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as UserRole | "all")}>
          <SelectTrigger className="h-9 w-full text-sm sm:w-[200px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {USER_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_META[r].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-500">No members match your search.</p>
      ) : (
        <ul className="divide-y">
          {filtered.map((p) => {
            const isSelf = p.id === viewerId;
            const busy = busyId === p.id;
            return (
              <li
                key={p.id}
                className={cn(
                  "flex flex-col gap-3 px-4 py-3 transition-colors sm:flex-row sm:items-center",
                  !p.isActive && "opacity-60"
                )}
              >
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback style={{ backgroundColor: p.avatarColor || avatarColor(p.fullName) }}>
                    {initials(p.fullName)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{p.fullName}</span>
                    {isSelf && <Badge variant="info">You</Badge>}
                    {p.role === "administrator" && (
                      <ShieldCheck className="h-3.5 w-3.5 text-brand-600" aria-label="Administrator" />
                    )}
                    {!p.isActive && <Badge variant="danger">Deactivated</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {truncate(p.email, 48)} · joined {formatDateShort(p.createdAt)}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Badge variant={toneToVariant(ROLE_META[p.role].tone)}>{ROLE_META[p.role].label}</Badge>

                  <Select
                    value={p.role}
                    onValueChange={(v) => changeRole(p.id, v as UserRole)}
                    disabled={busy}
                  >
                    <SelectTrigger className="h-8 w-[150px] text-xs" aria-label={`Change role for ${p.fullName}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {USER_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_META[r].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    size="sm"
                    variant={p.isActive ? "outline" : "default"}
                    className="h-8 gap-1 text-xs"
                    disabled={busy || isSelf}
                    title={isSelf ? "You cannot deactivate your own account" : undefined}
                    onClick={() => toggleActive(p)}
                  >
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : p.isActive ? (
                      <UserX className="h-3.5 w-3.5" />
                    ) : (
                      <UserCog className="h-3.5 w-3.5" />
                    )}
                    {p.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t px-4 py-2.5 text-xs text-slate-500">
        {filtered.length} of {profiles.length} member{profiles.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}
