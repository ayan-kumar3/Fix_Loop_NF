"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getStore, supabaseConfigured } from "@/lib/db/store";
import { SESSION_COOKIE, validateEmail, validatePassword } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

export interface AuthState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  needsEmailConfirmation?: boolean;
}

const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function setSessionCookie(userId: string) {
  cookies().set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const fieldErrors: Record<string, string> = {};
  const emailErr = validateEmail(email);
  if (emailErr) fieldErrors.email = emailErr;
  if (!password) fieldErrors.password = "Password is required.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  if (supabaseConfigured()) {
    const { createServerClient } = await import("@/lib/supabase/server");
    const supabase = createServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { error: "Invalid email or password." };
    // Ensure a profile row exists for this auth user.
    const store = await getStore();
    let profile = await store.getProfile(data.user.id);
    if (!profile) {
      profile = await store.createProfile({
        fullName: (data.user.user_metadata?.full_name as string) || email.split("@")[0],
        email,
        role: "resident",
      });
    }
    setSessionCookie(data.user.id);
    return { success: true };
  }

  // Demo mode
  const store = await getStore();
  const profiles = await store.getProfiles();
  const profile = profiles.find((p) => p.email.toLowerCase() === email.toLowerCase());
  if (!profile) return { error: "No account found with that email. Try a demo account below or sign up." };
  // Demo accounts accept any non-empty password.
  if (!password) return { error: "Password is required." };
  setSessionCookie(profile.id);
  return { success: true };
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role: UserRole = "resident";

  const fieldErrors: Record<string, string> = {};
  if (fullName.length < 2) fieldErrors.fullName = "Enter your full name.";
  const emailErr = validateEmail(email);
  if (emailErr) fieldErrors.email = emailErr;
  const passErr = validatePassword(password);
  if (passErr) fieldErrors.password = passErr;
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  if (supabaseConfigured()) {
    const { createServerClient } = await import("@/lib/supabase/server");
    const supabase = createServerClient();
    let result;
    try {
      result = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, role: "resident" } },
      });
    } catch (error) {
      console.error("Supabase signup request failed:", error);
      return { error: "Unable to create your account right now. Please try again." };
    }
    const { data, error } = result;
    if (error) return { error: error.message };
    if (!data.user) return { error: "No account was created. Please check your details and try again." };
    if (data.session) setSessionCookie(data.user.id);
    return { success: true, needsEmailConfirmation: !data.session };
  }

  // Demo mode
  const store = await getStore();
  try {
    const profile = await store.createProfile({ fullName, email, role, password });
    setSessionCookie(profile.id);
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "An account with this email already exists.") {
      return { error: error.message };
    }
    console.error("Demo signup failed:", error);
    return {
      error: error instanceof Error ? error.message : "Unable to create your account right now. Please try again.",
    };
  }
}

export async function logout() {
  if (supabaseConfigured()) {
    const { createServerClient } = await import("@/lib/supabase/server");
    const supabase = createServerClient();
    await supabase.auth.signOut();
  }
  cookies().delete(SESSION_COOKIE);
  redirect("/login");
}
