import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createRouteClient, getServiceClient } from "@/lib/supabase/server";
import { getStore, supabaseConfigured } from "@/lib/db/store";
import { USER_ROLES } from "@/lib/types";
import { validateEmail, validatePassword } from "@/lib/validation";

function redirect(request: NextRequest, path: string, params?: Record<string, string>) {
  const url = new URL(path, request.url);
  Object.entries(params ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url, { status: 303 });
}

function matchesAdminKey(candidate: string) {
  const expectedValue = process.env.ADMIN_BOOTSTRAP_KEY;
  if (!expectedValue || expectedValue.length < 24) return false;
  const expected = Buffer.from(expectedValue);
  const candidateBuffer = Buffer.from(candidate);
  return expected.length === candidateBuffer.length && timingSafeEqual(expected, candidateBuffer);
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const fullName = String(form.get("fullName") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const requestedRole = String(form.get("requestedRole") ?? "resident");
  const adminKey = String(form.get("adminBootstrapKey") ?? "");

  if (fullName.length < 2) return redirect(request, "/signup", { error: "Enter your full name." });
  const emailError = validateEmail(email);
  if (emailError) return redirect(request, "/signup", { error: emailError });
  const passwordError = validatePassword(password);
  if (passwordError) return redirect(request, "/signup", { error: passwordError });
  if (!USER_ROLES.includes(requestedRole as typeof USER_ROLES[number])) {
    return redirect(request, "/signup", { error: "Choose a valid account role." });
  }

  if (requestedRole === "administrator" && !matchesAdminKey(adminKey)) {
    return redirect(request, "/signup", { error: "Enter the administrator setup key provided by the workspace owner." });
  }

  if (!supabaseConfigured()) {
    const store = await getStore();
    try {
      const profile = await store.createProfile({ fullName, email, role: "resident", password });
      if (requestedRole === "field_staff") {
        await store.createRoleRequest(profile.id, "field_staff");
      }
    } catch (error) {
      return redirect(request, "/signup", {
        error: error instanceof Error ? error.message : "Unable to create your account right now.",
      });
    }
    return redirect(request, "/login", {
      registered: "1",
      email,
      ...(requestedRole === "field_staff" ? { field_staff: "1" } : {}),
    });
  }

  const response = NextResponse.next();
  const supabase = createRouteClient(request, response as NextResponse);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${(process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/$/, "")}/auth/callback`,
      data: { full_name: fullName, role: "resident", requested_role: requestedRole === "field_staff" ? requestedRole : null },
    },
  });

  if (error) return redirect(request, "/signup", { error: error.message });
  if (!data.user) return redirect(request, "/signup", { error: "No account was created. Please try again." });
  if (data.user.identities?.length === 0) return redirect(request, "/signup", { error: "An account with this email already exists. Sign in instead." });

  const serviceClient = getServiceClient();
  if (!serviceClient) return redirect(request, "/signup", { error: "Supabase server access is not configured." });

  const { error: profileError } = await serviceClient.from("profiles").upsert({
    id: data.user.id,
    full_name: fullName,
    email,
    role: "resident",
    is_active: true,
  }, { onConflict: "id" });

  if (profileError) {
    await serviceClient.auth.admin.deleteUser(data.user.id);
    return redirect(request, "/signup", { error: "Your account could not be created because the database profile failed to save. Please try again." });
  }

  if (requestedRole === "administrator") {
    const { error: roleError } = await serviceClient
      .from("profiles")
      .update({ role: "administrator" })
      .eq("id", data.user.id)
      .eq("role", "resident");
    if (roleError) {
      await serviceClient.auth.admin.deleteUser(data.user.id);
      return redirect(request, "/signup", { error: "Administrator setup failed. Please apply the latest database migration and try again." });
    }
  }

  if (data.session) await supabase.auth.signOut();

  const params: Record<string, string> = { registered: "1", email };
  if (!data.session) params.confirm = "1";
  if (requestedRole === "administrator") params.administrator = "1";
  if (requestedRole === "field_staff") params.field_staff = "1";
  return redirect(request, "/login", params);
}
