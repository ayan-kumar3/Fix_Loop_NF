import { NextRequest, NextResponse } from "next/server";
import { createRouteClient, getServiceClient } from "@/lib/supabase/server";
import { getStore, supabaseConfigured } from "@/lib/db/store";
import { validateEmail } from "@/lib/validation";
import { DEMO_ACCOUNT_COOKIE, SESSION_COOKIE, signSessionUserId, verifyDemoAccountCookie } from "@/lib/auth";

function redirectWithError(request: NextRequest, message: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  const emailError = validateEmail(email);
  if (emailError) return redirectWithError(request, emailError);
  if (!password) return redirectWithError(request, "Password is required.");

  if (!supabaseConfigured()) {
    const store = await getStore();
    const registeredAccount = verifyDemoAccountCookie(request.cookies.get(DEMO_ACCOUNT_COOKIE)?.value, email, password);
    if (registeredAccount) {
      let profile = await store.getProfile(registeredAccount.id);
      if (!profile) {
        profile = await store.createProfile({
          id: registeredAccount.id,
          fullName: registeredAccount.fullName,
          email: registeredAccount.email,
          role: registeredAccount.role,
        });
      }
      const response = NextResponse.redirect(new URL("/dashboard", request.url), { status: 303 });
      response.cookies.set(SESSION_COOKIE, profile.id, {
        httpOnly: true,
        secure: request.nextUrl.protocol === "https:",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
      return response;
    }
    const profile = (await store.getProfiles()).find(
      (candidate) => candidate.email.toLowerCase() === email
    );
    if (!profile) {
      return redirectWithError(request, "No account found with that email. Create an account first.");
    }
    if (!profile.isActive) {
      return redirectWithError(request, "This account is deactivated. Contact your workspace administrator.");
    }
    const response = NextResponse.redirect(new URL("/dashboard", request.url), { status: 303 });
    response.cookies.set(SESSION_COOKIE, profile.id, {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  }

  const response = NextResponse.redirect(new URL("/dashboard", request.url), { status: 303 });
  const supabase = createRouteClient(request, response);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user || !data.session) {
    const message = error?.message ?? "";
    if (/invalid login credentials/i.test(message)) {
      return redirectWithError(request, "The email or password is incorrect. Use the same credentials from signup.");
    }
    if (/email not confirmed/i.test(message)) {
      return redirectWithError(request, "Confirm your email address before signing in.");
    }
    return redirectWithError(request, message || "Unable to sign in right now.");
  }

  const signedUserId = signSessionUserId(data.user.id);
  if (!signedUserId) {
    return redirectWithError(request, "Server session configuration is incomplete.");
  }
  response.cookies.set(SESSION_COOKIE, signedUserId, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  try {
    const store = await getStore();
    const profile = await store.getProfile(data.user.id);
    if (!profile) {
      const admin = getServiceClient();
      if (!admin) {
        return redirectWithError(request, "Server database access is not configured.");
      }
      const fullName = typeof data.user.user_metadata?.full_name === "string"
        ? data.user.user_metadata.full_name
        : email.split("@")[0];
      const { error: createError } = await admin.from("profiles").upsert({
        id: data.user.id,
        full_name: fullName,
        email: data.user.email ?? email,
        role: "resident",
        is_active: true,
      }, { onConflict: "id" });
      if (createError) throw createError;
    } else if (!profile.isActive) {
      return redirectWithError(request, "This account is deactivated. Contact your workspace administrator.");
    }
  } catch (error) {
    console.error("Could not prepare profile during login:", error);
    return redirectWithError(request, "Your account could not be loaded. Please try again.");
  }

  return response;
}
