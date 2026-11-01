import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { IssueDetailView } from "@/components/issues/issue-detail";
import { getStore } from "@/lib/db/store";
import { getCurrentProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const store = await getStore();
  const issue = await store.getIssue(params.id);
  return { title: issue ? `${issue.publicId} · ${issue.title}` : "Issue" };
}

export default async function IssueDetailPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  if (!profile) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }

  const store = await getStore();
  const issue = await store.getIssue(params.id);
  if (!issue) notFound();

  const [media, events, comments, verifications, groups, workOrders, profiles, analyses] = await Promise.all([
    store.getMedia(issue.id),
    store.getEvents(issue.id),
    store.getComments(issue.id),
    store.getVerifications(issue.id),
    store.getGroups(),
    store.getWorkOrders(),
    store.getProfiles(),
    store.getAnalyses(issue.id),
  ]);

  const group = groups.find((g) => g.memberIssueIds.includes(issue.id)) ?? null;
  const workOrder = workOrders.find((w) => w.issueId === issue.id) ?? null;

  return (
    <div className="flex flex-col">
      <PageHeader title={issue.publicId} subtitle={issue.title} />
      <IssueDetailView
        data={{
          issue,
          media,
          analysis: analyses[0] ?? null,
          events,
          comments,
          verifications,
          group,
          workOrder,
          staff: profiles.filter((p) => p.role === "field_staff" && p.isActive),
        }}
      />
    </div>
  );
}
