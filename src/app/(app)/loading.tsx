export default function AppLoading() {
  return (
    <div className="p-5 lg:p-8" aria-label="Loading page">
      <div className="h-8 w-52 animate-pulse rounded-md bg-slate-100" />
      <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-slate-100" />
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <div className="h-28 animate-pulse rounded-xl border bg-slate-50" />
        <div className="h-28 animate-pulse rounded-xl border bg-slate-50" />
        <div className="h-28 animate-pulse rounded-xl border bg-slate-50" />
      </div>
      <div className="mt-4 h-64 animate-pulse rounded-xl border bg-slate-50" />
    </div>
  );
}
