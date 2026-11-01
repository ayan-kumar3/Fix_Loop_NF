"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { Eye, EyeOff, Loader2, LogIn, AlertCircle } from "lucide-react";
import { login, type AuthState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/toaster";

const DEMO_ACCOUNTS = [
  { role: "Administrator", email: "sarah.khan@fixloop.gov" },
  { role: "Field Staff", email: "mike.torres@fixloop.gov" },
  { role: "Resident", email: "aisha.patel@mail.com" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="auth-submit w-full" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <LogIn />}
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [state, formAction] = useFormState<AuthState, FormData>(login, {});
  const [showPassword, setShowPassword] = React.useState(false);
  const [demoEmail, setDemoEmail] = React.useState("");

  React.useEffect(() => {
    if (state?.success) {
      toast({ title: "Welcome back", description: "Signed in successfully.", variant: "success" });
      router.push("/dashboard");
    }
  }, [state, router]);

  const fieldErrors = state?.fieldErrors ?? {};

  return (
    <Card className="auth-card">
      <CardHeader className="auth-card-header">
        <span className="auth-card-kicker" data-auth-step>WELCOME BACK</span>
        <CardTitle className="auth-card-title" data-auth-step>Sign in</CardTitle>
        <CardDescription className="auth-card-description" data-auth-step>Access your community operations workspace.</CardDescription>
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
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="you@example.com" defaultValue={demoEmail} autoComplete="email" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "email-error" : undefined} />
            {fieldErrors.email && <p id="email-error" className="text-xs text-danger">{fieldErrors.email}</p>}
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
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? "password-error" : undefined}
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
            {fieldErrors.password && <p id="password-error" className="text-xs text-danger">{fieldErrors.password}</p>}
          </div>

          <div data-auth-step><SubmitButton /></div>
        </form>

        <div className="auth-demo mt-5 rounded-lg border p-3" data-auth-step>
          <p className="text-xs font-medium text-slate-600">Try a demo account (any password):</p>
          <div className="mt-2 space-y-1.5">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => setDemoEmail(a.email)}
                className="auth-demo-row flex w-full items-center justify-between rounded-md border px-2.5 py-2 text-left text-xs transition-colors"
              >
                <span className="font-medium text-slate-700">{a.email}</span>
                <span className="text-slate-400">{a.role}</span>
              </button>
            ))}
          </div>
        </div>

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
