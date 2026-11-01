import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertCircle, UserCog } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { MembersTable } from "@/components/members/members-table";
import { DemoBadge } from "@/components/shared/issue-badges";
import { getCurrentProfile } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import { USER_ROLES, ROLE_META } from "@/lib/types";

export const metadata: Metadata = { title: "Members" };
export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/login");

  const store = await getStore();
  const profiles = await store.getProfiles();

  const counts = USER_ROLES.map((r) => ({
    role: r,
    label: ROLE_META[r].label,
    count: profiles.filter((p) => p.role === r && p.isActive).length,
  }));

  const isAdmin = viewer.role === "administrator";

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Members"
        subtitle={
          isAdmin
            ? "Manage who can access the platform and what they can do."
            : "Everyone with access to this FixLoop workspace."
        }
      />
      <div className="space-y-4 p-5 lg:p-8">
        {/* Role summary */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {counts.map((c) => (
            <div key={c.role} className="flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-card">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <UserCog className="h-4 w-4" />
              </span>
              <div>
                <div className="text-xl font-bold tabular-nums text-slate-900">{c.count}</div>
                <div className="text-xs font-medium text-slate-500">{c.label}{c.count === 1 ? "" : "s"}</div>
              </div>
            </div>
          ))}
        </div>

        {!isAdmin && (
          <div className="flex items-start gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Only administrators can change roles or deactivate accounts. Contact an administrator to
              request access changes.
            </p>
          </div>
        )}

        <MembersTable profiles={profiles} viewerId={viewer.id} />

        <div className="flex items-center justify-center gap-2">
          <DemoBadge isDemo />
          <p className="text-xs text-slate-400">
            Role and account changes are enforced server-side. The last active administrator cannot be
            demoted or deactivated.
          </p>
        </div>
      </div>
    </div>
  );
}