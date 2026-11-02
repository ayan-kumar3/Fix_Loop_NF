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
import { getStore, supabaseConfigured } from "@/lib/db/store";
import { validateEmail as _validateEmail, validatePassword as _validatePassword } from "@/lib/validation";
import type { Profile, UserRole } from "@/lib/types";

// Pure validators live in lib/validation so client components can import them
// without pulling in next/headers. Re-exported here for server-side callers.
export const validatePassword = _validatePassword;
export const validateEmail = _validateEmail;

export const SESSION_COOKIE = "fixloop_session";

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
