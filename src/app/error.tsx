"use client";

// Global error boundary. Shown for unhandled server/client errors so judges
// never see a blank screen.

import * as React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    // Log for developers; never surfaced as user-facing instruction text.
    console.error("FixLoop error:", error);
  }, [error]);

  const copyDetails = async () => {
    try {
      await navigator.clipboard.writeText(`${error.message}${error.digest ? ` (digest: ${error.digest})` : ""}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
        Something went wrong
      </h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        An unexpected error occurred while loading this page. Your data is safe — try again, and if it
        keeps happening, return to the dashboard.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={reset} className="gap-1.5">
          <RotateCcw className="h-4 w-4" /> Try again
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            window.location.href = "/dashboard";
          }}
        >
          Back to dashboard
        </Button>
      </div>
      {error.message && (
        <button
          onClick={copyDetails}
          className="mt-5 max-w-lg truncate rounded-md border bg-white px-3 py-1.5 font-mono text-[11px] text-slate-500 hover:bg-slate-50"
          title="Copy error details"
        >
          {copied ? "Copied!" : `${error.message}${error.digest ? ` · ${error.digest}` : ""}`}
        </button>
      )}
    </div>
  );
}
