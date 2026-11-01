import { cn } from "@/lib/utils";

/**
 * FixLoop mark — a circular "loop" arrow enclosing a location pin, signalling
 * the report → resolve → verify loop. Renders crisply at any size.
 */
export function LogoMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <rect width="40" height="40" rx="10" fill="#1d4ed8" />
      {/* loop arc */}
      <path
        d="M20 7a13 13 0 1 1-9.2 3.8"
        stroke="#93c5fd"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
      {/* arrow head on the loop */}
      <path d="M11 5.5 L11 11.5 L17 11" stroke="#93c5fd" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* location pin */}
      <path
        d="M20 12c-3.3 0-6 2.6-6 5.9 0 4.3 6 10.1 6 10.1s6-5.8 6-10.1c0-3.3-2.7-5.9-6-5.9Z"
        fill="#ffffff"
      />
      <circle cx="20" cy="18" r="2.3" fill="#1d4ed8" />
    </svg>
  );
}

export function Wordmark({
  className,
  markSize = 30,
  dark = false,
  tagline,
}: {
  className?: string;
  markSize?: number;
  dark?: boolean;
  tagline?: string | null;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={markSize} />
      <div className="leading-tight">
        <div
          className={cn(
            "text-[17px] font-bold tracking-tight",
            dark ? "text-white" : "text-slate-900"
          )}
        >
          Fix<span className="text-brand-600">Loop</span>
        </div>
        {tagline && (
          <div className={cn("text-[10px] font-medium tracking-wide", dark ? "text-slate-400" : "text-slate-500")}>
            {tagline}
          </div>
        )}
      </div>
    </div>
  );
}
