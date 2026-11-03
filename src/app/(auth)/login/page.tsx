"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2, LogIn, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function SubmitButton({ isSubmitting }: { isSubmitting: boolean }) {
  return (
    <Button type="submit" className="auth-submit w-full" disabled={isSubmitting}>
      {isSubmitting ? <Loader2 className="animate-spin" /> : <LogIn />}
      {isSubmitting ? "Signing in..." : "Sign in"}
    </Button>
  );
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = React.useState(false);
  const [notice, setNotice] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [serverError, setServerError] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmail(params.get("email") ?? "");
    setServerError(params.get("error") ? decodeURIComponent(params.get("error")!) : "");
    if (params.get("confirmed") === "1") {
      setNotice(
        params.get("signout") === "failed"
          ? "Email confirmed. If you are redirected away from login, sign out first, then sign in with your credentials."
          : "Email confirmed. Sign in to continue."
      );
    } else if (params.get("registered") === "1") {
      if (params.get("administrator") === "1") {
        setNotice(
          params.get("confirm") === "1"
            ? "Your first administrator account is set up. Confirm your email, then sign in."
            : "Your first administrator account is set up. Sign in to continue."
        );
      } else if (params.get("field_staff") === "1") {
        setNotice(
          params.get("confirm") === "1"
            ? "Account created. Confirm your email, then sign in. Field Staff access will be reviewed."
            : "Account created. Sign in to continue. Field Staff access will be reviewed."
        );
      } else {
        setNotice(
          params.get("confirm") === "1"
            ? "Account created. Confirm your email, then sign in."
            : "Account created. Sign in to continue."
        );
      }
    } else if (params.get("confirmation") === "failed") {
      setNotice("That confirmation link is invalid or expired. Request a new signup email.");
    }
  }, []);

  return (
    <Card className="auth-card">
      <CardHeader className="auth-card-header">
        <span className="auth-card-kicker" data-auth-step>WELCOME BACK</span>
        <CardTitle className="auth-card-title" data-auth-step>Sign in</CardTitle>
        <CardDescription className="auth-card-description" data-auth-step>Access your community operations workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action="/api/auth/login"
          method="post"
          className="auth-form space-y-4"
          onSubmit={() => setIsSubmitting(true)}
        >
          {serverError && (
            <div role="alert" className="auth-error flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {notice && (
            <p role="status" className="rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800">
              {notice}
            </p>
          )}

          <div className="auth-field space-y-1.5" data-auth-step>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>

          <div className="auth-field space-y-1.5" data-auth-step>
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="current-password"
                className="pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="auth-password-toggle absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div data-auth-step><SubmitButton isSubmitting={isSubmitting} /></div>
        </form>

        <p className="auth-switch mt-5 text-center text-sm" data-auth-step>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-brand-700 hover:underline">
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
