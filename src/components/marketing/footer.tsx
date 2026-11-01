import Link from "next/link";
import { Wordmark } from "@/components/logo";

const COLUMNS = [
  {
    title: "Platform",
    links: [
      { href: "/dashboard", label: "Operations Center" },
      { href: "/map", label: "Map Overview" },
      { href: "/report", label: "Report an issue" },
      { href: "/analytics", label: "Analytics" },
    ],
  },
  {
    title: "Workflows",
    links: [
      { href: "/work-orders", label: "Work orders" },
      { href: "/alerts", label: "Alerts" },
      { href: "/issues/iss_0017", label: "Community verification" },
      { href: "/team", label: "Team" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Sign in" },
      { href: "/signup", label: "Create account" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t bg-slate-50">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid gap-8 md:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div>
            <Wordmark tagline="Report it. Track it. Fix it." />
            <p className="mt-3 max-w-xs text-sm text-slate-500">
              An AI-powered, community-driven platform that takes local problems from report to verified
              resolution — transparently.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-slate-900">{col.title}</h4>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link href={l.href} className="text-sm text-slate-500 transition-colors hover:text-slate-900">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t pt-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} FixLoop. Built for NexHack 3.0 — Smart Society & Social Impact.</p>
          <p>Demo environment · Sample data is synthetic and labelled in-app.</p>
        </div>
      </div>
    </footer>
  );
}
