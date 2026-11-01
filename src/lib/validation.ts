// ---------------------------------------------------------------------------
// Zod validation schemas for API inputs and AI (Gemini) responses.
// Server route handlers validate every inbound payload; AI JSON is parsed and
// strictly validated against application enums before it is ever persisted.
// ---------------------------------------------------------------------------

import { z } from "zod";
import {
  CONFIDENCE_BANDS,
  ISSUE_CATEGORIES,
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  USER_ROLES,
} from "@/lib/types";

export const issueCategorySchema = z.enum(ISSUE_CATEGORIES);
export const issuePrioritySchema = z.enum(ISSUE_PRIORITIES);
export const issueStatusSchema = z.enum(ISSUE_STATUSES);
export const userRoleSchema = z.enum(USER_ROLES);

export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// ---- Create issue --------------------------------------------------------
export const createIssueSchema = z.object({
  title: z.string().trim().min(5, "Title must be at least 5 characters.").max(140),
  description: z.string().trim().min(15, "Describe the issue in at least 15 characters.").max(4000),
  category: issueCategorySchema,
  priority: issuePrioritySchema,
  address: z.string().trim().min(3, "Provide a location.").max(200),
  area: z.string().trim().max(120).default("Unzoned"),
  coordinates: geoPointSchema,
  mediaUrl: z.string().max(4_000_000).nullish(),
  aiAnalysis: z
    .object({
      suggestedCategory: issueCategorySchema,
      summary: z.string().max(400),
      visualFindings: z.string().max(1000).optional(),
      detailedReport: z.string().max(4000).optional(),
      suggestedPriority: issuePrioritySchema,
      reason: z.string().max(400),
      confidenceBand: z.enum(CONFIDENCE_BANDS),
      needsReview: z.boolean(),
      safetyNote: z.string().max(400).nullish(),
      model: z.string().max(80),
    })
    .nullish(),
  linkToIssueId: z.string().nullish(),
});
export type CreateIssuePayload = z.infer<typeof createIssueSchema> & {
  reporterId: string;
};

// ---- Update issue --------------------------------------------------------
export const updateIssueSchema = z.object({
  status: issueStatusSchema.optional(),
  priority: issuePrioritySchema.optional(),
  category: issueCategorySchema.optional(),
  assignedToId: z.string().nullish(),
  assignedToName: z.string().nullish(),
  teamName: z.string().nullish(),
  resolutionNote: z.string().max(2000).nullish(),
});
export type UpdateIssuePayload = z.infer<typeof updateIssueSchema>;

// ---- AI analysis request -------------------------------------------------
export const aiAnalyzeRequestSchema = z.object({
  description: z.string().trim().min(5).max(4000),
  title: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().max(140).optional()
  ),
  category: z.preprocess(
    (value) => (value === "" ? undefined : value),
    issueCategorySchema.optional()
  ),
  address: z.string().trim().max(200).optional(),
  area: z.string().trim().max(120).optional(),
  imageDataBase64: z.string().min(1).max(4_500_000).regex(/^[A-Za-z0-9+/]+={0,2}$/).optional(), // ~3.3MB image
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
}).superRefine((input, ctx) => {
  if (Boolean(input.imageDataBase64) !== Boolean(input.mimeType)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Image data and its JPEG content type must be provided together.",
      path: ["imageDataBase64"],
    });
  }
});

// ---- AI analysis response (strict) --------------------------------------
export const aiAnalysisResponseSchema = z.object({
  suggestedCategory: issueCategorySchema,
  summary: z.string().max(400),
  visualFindings: z.string().trim().min(10).max(1000),
  detailedReport: z.string().trim().min(20).max(2000),
  suggestedPriority: issuePrioritySchema,
  reason: z.string().max(400),
  confidenceBand: z.enum(CONFIDENCE_BANDS),
  needsReview: z.boolean(),
  safetyNote: z.string().max(400).nullable().optional(),
});
export type AiAnalysisResponse = z.infer<typeof aiAnalysisResponseSchema>;

// ---- Work order note -----------------------------------------------------
export const workOrderNoteSchema = z.object({
  workOrderId: z.string().min(1),
  body: z.string().trim().min(2).max(1000),
});

// ---- Verification --------------------------------------------------------
export const verificationSchema = z.object({
  issueId: z.string().min(1),
  verdict: z.enum(["confirm_resolved", "still_not_fixed"]),
  reason: z.string().trim().max(1000).optional(),
});

// ---- Comment -------------------------------------------------------------
export const commentSchema = z.object({
  issueId: z.string().min(1),
  body: z.string().trim().min(1).max(1000),
});

// ---- Duplicate check -----------------------------------------------------
export const duplicateCheckSchema = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().min(5).max(4000),
  category: issueCategorySchema,
  coordinates: geoPointSchema,
});

export function formatZodError(err: z.ZodError): string {
  return err.issues.map((i) => i.message).join("; ");
}

// ---- Account validation (pure, safe to import from client components) ----
// These live here (not in lib/auth) so client pages never pull in next/headers.

/** Password rules enforced for sign-up in both demo and Supabase modes. */
export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must contain at least one letter and one number.";
  }
  return null;
}

export function validateEmail(email: string): string | null {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email.trim())) return "Enter a valid email address.";
  return null;
}
