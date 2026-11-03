"use client";

import * as React from "react";
import { Database, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function SampleDataControl({ sampleCount }: { sampleCount: number }) {
  const [pending, setPending] = React.useState<"load" | "remove" | null>(null);
  const [message, setMessage] = React.useState("");

  const run = async (action: "load" | "remove") => {
    setPending(action);
    setMessage("");
    try {
      const response = await fetch("/api/admin/sample-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) {
        setMessage(result.error ?? "Unable to update sample data.");
        return;
      }
      setMessage(result.message ?? "Sample data updated.");
      window.location.reload();
    } catch {
      setMessage("Unable to update sample data.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">Sample reports</p>
          <p className="text-xs text-slate-500">
            {sampleCount ? `${sampleCount} sample reports are loaded.` : "No sample reports are loaded."}
          </p>
        </div>
        {sampleCount > 0 && <Badge variant="info">Loaded</Badge>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void run("load")} disabled={pending !== null}>
          {pending === "load" ? <Loader2 className="animate-spin" /> : <Database />}
          Load sample data
        </Button>
        {sampleCount > 0 && (
          <Button size="sm" variant="outline" onClick={() => void run("remove")} disabled={pending !== null}>
            {pending === "remove" ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Remove sample data
          </Button>
        )}
      </div>
      {message && <p className="text-xs text-danger" role="alert">{message}</p>}
    </div>
  );
}
