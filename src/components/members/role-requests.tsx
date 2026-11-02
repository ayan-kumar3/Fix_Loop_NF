"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Clock3, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/toaster";
import { reviewRoleRequest } from "@/lib/actions/admin";
import { ROLE_META } from "@/lib/types";
import type { Profile, RoleRequest } from "@/lib/types";
import { formatDateShort } from "@/lib/utils";

export function RoleRequests({
  requests,
  profiles,
}: {
  requests: RoleRequest[];
  profiles: Profile[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const profileById = React.useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);

  const review = async (id: string, status: "approved" | "rejected") => {
    setBusyId(id);
    const result = await reviewRoleRequest(id, status);
    setBusyId(null);
    if (result.ok) {
      toast({ title: "Role request reviewed", description: result.message, variant: "success" });
      router.refresh();
    } else {
      toast({ title: "Could not review request", description: result.error, variant: "error" });
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border bg-white shadow-card" aria-labelledby="role-requests-title">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 id="role-requests-title" className="text-sm font-semibold text-slate-900">Role access requests</h2>
          <p className="mt-0.5 text-xs text-slate-500">Review requests before granting staff or administrator access.</p>
        </div>
        {requests.length > 0 && <Badge variant="info">{requests.length} pending</Badge>}
      </div>

      {requests.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500">
          <Clock3 className="h-4 w-4" />
          No role requests are waiting for review.
        </div>
      ) : (
        <ul className="divide-y">
          {requests.map((request) => {
            const profile = profileById.get(request.userId);
            const busy = busyId === request.id;
            return (
              <li key={request.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {profile?.fullName ?? "Unknown member"}
                    <span className="font-normal text-slate-500"> · {profile?.email ?? request.userId}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Requested {ROLE_META[request.requestedRole].label} · submitted {formatDateShort(request.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" className="h-8 gap-1" disabled={busy} onClick={() => review(request.id, "approved")}>
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-danger hover:text-danger"
                    disabled={busy}
                    onClick={() => review(request.id, "rejected")}
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                    Reject
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
