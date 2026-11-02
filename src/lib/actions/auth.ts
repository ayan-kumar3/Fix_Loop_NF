"use server";

import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getStore, supabaseConfigured } from "@/lib/db/store";
import { SESSION_COOKIE, validateEmail, validatePassword } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/server";
import { USER_ROLES } from "@/lib/types";
import type { RequestedRole } from "@/lib/types";

export interface AuthState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function matchesAdminBootstrapKey(candidate: string): boolean {
  const configuredKey = process.env.ADMIN_BOOTSTRAP_KEY;
  if (!configuredKey || configuredKey.length < 24) return false;
  const expected = Buffer.from(configuredKey);
  const submitted = Buffer.from(candidate);
  return expected.length === submitted.length && timingSafeEqual(expected, submitted);
}

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
    let result;
    try {
      result = await supabase.auth.signInWithPassword({ email, password });
    } catch (error) {
      console.error("Supabase sign-in request failed:", error);
      return { error: "Unable to sign in right now. Please try again." };
    }
    const { data, error } = result;
    if (error || !data.user) {
      const message = error?.message?.toLowerCase() ?? "";
      if (message.includes("email not confirmed")) {
        return { error: "Confirm your email address before signing in. Check your inbox for the confirmation link." };
      }
      return { error: "Invalid email or password." };
    }
    try {
      // Ensure a profile row exists for this auth user.
      const store = await getStore();
      let profile = await store.getProfile(data.user.id);
      if (!profile) {
        profile = await store.createProfile({
          id: data.user.id,
          fullName: (data.user.user_metadata?.full_name as string) || email.split("@")[0],
          email: data.user.email ?? email,
          role: "resident",
        });
      }
      if (!profile.isActive) {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) console.error("Could not clear the deactivated account session:", signOutError);
        cookies().delete(SESSION_COOKIE);
        return { error: "This account is deactivated. Contact your workspace administrator." };
      }
      setSessionCookie(data.user.id);
    } catch (error) {
      console.error("Could not load the signed-in user's profile:", error);
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) console.error("Could not clear the session after profile loading failed:", signOutError);
      cookies().delete(SESSION_COOKIE);
      return { error: "Your account was verified, but your profile could not be loaded. Please try again." };
    }
    redirect("/dashboard");
  }

  // Demo mode
  const store = await getStore();
  const profiles = await store.getProfiles();
  const profile = profiles.find((p) => p.email.toLowerCase() === email.toLowerCase());
  if (!profile) return { error: "No account found with that email. Try a demo account below or sign up." };
  // Demo accounts accept any non-empty password.
  if (!password) return { error: "Password is required." };
  setSessionCookie(profile.id);
  redirect("/dashboard");
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const submittedRole = String(formData.get("requestedRole") ?? "resident");
  const adminBootstrapKey = String(formData.get("adminBootstrapKey") ?? "");
  const requestedRole = USER_ROLES.find((role) => role === submittedRole);

  const fieldErrors: Record<string, string> = {};
  if (fullName.length < 2) fieldErrors.fullName = "Enter your full name.";
  const emailErr = validateEmail(email);
  if (emailErr) fieldErrors.email = emailErr;
  const passErr = validatePassword(password);
  if (passErr) fieldErrors.password = passErr;
  if (!requestedRole) {
    fieldErrors.requestedRole = "Choose a valid account role.";
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  if (!requestedRole) return { fieldErrors: { requestedRole: "Choose a valid account role." } };
  if (supabaseConfigured()) {
    const { createServerClient } = await import("@/lib/supabase/server");
    const supabase = createServerClient();
    const isAdministrator = requestedRole === "administrator";
    const serviceClient = isAdministrator ? getServiceClient() : null;

    if (isAdministrator && !matchesAdminBootstrapKey(adminBootstrapKey)) {
      if (!process.env.ADMIN_BOOTSTRAP_KEY || process.env.ADMIN_BOOTSTRAP_KEY.length < 24) {
        return { error: "Administrator signup is not configured. Set ADMIN_BOOTSTRAP_KEY on the server first." };
      }
      fieldErrors.adminBootstrapKey = "Enter the administrator setup key provided by the workspace owner.";
      return { fieldErrors };
    }
    if (isAdministrator && !serviceClient) {
      return { error: "Administrator signup needs the server-only Supabase service role key configured." };
    }

    let result;
    try {
      result = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5001").replace(/\/$/, "")}/auth/callback`,
          data: {
            full_name: fullName,
            role: "resident",
            requested_role: requestedRole === "field_staff" ? requestedRole : null,
          },
        },
      });
    } catch (error) {
      console.error("Supabase signup request failed:", error);
      return { error: "Unable to create your account right now. Please try again." };
    }
    const { data, error } = result;
    if (error) return { error: error.message };
    if (!data.user) return { error: "No account was created. Please check your details and try again." };
    if (data.user.identities?.length === 0) {
      return { error: "An account with this email already exists. Sign in instead." };
    }

    if (isAdministrator && serviceClient) {
      let bootstrapFailed = false;
      try {
        const { error: bootstrapError } = await serviceClient
          .from("profiles")
          .update({ role: "administrator" })
          .eq("id", data.user.id)
          .eq("role", "resident")
          .eq("is_active", true);
        if (bootstrapError) {
          console.error("Administrator role assignment failed:", bootstrapError);
          bootstrapFailed = true;
        }
      } catch (error) {
        console.error("First administrator bootstrap request failed:", error);
        bootstrapFailed = true;
      }
      if (bootstrapFailed) {
        if (data.session) {
          const { error: signOutError } = await supabase.auth.signOut();
          if (signOutError) console.error("Could not clear session after admin bootstrap failed:", signOutError);
        }
        const { error: cleanupError } = await serviceClient.auth.admin.deleteUser(data.user.id);
        if (cleanupError) {
          console.error("Could not remove the account after failed administrator bootstrap:", cleanupError);
          return {
            error: "Administrator setup failed and the new account could not be removed. Sign in as a resident or contact the workspace owner.",
          };
        }
        return {
          error: "Administrator setup failed. Apply the latest Supabase migration, then try signing up again.",
        };
      }
    }

    if (data.session) {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.error("Could not clear the signup session before login:", signOutError);
        return { error: "Account created, but automatic sign-out failed. Sign out before logging in." };
      }
    }
    const redirectParams = new URLSearchParams({ registered: "1" });
    if (!data.session) redirectParams.set("confirm", "1");
    if (isAdministrator) redirectParams.set("administrator", "1");
    if (requestedRole === "field_staff") redirectParams.set("field_staff", "1");
    redirect(`/login?${redirectParams.toString()}`);
  }

  if (requestedRole === "administrator") {
    return {
      error: "Administrator registration requires a connected Supabase project. Configure its credentials and ADMIN_BOOTSTRAP_KEY first.",
    };
  }

  // Demo mode
  const store = await getStore();
  try {
    const profile = await store.createProfile({ fullName, email, role: "resident", password });
    if (requestedRole === "field_staff") await store.createRoleRequest(profile.id, requestedRole);
  } catch (error) {
    if (error instanceof Error && error.message === "An account with this email already exists.") {
      return { error: error.message };
    }
    console.error("Demo signup failed:", error);
    return {
      error: error instanceof Error ? error.message : "Unable to create your account right now. Please try again.",
    };
  }
  const redirectParams = new URLSearchParams({ registered: "1" });
  if (requestedRole === "field_staff") redirectParams.set("field_staff", "1");
  redirect(`/login?${redirectParams.toString()}`);
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
