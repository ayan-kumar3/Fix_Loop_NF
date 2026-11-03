import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/login?confirmation=failed", request.url));
  }

  const response = NextResponse.redirect(new URL("/login?confirmation=failed", request.url));
  const supabase = createRouteClient(request, response);
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("Supabase email confirmation failed:", error);
    return NextResponse.redirect(new URL("/login?confirmation=failed", request.url));
  }

  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) {
    console.error("Could not clear the session after email confirmation:", signOutError);
    response.headers.set("location", new URL("/login?confirmed=1&signout=failed", request.url).toString());
    return response;
  }

  response.headers.set("location", new URL("/login?confirmed=1", request.url).toString());
  return response;
}
