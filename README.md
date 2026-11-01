# FixLoop

**AI-powered, community-driven issue reporting and resolution platform.**

Residents report problems in their neighbourhood. FixLoop triages them with AI, maps them, routes them to field crews, tracks them against SLA targets, and closes the loop with community verification — a full operational workflow, not a landing page.

Built for **NexHack 3.0**.

---

## Table of contents

- [What it does](#what-it-does)
- [Tech stack](#tech-stack)
- [Quick start (demo mode — zero setup)](#quick-start-demo-mode--zero-setup)
- [Environment variables](#environment-variables)
- [Supabase setup (optional, production mode)](#supabase-setup-optional-production-mode)
- [Google Gemini setup (optional, live AI)](#google-gemini-setup-optional-live-ai)
- [Running the app](#running-the-app)
- [Project structure](#project-structure)
- [The issue lifecycle](#the-issue-lifecycle)
- [Deployment (Vercel)](#deployment-vercel)
- [Demo walkthrough for judges](#demo-walkthrough-for-judges)
- [Known limitations](#known-limitations)

---

## What it does

| Area | What's real in this build |
|---|---|
| **Reporting** | Map picker, photo upload (client-side compression), Zod-validated submission, duplicate detection before submit |
| **AI triage** | Live Google Gemini call → structured JSON validated against app enums. Suggestions are shown separately from user-confirmed values — never silently applied. Manual fallback + retry when no API key. |
| **Duplicate handling** | Configurable distance/similarity scoring with a human-readable explanation, related-report count, and admin confirm-grouping that links (never merges) reports |
| **Lifecycle** | `submitted → under_review → assigned → in_progress → resolved_pending_verification → verified_resolved` plus `reopened` / `rejected`. Every transition validated server-side; every action writes an issue event. |
| **Community verification** | Residents confirm a fix or dispute it → issue reopens and is flagged to admins |
| **Work orders** | Auto-created on assignment, role-gated status progression, notes, evidence, SLA due dates |
| **Roles** | `resident`, `field_staff`, `administrator` — enforced on every server action, never from a client-side selector |
| **Maps** | Leaflet + OpenStreetMap: live marker map, hotspot clusters, issue focus view, report-time address search and reverse-geocoded map pin |
| **Analytics** | Recharts: 14-day volume, category distribution, lifecycle breakdown, area hotspots, recurring clusters — all computed from stored rows |
| **Metrics** | KPI cards with period-over-period comparisons that show an explicit "no prior-period data" state rather than fabricating a trend |

### Two runtime modes

FixLoop has a `DataStore` interface with two implementations, so the app is fully usable with **zero external services**:

- **Demo mode (default)** — no Supabase env vars → in-memory, seeded dataset (44 issues, 10 people, 4 crews, work orders, events, verifications, a confirmed duplicate cluster). Everything works; data resets on restart.
- **Supabase mode** — set the Supabase env vars → same app, backed by Postgres with RLS.

Metrics, analytics and duplicate detection live in shared pure selectors (`src/lib/db/selectors.ts`), so both stores compute identical numbers from the same code.

---

## Tech stack

- **Next.js 14 (App Router)** + React 18 + TypeScript
- **Tailwind CSS** + shadcn-style components (Radix primitives) + Lucide icons
- **Supabase** — Postgres, Auth, Storage, Row Level Security
- **Google Gemini** (`@google/generative-ai`) — server-side AI analysis
- **Leaflet** + OpenStreetMap (via `react-leaflet`) — mapping
- **Recharts** — analytics charts
- **Zod** — validation of all API inputs and AI responses
- **Vercel** — deployment target

---

## Quick start (demo mode — zero setup)

Requires **Node.js 18.17+** (tested on Node 24) and npm.

```powershell
git clone <your-repo-url>
cd FixLoop
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No environment variables needed — without Supabase vars FixLoop boots into **demo mode** with seeded sample data (labelled in the UI).

Sign in with any demo account (any password works in demo mode):

| Role | Email | What you can do |
|---|---|---|
| Administrator | `sarah.khan@fixloop.gov` | Everything: assign, confirm duplicate groups, manage members, complete work orders |
| Field Staff | `mike.torres@fixloop.gov` | Progress assigned work orders, submit resolutions for verification |
| Resident | `aisha.patel@mail.com` | Report issues, comment, verify/dispute resolutions |

Or click a demo account button on the login screen.

---

## Environment variables

Copy `.env.example` to `.env.local` and fill in what you need:

```powershell
Copy-Item .env.example .env.local
```

| Variable | Required? | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | Supabase project URL. **Absent → demo mode.** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Only in Supabase mode | **Server-only.** Privileged writes from route handlers. Never prefixed `NEXT_PUBLIC`. |
| `GEMINI_API_KEY` | Optional | **Server-only.** Google AI Studio key. Absent → manual AI fallback + retry. |
| `GEMINI_MODEL` | Optional | Defaults to `gemini-3.8-flash`; image analysis falls back to `gemini-3.7-flash` and `gemini-3.5-flash-lite` if a model is overloaded or returns an unusable response |
| `NEXT_PUBLIC_APP_URL` | Optional | Base URL for absolute links (default `http://localhost:3000`) |
| `DUPLICATE_DISTANCE_METERS` | Optional | Duplicate distance radius (default `250`) |
| `DUPLICATE_SIMILARITY_THRESHOLD` | Optional | Duplicate text-similarity threshold 0–1 (default `0.55`) |

> **Security notes:** the Gemini key and the Supabase service-role key are only ever read in server code (route handlers / server actions). There is no `NEXT_PUBLIC_GEMINI_API_KEY`. AI responses are validated with Zod against strict enums before persisting. Inputs are validated server-side with Zod, images are size-checked and compressed client-side, and admin operations re-verify the caller's persisted role on every call.

---

## Supabase setup (optional, production mode)

1. Create a project at [supabase.com](https://supabase.com).
2. In **Settings → API**, copy the project URL, anon key, and service-role key into `.env.local`.
3. Apply the schema. Either:
   - **SQL editor:** paste and run the migrations in order (`0001_init.sql`, `0002_resident_only_public_signup.sql`, and `0003_ai_visual_report.sql`), **then** `supabase/seed.sql`; or
   - **Supabase CLI:**
     ```powershell
     npx supabase init        # once, if you don't have a config
     npx supabase link --project-ref <your-project-ref>
     npx supabase db push
     ```
4. In **Authentication → Providers**, ensure **Email** is enabled. The migration installs a trigger (`handle_new_user`) that auto-creates a `profiles` row for each new auth user.
5. Restart `npm run dev`. The sidebar shows **"Supabase mode"** instead of the demo badge.

**Storage (optional):** create a public bucket named `issue-media` for photo uploads in Supabase mode. In demo mode images are stored as compressed JPEG data URLs in memory and category thumbnails are static SVGs in `/public/demo`, so no bucket is needed to evaluate the app.

**Row Level Security** is enabled on every table (see the migration): readable data requires authentication, users update their own profile/notification rows, and admin-only writes go through the service role behind server-side role checks.

> **Honest note:** Supabase has not been exercised against a live project. The configured Gemini key and current model were verified directly; use the local report flow to verify your full application session and permissions.

---

## Google Gemini setup (optional, live AI)

1. Get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. Add it to `.env.local` as `GEMINI_API_KEY` (server-only — never `NEXT_PUBLIC_…`).
3. On the **Report an issue** page, click **Analyze with AI**.

The request goes to `POST /api/ai/analyze-issue`, which sends the photo and report context to Gemini and validates its response with Zod against the app's category/priority enums. The result includes a distinct visual description, the complete municipal report, recommended service routing, corrective steps, and follow-up checks. The result remains a suggestion: reporters can apply, edit, or ignore it. Visual findings and the detailed report are retained with the submitted AI analysis.

If the key is missing, rate-limited, or the model returns invalid JSON, the UI shows a clear **AI unavailable** state with a **manual entry** path and a **retry** action — reporting never blocks on AI.

---

## Running the app

| Command | Purpose |
|---|---|
| `npm run dev -- --port 5001` | Development server at http://localhost:5001 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |
| `node scripts/generate-demo-images.mjs` | Regenerate the `/public/demo` SVG thumbnails |

---

## Project structure

```
src/
├── app/
│   ├── page.tsx                 # Marketing landing page
│   ├── (auth)/login, signup     # Authentication
│   ├── (app)/                   # Authenticated shell (sidebar + header)
│   │   ├── dashboard/           # Operations center (KPIs, attention, map, table)
│   │   ├── report/              # Issue submission + AI + duplicate check
│   │   ├── map/                 # Dark navy map overview
│   │   ├── issues/[id]/         # Issue detail: timeline, work order, verification
│   │   ├── reports/             # Full searchable report table
│   │   ├── work-orders/         # Field work-order board
│   │   ├── alerts/              # SLA queues + notification feed
│   │   ├── analytics/           # Recharts analytics
│   │   ├── team/                # Crews + staff roster + live workload
│   │   ├── members/             # Admin member management
│   │   └── settings/            # Profile + workspace status
│   └── api/                     # ai/analyze-issue, duplicates/check, notifications
├── components/                  # UI primitives (ui/), feature components
└── lib/
    ├── actions/                 # Server actions (auth, issues, report, admin) — role-checked
    ├── db/                      # DataStore interface, DemoStore, SupabaseStore, selectors
    ├── gemini.ts                # Server-side Gemini integration
    ├── seed.ts                  # Demo dataset (all timestamps relative to boot time)
    ├── transitions.ts           # Lifecycle transition rules
    ├── validation.ts            # Zod schemas (inputs + AI responses)
    └── work-orders.ts           # Work-order status rules (shared client/server)
supabase/
├── migrations/0001_init.sql     # Schema, enums, indexes, RLS, triggers
└── seed.sql                     # Optional demo rows for Supabase mode
```

---

## The issue lifecycle

```
submitted → under_review → assigned → in_progress
                                   → resolved_pending_verification
                                   → verified_resolved  ←── community confirms
                                          │
                                          └─ dispute ─→ reopened (flagged to admins)
```

- **Server-validated:** `canTransition()` + `canSetStatus(role, to)` run inside server actions — the client can't skip steps or exceed its role.
- **Fully audited:** every status change, assignment, comment, evidence upload, verification, and group confirmation appends an `issue_events` row shown on the issue timeline.
- **SLA:** Critical 6h · High 24h · Medium 48h · Low 96h. Overdue / nearing-breach states are derived from real timestamps, and resolved issues stop the clock.
- **Never destructive:** duplicate grouping links reports and preserves originals; confirming a group doesn't merge or delete anything.

---

## Deployment (Vercel)

1. Push the repository to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new) — Next.js is auto-detected.
3. Add the environment variables from `.env.example` (at minimum `GEMINI_API_KEY` for AI; add Supabase vars for production data). Set them in **Project → Settings → Environment Variables**.
4. Deploy. The output URL becomes your `NEXT_PUBLIC_APP_URL`.

---

## Demo walkthrough for judges

1. **Log in** as `sarah.khan@fixloop.gov` (Administrator, any password in demo mode).
2. **Dashboard** — the 3 attention cards, 5 KPIs, high-priority list, live map and recent reports are all computed from stored rows. KPI comparisons show "No prior-period data" when there genuinely isn't a prior window.
3. **Report an issue** — drop a pin, describe a problem, optionally add a photo and hit **Analyze with AI** (works with a Gemini key; otherwise shows the manual fallback). The duplicate panel will surface the seeded Main Street sanitation cluster if you report nearby.
4. **Map** — dark navy overview with clustered markers; click a marker → issue detail.
5. **Issue detail** — full timeline, assignment, status changes, work order, community verification (confirm or dispute → reopen).
6. **Work Orders** — advance a work order: Acknowledged → In Progress → Pending Verification → Completed (server-enforced per role).
7. **Alerts** — SLA queues (overdue / unassigned / breach / reopened) with inline assignment, plus the notification feed.
8. **Analytics** — 14-day volume, category and lifecycle breakdowns, hotspots, recurring clusters.
9. **Team / Members / Settings** — roster with live workload, role management (last admin is protected), workspace status.

---

## Known limitations

Honest list of what's stubbed or incomplete in this MVP:

- **Supabase & Gemini are untested against live credentials.** All validation was done in demo mode. The code paths exist and follow the documented APIs, but a live integration pass hasn't run.
- **Demo data resets on restart** — the store is in-memory by design for zero-setup evaluation.
- **Image storage:** demo mode stores compressed JPEGs as data URLs in memory; Supabase mode expects an `issue-media` bucket but the upload path hasn't been verified against a live bucket.
- **Email verification / password reset** are not implemented.
- **Real-time updates** (Supabase realtime channels) are not wired — pages refresh on navigation or action, not push.
- **Rate limiting** is a best-effort in-memory counter (`src/lib/rate-limit.ts`), per-process only.
- **Work-order reassignment to a different team** isn't exposed in the UI (assignment happens from the issue/alerts views).
- **Multi-tenant / neighbourhood isolation** — single workspace only.
- **Tests:** no automated test suite is included; `npm run typecheck` and `npm run lint` are the verification gates used during development. No test run is claimed.

---

## License

Original code written for NexHack 3.0. All assets generated for this project.
