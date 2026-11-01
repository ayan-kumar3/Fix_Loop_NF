"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { Eye, EyeOff, Loader2, UserPlus, AlertCircle, CheckCircle2 } from "lucide-react";
import { signup, type AuthState } from "@/lib/actions/auth";
import { validatePassword } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/toaster";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="auth-submit w-full" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <UserPlus />}
      {pending ? "Creating account…" : "Create account"}
    </Button>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [state, formAction] = useFormState<AuthState, FormData>(signup, {});
  const [showPassword, setShowPassword] = React.useState(false);
  const [password, setPassword] = React.useState("");

  React.useEffect(() => {
    if (state?.success) {
      const needsEmailConfirmation = state.needsEmailConfirmation;
      toast({
        title: needsEmailConfirmation ? "Check your email" : "Account created",
        description: needsEmailConfirmation
          ? "Confirm your email address, then sign in."
          : "Welcome to FixLoop.",
        variant: "success",
      });
      router.push(needsEmailConfirmation ? "/login" : "/dashboard");
    }
  }, [state, router]);

  const fieldErrors = state?.fieldErrors ?? {};
  const passErr = password ? validatePassword(password) : null;
  const passOk = password.length > 0 && !passErr;

  return (
    <Card className="auth-card auth-card-signup">
      <CardHeader className="auth-card-header">
        <span className="auth-card-kicker" data-auth-step>YOUR COMMUNITY STARTS HERE</span>
        <CardTitle className="auth-card-title" data-auth-step>Create your account</CardTitle>
        <CardDescription className="auth-card-description" data-auth-step>Join your community operations platform.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="auth-form space-y-4">
          {state?.error && (
            <div role="alert" className="auth-error flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          <div className="auth-field space-y-1.5" data-auth-step>
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" name="fullName" placeholder="Jane Doe" autoComplete="name" aria-invalid={Boolean(fieldErrors.fullName)} aria-describedby={fieldErrors.fullName ? "fullName-error" : undefined} />
            {fieldErrors.fullName && <p id="fullName-error" className="text-xs text-danger">{fieldErrors.fullName}</p>}
          </div>

          <div className="auth-field space-y-1.5" data-auth-step>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "email-error" : undefined} />
            {fieldErrors.email && <p id="email-error" className="text-xs text-danger">{fieldErrors.email}</p>}
          </div>

          <div className="auth-field space-y-1.5" data-auth-step>
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                className="pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(fieldErrors.password || passErr)}
                aria-describedby={fieldErrors.password ? "password-error" : password ? "password-feedback" : undefined}
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
            {password && (
              <p id="password-feedback" className={`flex items-center gap-1 text-xs ${passOk ? "text-success" : "text-danger"}`} aria-live="polite">
                {passOk ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                {passOk ? "Password looks good" : passErr}
              </p>
            )}
            {fieldErrors.password && <p id="password-error" className="text-xs text-danger">{fieldErrors.password}</p>}
          </div>

          <p className="text-xs text-slate-500" data-auth-step>
            New accounts start as Residents. Contact an administrator if you need a staff role.
          </p>

          <div data-auth-step><SubmitButton /></div>
        </form>

        <p className="auth-switch mt-5 text-center text-sm" data-auth-step>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand-700 hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
