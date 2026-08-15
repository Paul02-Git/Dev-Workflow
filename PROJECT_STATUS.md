# Project Status — Developer & Marketing Workflow OS

Read this before doing anything else in this repo. It's the handoff from the
session that built the MVP foundation (in a Claude Cowork cloud sandbox) to
whatever picks this up next (e.g. Claude Code running locally).

## What this app is

A personal workflow/checklist OS for Paul (Dovera Agency), not a generic
to-do app. The core idea: select the technologies involved in a project
(WordPress, Elementor, Shopify, GA4, GTM, GSC, Clarity, Klaviyo, ...) and the
app generates the correct stages/tasks/dependencies automatically, so Paul
never has to remember the workflow himself. The **workflow engine** —
turning a technology selection into a deduplicated, dependency-resolved task
graph — is the core of the product; everything else is UI around it.

## Stack, and why

- Next.js 16 (App Router) + TypeScript + Tailwind, single-user (no
  multi-tenant auth yet — this is a personal tool for now).
- **Drizzle ORM + `postgres` driver, not Prisma.** Prisma was the original
  plan, but its engine binaries download from `binaries.prisma.sh`, which is
  blocked by this sandbox's network allowlist (confirmed 403; npm/GitHub
  work fine). Drizzle is pure TypeScript over the `pg` protocol — no native
  binary fetch — so it was swapped in as a straight replacement. If you're
  now running locally with normal internet access, Prisma would work fine
  too, but there's no reason to switch back — Drizzle is working well.
- Local Postgres 16 for dev so far (this sandbox has no way to safely
  provision your real Supabase project without your say-so). **A Supabase
  org called "Dev Workflow" is connected with one project, "Paul02-Git's
  Project"** (ap-northeast-2) — decide whether to use it as-is, rename it,
  or create a fresh dedicated project, then update `DATABASE_URL` in
  `.env`.
- **Next.js 16 has real breaking changes from most training data**:
  `params`/`searchParams` in pages are `Promise`s and must be awaited,
  `middleware.ts` is renamed `proxy.ts`, Turbopack is default, etc. Read
  `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`
  before assuming any Next.js API from memory. All code in this repo
  already accounts for this (e.g. every dynamic route does
  `const { id } = await params`).

## What's built and verified

- **Full DB schema** (`src/db/schema.ts`) — clients, projects, technologies,
  stages, tasks (with self-referential `parentTaskId` for subtasks),
  dependencies, tags, attachments, access items, activity log, plus
  template tables (not currently used at runtime — see below).
- **Workflow engine** (`src/lib/workflow-engine/generate-workflow.ts`) —
  pure function, dedups tasks by `canonicalKey` across templates, resolves
  dependencies (dropping dangling edges when a prerequisite technology
  wasn't selected), topologically sorts, filters stages to only those with
  generated tasks. **20 unit tests** in
  `src/lib/workflow-engine/__tests__/` prove the dedup/dependency/blocking
  behavior against both synthetic and the real seeded templates.
- **Template content** for 9 technologies — WordPress, Elementor Pro,
  Shopify, GA4, GTM, GSC, Clarity, Klaviyo, Printify, plus always-included
  Discovery/QA-Security/Handoff packs — authored as TypeScript data in
  `src/data/templates/*.ts`, **not** in the DB. The engine reads these
  files directly; the `templates`/`template_tasks`/etc. DB tables exist in
  the schema for a future "edit templates in the UI" feature but aren't
  populated or read from yet.
  - `shopify.ts` and `klaviyo.ts` were rewritten from thin ~9-task stubs
    into real playbooks (Paul's actual Shopify/Klaviyo/Printify checklist,
    see `shopify-printify-klaviyo-store-workflow.md`) — client intake,
    Shopify Payments/checkout/deliverability settings, theme dev-copy
    discipline, domain/SSL/DKIM-SPF, real Klaviyo flow set (Welcome,
    Abandoned Checkout vs. Abandoned Cart as distinct flows, Browse
    Abandonment, Post-Purchase, Review Request, Winback) with actual
    trigger/timing logic, the Shopify-native-abandoned-checkout-must-be-OFF
    launch gate, and handoff/30-day-post-launch tasks.
  - `printify.ts` is new — account/payment-card setup, print provider
    selection, margin math, shipping strategy, physical sample + full
    fulfillment-chain QA, and a POD-aware Klaviyo timing task that
    cross-depends on `crm.klaviyo.flow_post_purchase`.
  - Fixed a real bug along the way: `klaviyo.ts` used to *redefine* the
    `access.wp_admin` task itself (so every Klaviyo-only or
    Shopify+Klaviyo project generated an irrelevant "Receive WordPress
    admin access" task). Now `crm.klaviyo.signup_form` just depends on
    both `access.wp_admin` and `access.shopify_admin` — whichever one
    wasn't selected drops as a dangling edge, per the engine's existing
    mechanism (same pattern GA4→GTM already used). Covered by an updated
    test in `generate-workflow.real-templates.test.ts`.
  - Added two Printify-aware Check Project rules (samples not ordered
    after publish; no end-to-end test order after the payment card's on
    file) to `forgotten-task-rules.ts`.
  - Pre-existing example projects in the live Supabase DB ("Reptile
    Merch", "Redesign", "Marketing Integration" — created by Paul via the
    running app before this change) are frozen snapshots from their
    original generation and won't reflect the new template content;
    that's expected, not a bug.
- **Blocked-status propagation** (`src/lib/workflow-engine/blocked-status.ts`)
  — a task's *effective* status is Blocked if any dependency isn't
  Done/Skipped, without mutating stored status.
- **Health score** (`src/lib/health/health-score.ts`) — 60% critical-task
  completion + 40% overall completion, minus *ratio-based* penalties for
  blocked/overdue tasks. Note: an earlier flat-per-task penalty version
  zeroed out health on any large freshly-generated project (most tasks are
  legitimately Blocked on day one) — caught via manual smoke testing, fixed,
  and locked in with a regression test in
  `src/lib/health/__tests__/health-score.test.ts`.
- **Check Project** (`src/lib/health/forgotten-task-rules.ts`) — hand-written
  heuristics (not AI) for the exact example scenarios from the spec: GA4
  installed but conversions unverified, GSC connected but sitemap not
  submitted, backup not recorded, Clarity untested, Klaviyo form untested.
  Add more by adding a function to the `RULES` array — no schema change.
- **UI**: `/dashboard`, `/clients` (+ create form, detail page), `/projects`
  (list), `/projects/new` (the wizard: client → type → technologies →
  generate), `/projects/[id]` (stage-grouped task board, status dropdowns,
  Blocked indicator, launch-readiness summary, Check Project button).
- **Verification**: 29 Vitest unit tests all passing, `tsc --noEmit` clean,
  a data-layer smoke test (`scripts/smoke-test.ts`) that exercises the real
  DB end-to-end, and a headless-browser click-through
  (`scripts/browser-smoke.mjs`, Playwright) driving the actual UI — client
  creation → wizard → generated project → task toggling → Check Project —
  with zero console/page errors.

## Nav pages, task fields, and 2 more technologies (this session)

Audited the app against the original full vision spec (not just the cut-down
MVP plan) and closed most of the gaps that were real gaps:

- **7 new nav pages**, all reading live data (no mocks):
  `/tasks` (cross-project list, filterable by status), `/today`
  (overdue + due-today + undated-critical, across all projects), `/qa`
  (cross-project QA-stage tasks grouped by project), `/templates`
  (read-only browser over `ALL_TEMPLATES` — no DB involved, it's literally
  the template source data rendered), `/reports` (status/priority
  breakdowns, health by client), `/integrations` (which projects use which
  technology — explicitly informational, no live OAuth sync exists or is
  planned yet), `/settings` (reference view of stage/technology/template
  counts — there's no per-user config to expose since there's no auth).
  `listAllTasks()` in `src/lib/queries/projects.ts` is the shared
  cross-project query backing Tasks/Today/QA — it computes per-project
  effective (dependency-aware) status for every task in one pass.
- **Task System fields are now actually editable**, not just schema-only.
  Each task row on the project page has an "Add details" / "Details" toggle
  (`src/components/task-details.tsx`, client component) exposing due date,
  assignee, notes, tags (add/remove), and attachments (add/remove) — wired
  to real server actions in `src/lib/actions.ts` and query functions in
  `src/lib/queries/projects.ts`. `getProjectDetail` now returns `tags` and
  `attachments` per task.
- **GoHighLevel** (`src/data/templates/ghl.ts`) and **Meta Ads**
  (`src/data/templates/meta-ads.ts`, organized into Setup → Testing →
  Verification → Optimization per the spec) are new technologies/templates.
  Added the **Advertising** stage (`src/data/stages.ts`) — the last of the
  spec's 18 stages, previously skipped since nothing needed it. Stages,
  technologies, and templates are now 18 / 11 / 14 respectively, live and
  seeded in Supabase. Two new project types (`CRM Setup`, `Meta Ads Setup`)
  round these out in `src/data/project-types.ts`.
- Test coverage extended accordingly — 31 tests now (was 29), including new
  cases for the Advertising stage and GHL's dependency chain.

## What's NOT built yet

- Dedicated Launch Mode screen (`/launch/[projectId]`) — launch readiness
  currently shows inline on the project page, not as its own gated view.
- Auth (currently none — anyone who can reach the app can use it; fine for
  local-only use, not fine once deployed).
- Search.
- WooCommerce, HubSpot, Mailchimp, Webflow, Google Ads, TikTok Ads — no
  technology or template exists for any of these.
- Broad on-page SEO checklist (keyword research, meta descriptions, schema,
  OG tags, robots.txt, redirects) — only the GSC-specific slice is modeled.
- Granular responsive-breakpoint QA tasks (1920/1440/1024/768/430/390/375px)
  and API-key/secrets-exposure checks — QA coverage is solid but not that
  granular yet.
- Deploying off local dev onto Vercel (DB is already live on Supabase; the
  app itself isn't deployed anywhere yet).

## Running this locally

```bash
pnpm install
cp .env.example .env   # then edit DATABASE_URL
pnpm db:push            # drizzle-kit push — creates all tables
pnpm db:seed            # seeds stages + technologies (not templates — those are code)
pnpm dev
pnpm test                # 29 tests should pass
npx tsc --noEmit         # should be clean
```

If pointing at a fresh Postgres (including a new Supabase project), `db:push`
and `db:seed` are both idempotent/safe to re-run.

## Supabase — live and seeded

Using the existing "Paul02-Git's Project" (ref `yrrvdcolcijvmqocxrbm`,
ap-northeast-2). The project-scoped Supabase MCP server is wired up in
`.mcp.json`. `.env` is fully populated (`DATABASE_URL`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
`SUPABASE_SERVICE_ROLE_KEY` is still the publishable key, not the real
secret — fine for now since nothing server-side needs it yet, but fix
before that changes). Schema pushed and seeded against the real project
(18 tables, 17 stages, 8 technologies) — verified via
`mcp__claude_ai_Supabase__list_tables`.

Two gotchas hit while wiring this up:
- **Direct host is IPv6-only.** `db.<ref>.supabase.co:5432` doesn't resolve
  over IPv4 on this network. `DATABASE_URL` uses the session pooler instead
  (`aws-0-ap-northeast-2.pooler.supabase.com:5432`, username
  `postgres.<project-ref>`), which is IPv4-reachable. If deploying to
  Vercel (which does have IPv6), the direct host would also work, but no
  reason to switch — the pooler works fine and is actually what Supabase
  recommends for serverless anyway.
- **`pnpm` isn't on PATH in this shell**, and the npm-installed
  `.bin/drizzle-kit` / `.bin/tsx.CMD` shims also failed to execute directly.
  Worked around by calling `node --env-file=.env node_modules/drizzle-kit/bin.cjs`
  / `node_modules/tsx/dist/cli.mjs` directly. Worth checking why `pnpm`
  doesn't resolve in your normal terminal before trusting the documented
  `pnpm db:push`/`pnpm dev` commands as-is.

**RLS note**: every table has RLS enabled with zero policies (Supabase's
default for new tables). Harmless today — Drizzle connects as the
`postgres` role directly over the Postgres protocol, which bypasses RLS —
but if anything later queries this DB through `@supabase/supabase-js` with
the anon key, it'll silently get zero rows back until policies are added.
