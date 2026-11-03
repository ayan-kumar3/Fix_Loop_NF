// ---------------------------------------------------------------------------
// Google Gemini integration — server-side only.
//
// The API key is read from GEMINI_API_KEY and is NEVER exposed to the browser
// (no NEXT_PUBLIC_ prefix, ever). This module:
//   • builds a tightly-constrained prompt,
//   • requests JSON only,
//   • parses and strictly validates the response against application enums,
//   • enforces a request timeout,
//   • throws AiUnavailableError so callers can fall back to manual entry.
//
// AI output is always a SUGGESTION — never an authoritative decision.
// ---------------------------------------------------------------------------

import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  CONFIDENCE_BANDS,
  ISSUE_CATEGORIES,
  ISSUE_PRIORITIES,
} from "@/lib/types";
import type { IssueCategory, IssuePriority } from "@/lib/types";
import { aiAnalysisResponseSchema, type AiAnalysisResponse } from "@/lib/validation";

export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
const FALLBACK_MODELS: string[] = [];

const TIMEOUT_MS = 8_000;

const SYSTEM_PROMPT = `You are the triage assistant for "FixLoop", a civic issue-reporting platform.

You will receive a resident's report of a local infrastructure problem, optionally with a photograph and location.

When a photograph is provided, inspect it as visual evidence before interpreting the text. Do not simply rewrite or assume the resident's description is correct. Identify the specific visible issue, its condition, extent, and any visible obstruction or safety concern. Separate what the photo visibly supports from what the resident reports. Never claim details that cannot be seen.

Return ONLY a raw JSON object (no markdown, no commentary) with exactly these keys:
{
  "suggestedCategory": one of [${ISSUE_CATEGORIES.join(", ")}],
  "summary": one specific, factual sentence (max 40 words) describing the image when provided, otherwise the reported issue,
  "visualFindings": a separate, image-grounded description of exactly what is visible in the photo (or clearly state that no photo was provided),
  "detailedReport": a complete, actionable municipal case report with the required sections below,
  "suggestedPriority": one of [${ISSUE_PRIORITIES.join(", ")}],
  "reason": one or two sentences explaining WHY you chose that priority (based on safety, impact and scale),
  "confidenceBand": one of [${CONFIDENCE_BANDS.join(", ")}],
  "needsReview": true if the category/priority are uncertain or the report is ambiguous, else false,
  "safetyNote": a short safety warning if there is an immediate hazard (e.g. exposed wiring, deep water, broken glass), else null
}

Report-writing requirements — make the result useful to a corporation or municipality, not a paraphrase:
- Describe the actual issue established by the evidence. When an image is supplied, the image is primary evidence for what is visibly present; the title, category and description are claims to compare against it, not facts to copy unquestioningly.
- "visualFindings" must be plain descriptive text without a heading; independently describe visible objects, condition, apparent extent, and relevant surroundings in concrete language. State what cannot be confirmed from this image; do not infer hidden causes, exact dimensions, or unpictured events. Do not copy the resident description into this field.
- Begin "detailedReport" with "Visual findings:" and record the image evidence; follow with "Reported issue and impact:", "Municipal handling:", "Recommended solution:", and "Follow-up and verification:".
- Include "Reported issue and impact:" to explain the resident's claim and the plausible public impact. If it differs from the image, clearly say they do not match and that their relationship/location is unverified.
- Include "Municipal handling:" with a practical intake and targeting plan: verify the reported location, document the condition, assign the confirmed issue to the appropriate type of municipal service, and prioritize based on observed safety, access and community impact. Do not invent a specific municipality, named department, jurisdiction or response deadline.
- Include "Recommended solution:" with concrete, conditional work steps appropriate to the visible issue and the responsible service. For example, if overflowing waste is visible, arrange collection and cleanup and assess bin capacity/collection needs; if road damage is confirmed, mark/protect the hazard and inspect/repair the surface. Do not recommend unrelated work as though it were verified.
- Include "Follow-up and verification:" explain how staff should confirm completion (for example, site reinspection or after-photo), update the resident, and close the case only after the fix is verified.
- For conflicting image/text, handle each as a separately verifiable concern and recommend separate correctly routed work items if both are confirmed. Set needsReview to true. Base the suggested category on the primary visible issue, not on a conflicting text label.
- If an image is blurry, obstructed, unusual, or not clearly a real-world photo, do not stop or return an error. Describe only what is actually visible, state the limitation, flag the case for human review, and still provide conditional municipal handling, solution, and verification steps based on the resident's claim.
- Without an image, say findings are based on the resident's description and qualify unverified observations.
- Use concise but sufficiently specific sections, with one or two practical sentences per section. Do not omit the actual solution or responsible service type.

Strict rules — you MUST follow them:
- Never invent an exact address, a responsible authority, a legal violation, a repair cost, or the underlying root cause.
- Do not repeat unsupported details or add facts that were not provided in the description or photo.
- If you cannot determine a category, pick the closest match and set needsReview to true.
- Keep the summary and priority reason concise, factual, and grounded in evidence.`;

export interface AnalyzeInput {
  title?: string;
  description: string;
  category?: string;
  address?: string;
  area?: string;
  imageDataBase64?: string;
  mimeType?: string;
}

export async function analyzeIssue(
  input: AnalyzeInput
): Promise<{ analysis: AiAnalysisResponse; model: string }> {
  if (!geminiConfigured()) {
    throw new AiUnavailableError("Gemini is not configured. Add GEMINI_API_KEY to enable AI analysis.");
  }

  const apiKey = process.env.GEMINI_API_KEY!;
  const genAI = new GoogleGenerativeAI(apiKey);

  const userText = [
    input.title ? `Title: ${input.title}` : null,
    `Category (user selected, may be blank): ${input.category || "not provided"}`,
    input.address ? `Reported location: ${input.address}` : null,
    input.area ? `Area or zone: ${input.area}` : null,
    `Description: ${input.description}`,
  ]
    .filter(Boolean)
    .join("\n");

  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
    { text: `${SYSTEM_PROMPT}\n\n${userText}` },
  ];
  if (input.imageDataBase64 && input.mimeType) {
    parts.push({ inlineData: { data: input.imageDataBase64, mimeType: input.mimeType } });
  }

  const models = [...new Set([GEMINI_MODEL, ...FALLBACK_MODELS])];
  for (let index = 0; index < models.length; index += 1) {
    const modelName = models[index];
    const model = genAI.getGenerativeModel({ model: modelName });

    try {
      const request = model.generateContent({ contents: [{ role: "user", parts }] });
      const result = await withTimeout(request, TIMEOUT_MS, "Gemini request timed out.");
      return {
        analysis: parseGeminiJson(result.response.text()),
        model: modelName,
      };
    } catch (error) {
      const hasFallback = index < models.length - 1;
      if (!hasFallback || !shouldTryFallbackModel(error)) {
        break;
      }
    }
  }
  return { analysis: createLocalAnalysis(input), model: "fixloop-guided-analysis" };
}

function createLocalAnalysis(input: AnalyzeInput): AiAnalysisResponse {
  const text = `${input.title ?? ""} ${input.description}`.toLowerCase();
  const categoryRules: Array<[IssueCategory, string[]]> = [
    ["Water Leakage", ["water", "leak", "pipe", "tap"]],
    ["Street Lighting", ["street light", "lamp", "lighting", "light out"]],
    ["Waste Management", ["garbage", "trash", "waste", "bin"]],
    ["Sanitation", ["sewer", "sewage", "sanitation", "open drain"]],
    ["Drainage", ["drain", "flood", "waterlogging", "water logging"]],
    ["Footpath", ["footpath", "sidewalk", "pavement", "tile"]],
    ["Roads", ["road", "pothole", "traffic lane", "street damage"]],
  ];
  const matchedCategory = categoryRules.find(([, words]) => words.some((word) => text.includes(word)))?.[0] ?? "Public Infrastructure";
  const critical = /dangerous|danger|electrical|fire|gas|collapse|injury|blocked emergency/i.test(text);
  const high = /hazard|hazardous|large|deep|traffic|damage|overflow|broken/i.test(text);
  const priority: IssuePriority = critical ? "Critical" : high ? "High" : "Medium";
  const summarySource = `${input.title ? `${input.title}: ` : ""}${input.description}`.trim().replace(/\s+/g, " ");
  const summary = summarySource.length > 220 ? `${summarySource.slice(0, 217)}...` : summarySource;
  const location = [input.address, input.area].filter(Boolean).join(", ");
  const visualFindings = input.imageDataBase64
    ? "A photograph was provided, but the cloud analysis was unavailable. Review the attached image before selecting a final category."
    : "No photo was provided; assessment is based on the resident description.";

  return {
    suggestedCategory: matchedCategory,
    summary,
    visualFindings,
    detailedReport: `Visual findings: ${visualFindings} Reported issue and impact: Verify the reported concern${location ? ` at ${location}` : ""} and assess its immediate risk to residents and access. Municipal handling: Dispatch the appropriate inspection team and document the location and observed condition. Recommended solution: Secure any immediate hazard, complete the required repair, and prevent further public impact. Follow-up and verification: Reinspect the site after intervention and confirm the issue is resolved before closure.`,
    suggestedPriority: priority,
    reason: critical
      ? "The description indicates an immediate safety risk requiring urgent handling."
      : high
        ? "The description indicates a likely safety, traffic, or service impact requiring prompt attention."
        : "The report should be inspected and prioritized after field verification.",
    confidenceBand: "Medium",
    needsReview: true,
    safetyNote: high || critical ? "Potential public safety impact; secure the area and arrange prompt inspection." : null,
  };
}

function isTransientGeminiError(error: unknown): boolean {
  if (error instanceof AiUnavailableError && /timed out/i.test(error.message)) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /\[(?:429|503)\b|(?:429|503)\s+(?:Too Many Requests|Service Unavailable)|RESOURCE_EXHAUSTED|UNAVAILABLE/i.test(message);
}

function shouldTryFallbackModel(error: unknown): boolean {
  if (isTransientGeminiError(error)) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /(?:404|NOT_FOUND|model.*not found|non-JSON|malformed JSON|failed validation|safety|blocked|RECITATION|no candidates)/i.test(message);
}

function parseGeminiJson(raw: string): AiAnalysisResponse {
  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  let obj: unknown;
  try {
    obj = JSON.parse(cleaned);
  } catch {
    // Attempt to extract the first JSON object as a fallback.
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new AiUnavailableError("Gemini returned a non-JSON response.");
    try {
      obj = JSON.parse(match[0]);
    } catch {
      throw new AiUnavailableError("Gemini returned malformed JSON.");
    }
  }

  const result = aiAnalysisResponseSchema.safeParse(obj);
  if (!result.success) {
    throw new AiUnavailableError("Gemini response failed validation.");
  }
  return result.data;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new AiUnavailableError(message)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
