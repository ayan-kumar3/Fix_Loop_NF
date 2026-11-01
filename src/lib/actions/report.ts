"use server";

import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/db/store";
import { requireProfile, AuthError } from "@/lib/auth";
import { createIssueSchema, formatZodError } from "@/lib/validation";

export interface SubmitReportResult {
  ok: boolean;
  issueId?: string;
  publicId?: string;
  error?: string;
}

export async function submitReport(input: unknown): Promise<SubmitReportResult> {
  try {
    const profile = await requireProfile();
    const parsed = createIssueSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: formatZodError(parsed.error) };
    }

    // Never trust a client-supplied reporter id. Normalize Zod's nullish
    // optional fields to the exact shape the store expects.
    const ai = parsed.data.aiAnalysis;
    const payload = {
      ...parsed.data,
      reporterId: profile.id,
      aiAnalysis:
        ai == null
          ? undefined
          : { ...ai, safetyNote: ai.safetyNote ?? null },
      linkToIssueId: parsed.data.linkToIssueId ?? null,
      mediaUrl: parsed.data.mediaUrl ?? null,
    };

    const store = await getStore();
    const issue = await store.createIssue(payload);

    revalidatePath("/dashboard");
    revalidatePath("/reports");
    revalidatePath("/map");

    return { ok: true, issueId: issue.id, publicId: issue.publicId };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    console.error("submitReport error:", e);
    return { ok: false, error: "Could not submit your report. Please try again." };
  }
}
