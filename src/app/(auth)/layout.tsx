import Link from "next/link";
import { ArrowUpRight, Check, CircleDot, ShieldCheck, Sparkles } from "lucide-react";
import { Wordmark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-page relative flex min-h-screen flex-col overflow-hidden">
      <div className="auth-glow auth-glow-one" aria-hidden="true" />
      <div className="auth-glow auth-glow-two" aria-hidden="true" />
      <div className="auth-stars" aria-hidden="true" />

      <header className="auth-header relative z-10 flex items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link href="/" aria-label="FixLoop home">
          <Wordmark dark tagline="Community Operations Platform" />
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/" className="auth-back-link inline-flex items-center gap-1.5 text-sm font-medium">
            Back to home <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main className="auth-main relative z-10 mx-auto grid w-full flex-1 items-center gap-10 px-4 pb-8 pt-2 sm:px-8 lg:max-w-6xl lg:grid-cols-[1fr_0.92fr] lg:gap-16 lg:px-12 lg:py-12">
        <section className="auth-story hidden lg:block" aria-labelledby="auth-story-title">
          <div className="auth-story-kicker">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            A clearer way to care for your community
          </div>
          <h1 id="auth-story-title">
            Good communities don&apos;t leave problems <span>unresolved.</span>
          </h1>
          <p className="auth-story-copy">
            Bring neighbors and local teams together. Make every report visible, every response accountable, and every fix count.
          </p>

          <div className="auth-story-flow" aria-label="How FixLoop works">
            <div className="auth-flow-line" aria-hidden="true" />
            <div className="auth-flow-item">
              <span className="auth-flow-icon"><CircleDot className="h-4 w-4" aria-hidden="true" /></span>
              <span><strong>Report what matters</strong><small>Give local issues a clear starting point.</small></span>
              <Check className="auth-flow-check" aria-hidden="true" />
            </div>
            <div className="auth-flow-item">
              <span className="auth-flow-icon"><Sparkles className="h-4 w-4" aria-hidden="true" /></span>
              <span><strong>Make progress visible</strong><small>Follow the work from triage to repair.</small></span>
              <Check className="auth-flow-check" aria-hidden="true" />
            </div>
            <div className="auth-flow-item">
              <span className="auth-flow-icon"><ShieldCheck className="h-4 w-4" aria-hidden="true" /></span>
              <span><strong>Close the loop together</strong><small>Build trust with verified outcomes.</small></span>
              <Check className="auth-flow-check" aria-hidden="true" />
            </div>
          </div>

          <div className="auth-story-note">
            <span className="auth-note-dot" aria-hidden="true" />
            <span>Built for residents, field teams, and local leaders.</span>
          </div>
        </section>

        <div className="auth-form-column mx-auto w-full max-w-[460px]">
          {children}
          <p className="auth-form-footnote">
            A shared space for stronger, more responsive communities.
          </p>
        </div>
      </main>

      <footer className="auth-footer relative z-10 px-5 pb-5 text-center text-xs sm:px-8 lg:px-12">
        Demo environment · sample accounts are pre-seeded
      </footer>
    </div>
  );
}
