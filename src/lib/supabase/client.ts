"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client. Only ever reads the public anon key.
 * Used for auth session handling and any user-initiated storage uploads.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Running in demo mode — return null so callers can no-op gracefully.
    return null as unknown as ReturnType<typeof createBrowserClient>;
  }
  return createBrowserClient(url, anonKey);
}
