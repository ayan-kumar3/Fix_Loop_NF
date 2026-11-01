import type { Metadata } from "next";
import { getStore } from "@/lib/db/store";
import { buildThumbnails, toMapIssues } from "@/lib/queries";
import { MapWorkspace } from "@/components/map/map-workspace";

export const metadata: Metadata = { title: "Map Overview" };
export const dynamic = "force-dynamic";

export default async function MapPage({ searchParams }: { searchParams: { focus?: string } }) {
  const store = await getStore();
  const [issues, media] = await Promise.all([store.getIssues(), store.getAllMedia()]);
  const thumbs = buildThumbnails(media);
  const mapIssues = toMapIssues(issues, thumbs);

  return <MapWorkspace issues={mapIssues} initialFocusId={searchParams.focus ?? null} />;
}
