import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/db/store";
import { buildSeed } from "@/lib/seed";

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "administrator") {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Sample data loading is available in Supabase mode." }, { status: 400 });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Supabase service access is not configured." }, { status: 500 });
  }

  const body = await request.json() as { action?: "load" | "remove" };
  if (body.action === "remove") {
    const { error } = await service.from("issues").delete().eq("is_demo_data", true);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: "Sample reports removed." });
  }
  if (body.action !== "load") {
    return NextResponse.json({ error: "Choose a valid action." }, { status: 400 });
  }

  const seed = buildSeed(Date.now());
  const rows = seed.issues.map((issue) => ({
    public_id: issue.publicId,
    title: issue.title,
    description: issue.description,
    category: issue.category,
    priority: issue.priority,
    status: issue.status,
    address: issue.location.address,
    area: issue.location.area,
    lat: issue.location.coordinates.lat,
    lng: issue.location.coordinates.lng,
    reporter_id: profile.id,
    reporter_name: issue.reporterName || profile.fullName,
    assigned_to_name: issue.assignedToName,
    team_name: issue.teamName,
    created_at: issue.createdAt,
    updated_at: issue.updatedAt,
    assigned_at: issue.assignedAt,
    sla_hours: issue.slaHours,
    resolution_note: issue.resolutionNote ?? null,
    resolved_at: issue.resolvedAt ?? null,
    is_demo_data: true,
  }));

  const { error } = await service.from("issues").upsert(rows, {
    onConflict: "public_id",
    ignoreDuplicates: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ message: `${rows.length} sample reports loaded.` });
}
