import { NextResponse } from "next/server";
import { getStore } from "@/lib/db/store";
import { getCurrentProfile } from "@/lib/auth";
import { duplicateCheckSchema, formatZodError } from "@/lib/validation";
import { findPotentialDuplicates } from "@/lib/db/selectors";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const rl = rateLimit(clientKey(req, ":dup"), 30);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = duplicateCheckSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const store = await getStore();
  const [issues, groups] = await Promise.all([store.getIssues(), store.getGroups()]);

  // Group sizes so we can show how many related reports already exist.
  const groupSizes = new Map<string, number>();
  for (const g of groups) {
    for (const id of g.memberIssueIds) {
      groupSizes.set(id, Math.max(groupSizes.get(id) ?? 1, g.memberIssueIds.length));
    }
  }

  const matches = findPotentialDuplicates(
    {
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      coordinates: parsed.data.coordinates,
    },
    issues,
    undefined,
    groupSizes
  );

  return NextResponse.json({ matches });
}
