import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Sparkles,
  MapPinned,
  Users,
  ShieldCheck,
  GitMerge,
  Camera,
  BarChart3,
  BellRing,
  ClipboardCheck,
  Route,
} from "lucide-react";
import { MarketingNav } from "@/components/marketing/nav";
import { SiteFooter } from "@/components/marketing/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const LIFECYCLE = [
  { icon: Camera, title: "Report", text: "Snap a photo, drop a pin, add a note." },
  { icon: Sparkles, title: "AI analysis", text: "Gemini suggests category & priority." },
  { icon: GitMerge, title: "Duplicate detection", text: "Related reports are linked, not lost." },
  { icon: Route, title: "Prioritise & assign", text: "SLA clocks and routed work orders." },
  { icon: ClipboardCheck, title: "Resolve", text: "Field staff upload evidence." },
  { icon: ShieldCheck, title: "Verify", text: "The community confirms it is fixed." },
];

const FEATURES = [
  { icon: MapPinned, title: "Live map overview", text: "Every issue plotted, clustered and filterable across a dark, high-contrast operations map.", href: "/map" },
  { icon: BarChart3, title: "Operations dashboard", text: "Real KPIs — open, overdue, unassigned and response times — computed from live records.", href: "/dashboard" },
  { icon: BellRing, title: "Proactive alerts", text: "Overdue issues, unassigned high-priority reports and SLA breaches surface automatically.", href: "/alerts" },
  { icon: Route, title: "Work orders", text: "Assign, acknowledge, progress and attach resolution evidence with a clear audit trail.", href: "/work-orders" },
  { icon: ShieldCheck, title: "Community verification", text: "A fix is only done when a resident confirms it — disputes reopen the issue.", href: "/issues/iss_0017" },
  { icon: Users, title: "Role-based access", text: "Residents, field staff and administrators each see what they need — enforced server-side.", href: "/signup" },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingNav />

      <main className="flex-1">
        {/* ---------------- Hero ---------------- */}
        <section className="landing-hero relative overflow-hidden">
          <div
            aria-hidden
            className="landing-hero-grid pointer-events-none absolute inset-0 opacity-[0.35]"
          />
          <div className="landing-hero-inner relative mx-auto max-w-7xl px-5">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div className="landing-hero-copy" data-reveal>
                <Badge variant="info" className="landing-kicker mb-5 rounded-full px-3 py-1">
                  <Sparkles className="h-3 w-3" /> AI-assisted civic issue resolution
                </Badge>
                <h1 className="landing-title text-balance font-extrabold">
                  Your Community. Your Voice.{" "}
                  <span className="landing-title-accent">Real Change.</span>
                </h1>
                <p className="landing-lede mt-6">
                  Report local problems, track their progress, and make sure every issue gets the attention it
                  deserves.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="lg" className="group h-12 rounded-lg bg-white px-6 text-brand-800 shadow-lg shadow-blue-950/20 hover:-translate-y-0.5 hover:bg-blue-50">
                    <Link href="/report">
                      Report an Issue
                      <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="landing-secondary-action h-12 rounded-lg border-white/25 bg-white/5 px-6 text-white hover:-translate-y-0.5 hover:border-white/50 hover:bg-white/10 hover:text-white">
                    <Link href="/dashboard">Explore Platform</Link>
                  </Button>
                </div>
                <div className="landing-proof mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                  <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> End-to-end tracking</span>
                  <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> Real Gemini analysis</span>
                  <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> Verified resolution</span>
                </div>
              </div>

              {/* Decorative dashboard preview */}
              <div className="landing-preview-wrap relative" data-reveal="scale">
                <DashboardPreview />
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- How it works ---------------- */}
        <section id="how" className="landing-section mx-auto max-w-6xl scroll-mt-20 px-5 py-24">
          <div className="landing-section-heading mx-auto max-w-2xl text-center" data-reveal>
            <Badge variant="neutral" className="mb-3">The FixLoop lifecycle</Badge>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Reporting is easy. Getting it fixed is the hard part.
            </h2>
            <p className="mt-3 text-slate-600">
              FixLoop closes the gap between a report and a real resolution with a transparent, auditable
              pipeline — every step visible to the community.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LIFECYCLE.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="landing-step-card relative rounded-xl border bg-white p-5 shadow-card" data-reveal>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-slate-400">STEP {i + 1}</div>
                      <div className="font-semibold text-slate-900">{step.title}</div>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{step.text}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ---------------- Features ---------------- */}
        <section id="features" className="landing-section scroll-mt-20 border-t bg-slate-50/80 py-24">
          <div className="mx-auto max-w-6xl px-5">
            <div className="landing-section-heading max-w-2xl" data-reveal>
              <Badge variant="neutral" className="mb-3">Platform capabilities</Badge>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                A complete operations platform, not a to-do list
              </h2>
              <p className="mt-3 text-slate-600">
                Everything a civic team needs to triage, dispatch, resolve and verify — built for real
                operational work.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <Link
                    key={f.title}
                    href={f.href}
                    className="landing-feature-card group rounded-xl border bg-white p-5 shadow-card transition-all hover:-translate-y-1"
                    data-reveal
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-700 text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
                    <p className="mt-1.5 text-sm text-slate-600">{f.text}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700">
                      Open <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* ---------------- AI ---------------- */}
        <section id="ai" className="landing-section scroll-mt-20 py-24">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-2">
            <div data-reveal>
              <Badge variant="info" className="mb-3"><Sparkles className="h-3 w-3" /> Gemini-powered</Badge>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                AI that triages, not decides
              </h2>
              <p className="mt-3 text-slate-600">
                Upload a photo and FixLoop asks Google Gemini to suggest a category, priority and short summary.
                Suggestions are always transparent, editable and clearly separated from what a human confirms.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Structured JSON output validated against app enums",
                  "Never invents addresses, costs or legal claims",
                  "Flags low-confidence results for human review",
                  "Graceful manual fallback when AI is unavailable",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div data-reveal="scale"><AiPreview /></div>
          </div>
        </section>

        {/* ---------------- Impact ---------------- */}
        <section id="impact" className="landing-section scroll-mt-20 border-t bg-navy-950 py-24 text-white">
          <div className="mx-auto max-w-6xl px-5">
            <div className="max-w-2xl" data-reveal>
              <Badge variant="secondary" className="mb-3 bg-white/10 text-white border-white/15">Community impact</Badge>
              <h2 className="text-3xl font-bold tracking-tight">Transparent by default</h2>
              <p className="mt-3 text-slate-300">
                FixLoop is built around a simple belief: a community should be able to see what was reported, who
                is fixing it, and whether it actually got resolved. Every metric on the dashboard is computed from
                real records — never fabricated.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { k: "8", label: "Issue categories", sub: "Sanitation to infrastructure" },
                { k: "6", label: "Lifecycle stages", sub: "Report to verified resolution" },
                { k: "3", label: "Roles", sub: "Resident · Field · Admin" },
                { k: "100%", label: "Auditable", sub: "Every action logged" },
              ].map((s) => (
                <div key={s.label} className="landing-impact-stat rounded-xl border border-white/10 bg-white/5 p-5" data-reveal>
                  <div className="text-3xl font-bold text-brand-300">{s.k}</div>
                  <div className="mt-1 font-medium">{s.label}</div>
                  <div className="text-sm text-slate-400">{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- CTA ---------------- */}
        <section className="landing-section mx-auto max-w-6xl px-5 py-20">
          <div className="landing-cta relative overflow-hidden rounded-2xl px-6 py-14 text-center text-white sm:px-12" data-reveal="scale">
            <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight">
              Ready to close the loop in your community?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-brand-100">
              Jump straight into the Operations Center with seeded demo data, or report your first issue.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" variant="secondary" className="h-11 bg-white px-6 text-brand-800 hover:bg-brand-50">
                <Link href="/dashboard">Open Operations Center</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 border-white/40 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white">
                <Link href="/report">Report an Issue</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Decorative previews (pure markup, no fabricated metrics claimed as real)
// ---------------------------------------------------------------------------

function DashboardPreview() {
  const rows = [
    { t: "Pothole near the main entrance gate", p: "High", s: "Submitted", tone: "bg-danger/10 text-danger" },
    { t: "Blocked drainage culvert behind Block B", p: "Critical", s: "In progress", tone: "bg-warn/10 text-warn" },
    { t: "Overflowing community dustbin — Riverside", p: "Medium", s: "Pending verification", tone: "bg-brand-50 text-brand-700" },
    { t: "Streetlight replaced in the parking lot", p: "Medium", s: "Verified", tone: "bg-success/10 text-success" },
  ];
  return (
    <div className="relative rounded-2xl border bg-white p-4 shadow-[0_20px_60px_-20px_rgba(16,24,40,0.35)]">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <div className="text-sm font-bold text-slate-900">Operations Center</div>
          <div className="text-xs text-slate-500">Here&apos;s what&apos;s happening today.</div>
        </div>
        <Badge variant="warn">3 need attention</Badge>
      </div>
      <div className="grid grid-cols-3 gap-2 py-3">
        {[
          { l: "Open", v: "23" },
          { l: "Overdue", v: "2" },
          { l: "Unassigned", v: "9" },
        ].map((k) => (
          <div key={k.l} className="rounded-lg border bg-slate-50 p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{k.l}</div>
            <div className="text-xl font-bold text-slate-900">{k.v}</div>
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.t} className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div className="min-w-0 pr-2">
              <div className="truncate text-xs font-medium text-slate-800">{r.t}</div>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.tone}`}>{r.s}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 h-24 overflow-hidden rounded-lg border bg-gradient-to-br from-slate-100 to-slate-200 relative">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(rgba(148,163,184,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.4) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        />
        <span className="absolute left-4 top-4 h-3 w-3 rounded-full bg-danger ring-2 ring-white" />
        <span className="absolute right-8 top-6 h-3 w-3 rounded-full bg-warn ring-2 ring-white" />
        <span className="absolute bottom-4 left-1/2 h-3 w-3 rounded-full bg-success ring-2 ring-white" />
      </div>
    </div>
  );
}

function AiPreview() {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-card">
      <div className="flex items-center gap-3 border-b pb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Camera className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-900">garbage-pile.jpg</div>
          <div className="text-xs text-slate-500">Analyzing with Gemini…</div>
        </div>
        <Badge variant="info">AI</Badge>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs font-medium text-slate-500">Suggested category</dt>
          <dd className="font-semibold text-slate-900">Sanitation</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Suggested priority</dt>
          <dd className="font-semibold text-warn">Medium</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs font-medium text-slate-500">Summary</dt>
          <dd className="text-slate-700">Garbage accumulation near a public area.</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs font-medium text-slate-500">Reason</dt>
          <dd className="text-slate-600">Visible accumulation of waste beside a walkway.</dd>
        </div>
      </dl>
      <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <CheckCircle2 className="h-4 w-4 text-success" /> High confidence
        </span>
        <span className="text-xs text-slate-400">You can edit before submitting</span>
      </div>
    </div>
  );
}
