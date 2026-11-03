import { NextResponse } from "next/server";
import { analyzeIssue, geminiConfigured, AiUnavailableError } from "@/lib/gemini";
import { aiAnalyzeRequestSchema, formatZodError } from "@/lib/validation";
import { getCurrentProfile } from "@/lib/auth";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function POST(req: Request) {
  // Auth: only signed-in users may run analysis.
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // Rate limit: 15 analyses / minute / client.
  const rl = rateLimit(clientKey(req, ":ai"), 15);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and retry.", retryAfter: rl.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = aiAnalyzeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  try {
    const result = await analyzeIssue({
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      address: parsed.data.address,
      area: parsed.data.area,
      imageDataBase64: parsed.data.imageDataBase64,
      mimeType: parsed.data.mimeType,
    });
    return NextResponse.json({ ...result, available: true });
  } catch (e) {
    if (e instanceof AiUnavailableError) {
      return NextResponse.json({ error: e.message, available: false }, { status: 503 });
    }
    console.error("AI analysis error:", e);
    return NextResponse.json({ error: "AI analysis failed. Please try again or continue manually.", available: false }, { status: 502 });
  }
}
