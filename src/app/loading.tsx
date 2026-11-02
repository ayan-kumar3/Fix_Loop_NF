import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <main
      className="grid min-h-screen place-items-center bg-slate-50 px-5 text-slate-700"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-3 rounded-xl border bg-white px-5 py-4 shadow-card">
        <Loader2 className="h-5 w-5 animate-spin text-brand-700" aria-hidden="true" />
        <span className="text-sm font-medium">Loading FixLoop…</span>
      </div>
    </main>
  );
}
