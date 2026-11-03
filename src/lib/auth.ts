// ---------------------------------------------------------------------------
// Authentication & session helpers.
//
// A thin abstraction over two modes:
//   • demo       — cookie-backed session against the in-memory profiles.
//   • supabase   — Supabase Auth (email/password) with the profiles table kept
//                  in sync. The Supabase user id is mirrored into the same
//                  session cookie so getCurrentProfile() is identical in both.
//
// Authorization is ALWAYS decided server-side from the persisted role — the
// client never dictates its own role.
// ---------------------------------------------------------------------------

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getStore, supabaseConfigured } from "@/lib/db/store";
import { validateEmail as _validateEmail, validatePassword as _validatePassword } from "@/lib/validation";
import type { Profile, UserRole } from "@/lib/types";

// Pure validators live in lib/validation so client components can import them
// without pulling in next/headers. Re-exported here for server-side callers.
export const validatePassword = _validatePassword;
export const validateEmail = _validateEmail;

export const SESSION_COOKIE = "fixloop_session";

function sessionCookieSecret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}

export function signSessionUserId(userId: string): string | null {
  const secret = sessionCookieSecret();
  if (!secret || !userId) return null;
  const signature = createHmac("sha256", secret).update(userId).digest("hex");
  return `${userId}.${signature}`;
}

export function verifySessionCookie(value: string | undefined): string | null {
  if (!value) return null;
  const separator = value.lastIndexOf(".");
  if (separator <= 0) return null;
  const userId = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  const expected = createHmac("sha256", sessionCookieSecret()).update(userId).digest("hex");
  const provided = Buffer.from(signature);
  const actual = Buffer.from(expected);
  if (provided.length !== actual.length || !timingSafeEqual(provided, actual)) return null;
  return userId;
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await getStore();
  if (store.mode === "supabase") {
    try {
      const { createServerClient } = await import("@/lib/supabase/server");
      const supabase = createServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) return user.id;
    } catch {
      // During static generation / build-time evaluation there may be no request
      // context yet, so fall back to the demo cookie flow below.
    }

    // Keep a small server-side session marker for the route-to-page handoff.
    // It is validated against Supabase Admin before it can authorize a profile.
    try {
      const userId = verifySessionCookie(cookies().get(SESSION_COOKIE)?.value);
      if (userId) {
        return userId;
      }
    } catch {
      // Invalid or expired markers are treated as signed out.
    }
    // Supabase uses UUID users. Demo cookies such as usr_1001_... must never be
    // sent to PostgreSQL after switching database modes.
    return null;
  }

  try {
    return cookies().get(SESSION_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const uid = await getSessionUserId();
  if (!uid) return null;
  const store = await getStore();
  return store.getProfile(uid);
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) throw new AuthError("Not authenticated");
  return profile;
}

export async function requireRole(roles: UserRole[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) {
    throw new AuthError("You do not have permission to perform this action.", 403);
  }
  return profile;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export function isSupabaseAuth(): boolean {
  return supabaseConfigured();
}
