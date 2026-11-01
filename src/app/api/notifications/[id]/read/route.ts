import { NextResponse } from "next/server";
import { getStore } from "@/lib/db/store";
import { getCurrentProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const store = await getStore();
  await store.markNotificationRead(params.id);
  return NextResponse.json({ ok: true });
}
