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

## GitHub

Connected to https://github.com/Paul02-Git/Dev-Workflow (`main`, tracked).
The one-time credential snag: this machine's cached GitHub credential was
for a different account (`RyanRobbinsDovera`), which 403'd on push — cleared
it via Windows Credential Manager and it picked up an already-authenticated
`Paul02-Git` session. `.gitignore` excludes `.env*` and (deliberately)
`package-lock.json`/`yarn.lock` — this project is pinned to pnpm and a
second lockfile confuses deploy tooling. Changes made after the initial
commit are **not yet pushed** unless you've asked for that explicitly — only
commit/push on request, not proactively.

## WordPress/Elementor rewritten around Paul's actual workflow

Two rounds of correction based on how Paul actually works solo (not an
agency with a client-supplied environment):

1. **Hosting**: `wordpress.ts` now models Cloudways specifically — create
   server/app → clone agency starter template → app access (SSH/SFTP/DB) →
   WP admin. SMTP is its own critical task (Cloudways has no local mail
   server — silent form-delivery failure otherwise), and launch sequencing
   is explicit: remove staging password → re-enable search engine
   visibility (the classic WP launch miss), as two separate ordered tasks
   so the second one can't get lost. `elementor.ts` split the old vague
   "global colors & fonts" task into three matching Elementor's real Site
   Settings panels (Global Colors, Global Fonts, Global Layout), and forms
   now cross-depend on `wp.smtp_configured`. Two new Check Project rules:
   search-engines-still-discouraged, and forms-built-but-SMTP-unconfigured.
2. **Ownership model**: GA4, GSC, Clarity, and GTM previously modeled
   `access.*` as the *first* task (implying "wait for the client to grant
   access"). Paul creates all of these himself under the agency account, so
   property/container creation is now the first task (depends only on
   `discovery.scope_confirmed`), and the old `access.*` canonical keys were
   repurposed into `handoff.*_ownership` tasks at the end of each template —
   granting the client ownership is a handoff step, not a blocker. Domain
   work (`access.domain_registrar` in `cross-cutting.ts`) now reflects
   agency-level GoDaddy access as the primary path, with client-provided
   registrar access as the fallback for domains registered elsewhere.
   `seo.gsc.verify_ownership` now has a real dependency on domain access
   (DNS TXT verification genuinely needs it).

Covered by new tests verifying property-creation tasks have no client-access
gate, ownership handoff tasks depend on the final verification step, and the
GSC/domain-access dependency. 34 tests total now.

## Daily-driver speed features

From a "make my workflow fast, senior-dev level" planning pass — full
roadmap discussed, these two shipped first as the highest-frequency wins:

1. **Ad-hoc task creation.** The app used to be 100% template-generated —
   no way to add a one-off task when a client asks for something the
   workflow engine didn't anticipate. `createAdHocTask` in
   `src/lib/queries/projects.ts` + `AddTaskForm` component (top of the
   project page). If you add a task to a stage the project doesn't have
   yet (e.g. Advertising on a project with no ads tech selected), it
   auto-materializes that `project_stages` row so the task actually has
   somewhere to render — verified this specifically against the real DB.
2. **One-click Done.** `TaskStatusSelect`'s dropdown required opening it
   and picking DONE for the single most common interaction in the app.
   `TaskDoneCheckbox` (`src/components/task-done-checkbox.tsx`) sits next
   to every task and subtask now — checked toggles DONE, unchecked reverts
   to TODO. The status dropdown stays alongside it for
   BLOCKED/REVIEW/SKIPPED/IN_PROGRESS.

Rest of the roadmap (tech-stack presets, command palette, Launch Mode
screen, a real access/credentials tracker reviving the unused
`access_items` table, recurring maintenance tasks, notifications, auth,
client-facing read-only status links, bulk actions) — discussed, not yet
built.

## Roadmap Phase 1 — Next Action Dashboard, Command Center, Launch Readiness, Verification

Full plan (all 10 proposed features, phased) is in `ROADMAP.md` — read that
first before touching any of this area again. Phase 1 shipped:

- **Next Action Dashboard** (`/dashboard` rewrite) — `getNextActions()` in
  `src/lib/queries/projects.ts` picks, per active project, the single
  highest-priority actionable (not done/skipped/blocked) top-level task,
  plus a priority-based time estimate (no real time tracking exists, this
  is a heuristic: CRITICAL≈45m/HIGH≈30m/MEDIUM≈20m/LOW≈10m). Rest of the
  old dashboard (stat tiles, Check Project feed, project list) stays below
  it, not removed.
- **Command Center** — added to the existing project detail page (not a
  new route) via two new components: `ProjectOverviewForm` (domain, target
  launch date — new `projects.domain` / `projects.target_launch_date`
  columns) and `AccessItemsPanel`. The panel **resurrects the `access_items`
  table** from the original schema, which existed since the MVP but was
  never queried or rendered anywhere — added a `url` column to it
  (`src/lib/queries/access-items.ts`) so each entry doubles as a one-click
  link *and* a received/waiting/not-requested status. This is deliberately
  the same data Phase 2's "Access Manager" will use — that phase is mostly
  a UI pass on what this phase already collects.
- **Launch Readiness enhancement** — the inline bar on the project page now
  lists *every* critical task, not just what's outstanding — done ones stay
  visible with a green ☑ and strikethrough (a running record of what
  actually got done), incomplete ones show a red ☐. Nothing disappears from
  the list once checked off.
- **Verification System v1** — a task with status DONE *and* at least one
  attachment now gets a "✓ VERIFIED" badge next to its title. Deliberately
  reuses the existing attachments (URL + label) feature rather than
  building file upload/Supabase Storage infra — pasting a screenshot link
  is fast and ships today; real drag-drop upload is noted in `ROADMAP.md`
  as a fast-follow if link-pasting proves too much friction.

Verified end-to-end against the real Supabase project (not just typecheck):
updated a project's domain/launch date, created/updated/deleted a real
access item, and confirmed `getNextActions()` picks a sensible real task for
a real project — then reverted every change.

## Command Center v2 — auto-populated links, project status, launch stamping

Follow-up pass after Phase 1, picking the three highest-leverage items from
a longer "what else should Command Center show" list — the rest of that
list (tech stack badges, client contact inline, activity feed, project
notes, verification rollup) is in `ROADMAP.md`'s "Command Center v2"
section:

- **Auto-populated Links & Access.** `src/data/access-item-presets.ts` maps
  each technology key to its standard access-item name(s) (WordPress Admin
  + Cloudways for `wordpress`, GA4 for `ga4`, etc.) plus an
  always-included "Domain Registrar." `createProjectWithWorkflow` now
  inserts these automatically at project creation — no more typing the same
  8 names by hand every project. Fill in URL/status as access actually
  comes through.
- **Project status shown + editable.** `ProjectStatusSelect` (mirrors
  `TaskStatusSelect`'s controlled-select pattern) sits next to the Command
  Center heading — was previously nowhere on the project page at all,
  despite existing in the schema and showing on the `/projects` list.
- **Launch stamping.** Picking `LAUNCHED` in that same dropdown stamps
  `projects.launchedAt` — but only the *first* time; moving to `ON_HOLD` or
  `ARCHIVED` afterward, or back to `LAUNCHED` again, never overwrites the
  original launch date. `updateProjectStatus` in
  `src/lib/queries/projects.ts` has the exact rule. Verified via a live
  script: launch → confirm stamp → move to `ON_HOLD` → confirm the date
  survived → re-launch → confirm it *still* didn't change.

## What's NOT built yet

- Dedicated Launch Mode screen (`/launch/[projectId]`) — launch readiness
  currently shows inline on the project page, not as its own gated view.
- Search.
- WooCommerce, HubSpot, Mailchimp, Webflow, Google Ads, TikTok Ads — no
  technology or template exists for any of these.
- Broad on-page SEO checklist (keyword research, meta descriptions, schema,
  OG tags, robots.txt, redirects) — only the GSC-specific slice is modeled.
- Granular responsive-breakpoint QA tasks (1920/1440/1024/768/430/390/375px)
  and API-key/secrets-exposure checks — QA coverage is solid but not that
  granular yet.
- Deploying off local dev onto Vercel (DB is already live on Supabase, code
  is on GitHub; the app itself isn't deployed anywhere yet).

A `custom_design` / "WebCornerstone Method" technology was tried in this
session (11-stage agency production methodology — Discovery Form, Client
Profile, Business Strategy Brief, etc.) and then reverted: it's written for
agency client-intake workflows, not solo-developer work. Not present in the
current template set.

## Auth + encrypted credential vault

Paul asked to store real per-account passwords (WordPress admin, email,
Klaviyo, etc.) in the Access & Links panel. Before building that, closed the
"anyone with the URL has full access" gap first — storing decryptable
passwords behind an unauthenticated app would have been false security.

**Auth** — a single shared-password gate, not full multi-user accounts
(this is a solo tool; that would've been overbuilt):
- `src/proxy.ts` — Next 16's renamed `middleware.ts` convention. Gates
  every route except `/login` and static assets; redirects to `/login` if
  the session cookie is missing or invalid.
- `src/lib/auth.ts` — `verifyPassword` (timing-safe comparison against
  `APP_PASSWORD`), and an HMAC-signed session cookie (signed with
  `SESSION_SECRET`, not just an opaque flag — tampering with the payload or
  signature is rejected). `requireAuth()` is a defense-in-depth recheck for
  sensitive Server Functions specifically, per Next's own docs warning that
  a matcher change or route refactor can silently drop Proxy's coverage of
  a Server Function.
- `src/app/login/page.tsx` + `src/lib/auth-actions.ts` (`loginAction`,
  `logoutAction` — the sidebar now has a Log out button).
- `SESSION_SECRET` was auto-generated and is fine to leave as-is (rotating
  it force-logs-out everyone, which is sometimes exactly what you want).
- **`APP_PASSWORD` is currently weak** (`paul@@` — 7 characters, your own
  name) — flagged directly, not fixed for you, since only you should set
  your own password. Replace it with a long random passphrase from a
  password manager before relying on this for anything real.

**Rate limiting** — the gap identified when asked "is this actually
strong": a password gate with unlimited guess attempts isn't a real gate.
- `login_attempts` table (DB-backed, not in-memory — an in-memory counter
  would silently reset on every cold start if this ever runs on a
  serverless platform like Vercel, which would quietly defeat the whole
  point). Global sliding window, not per-IP — this is a single-shared-
  password app, so per-IP tracking would add complexity (spoofable
  headers) without real benefit.
- 5 failed attempts within 15 minutes blocks further attempts — checked
  *before* the password is even looked at, so a locked-out request can't
  be distinguished from one that just hasn't tried yet.
- Every access-item action (create, update status, edit credentials,
  delete, reveal) now calls `requireAuth()` directly — not just the reveal
  action from before. Same defense-in-depth reasoning applied consistently
  across every credential-touching action, not only the most obviously
  sensitive one.
- Verified directly against the real DB: 0/1/2/3/4 failures all still
  allowed, 5th failure trips the lock with the correct 15-minute report.
  (Couldn't verify the full HTTP login flow with curl — Server Actions
  need Next's internal RSC invocation protocol, which a plain form POST
  doesn't replicate; confirmed this by checking curl's POST just
  re-rendered the login page rather than invoking `loginAction` at all.
  The direct function-level test exercises the exact same code path
  `loginAction` calls, in the same order, so it's equally meaningful.)

**Encrypted vault** — extends the Command Center's Access & Links panel:
- `src/lib/crypto.ts` — AES-256-GCM via Node's built-in `crypto` (no new
  dependency). Stored format is `base64(iv + authTag + ciphertext)` in a new
  `access_items.password_encrypted` column, plus a new
  `access_items.username` column.
- `ENCRYPTION_KEY` in `.env`, auto-generated. **Back this up somewhere
  safe** — losing it permanently loses every stored password, with no
  recovery path. Rotating it means re-encrypting every stored credential.
- `listAccessItems` deliberately never selects `password_encrypted` — the
  ciphertext isn't even sent to the client on a normal page load, only a
  `hasPassword` boolean. The plaintext is fetched only via
  `revealAccessItemPasswordAction`, triggered by an explicit click on the
  "show" link next to a masked `••••••••`, and never appears in any
  server-rendered page or RSC payload otherwise.
- Editing credentials: username always updates; a blank password field
  means "leave the existing password alone," not "clear it" (mirrors
  standard "leave blank to keep current password" UX). There's no separate
  "clear password" action in v1 — delete and re-add the item if you need to
  fully remove stored credentials.

Verified end-to-end against the real Supabase project: confirmed the raw DB
column actually holds ciphertext (not plaintext, not even a substring
match), confirmed `listAccessItems` never returns the ciphertext field at
all, confirmed decrypt-on-reveal recovers the exact original password,
confirmed blank-password-on-edit preserves the existing password while a
real value replaces it, and confirmed the Proxy gate blocks a cookie-less
request and passes a validly-signed one. Also directly unit-tested the
session-signing logic: correct/wrong/empty password, missing/garbage/
tampered-signature/tampered-payload cookies all resolve correctly.

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
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`). Schema pushed and seeded against the real
project (18 tables, 17 stages, 8 technologies) — verified via
`mcp__claude_ai_Supabase__list_tables`.

**Update (2026-08-15)**: `SUPABASE_SERVICE_ROLE_KEY` was actually the
*publishable* key (`sb_publishable_...`, Supabase's newer client-safe key
format) for the entire session up to this point — harmless while nothing
server-side used it, but it started mattering once the file-upload feature
needed real Storage admin access (bucket creation failed with an RLS error
until this was caught and fixed). It's now the real secret key
(`sb_secret_...`). Used server-only, in `src/lib/storage.ts`.

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
The new Storage bucket (below) is a separate case: it's accessed with the
service-role key, which bypasses Storage's own RLS by design.

## Gap-closing pass (2026-08-15) — search, maintenance, uploads, handoff, bulk actions

Prompted directly by asking "would this actually make a senior WordPress
dev's workflow fast?" and giving an honest answer that named five concrete
gaps. All five closed in this pass. Full design rationale is in
`ROADMAP.md`'s "Gap-closing pass" section — this section is the
implementation/verification record.

**Schema changes** (pushed live via `db:push`, no manual SQL):
- `projects.handoffToken` (nullable, unique) — powers the public handoff page.
- `attachments.url` relaxed from `NOT NULL` to nullable; new
  `attachments.storagePath` (nullable) — exactly one of the two is set per
  row now (external link vs. uploaded file).
- New `maintenance_plans` table (`projectId`, `name`, `cadenceDays`,
  `checklistTemplate` as newline-separated text, `nextDueAt`,
  `lastGeneratedAt`, `isActive`).

**Global search + command palette**: `src/lib/queries/search.ts`
(`searchAll`) does a plain `ILIKE` search across clients, projects, and
top-level tasks — no full-text index, deliberately, since this app runs at
dozens-of-rows scale, not millions. Backs both the `/search` page (SSR
fallback, works without JS) and `src/components/command-palette.tsx`
(`Ctrl/Cmd+K` or `/` outside a text field) — the palette also lists every
nav page as a static jump target when the query is empty, debounces live
search at 150ms, and supports arrow-key + Enter navigation. Mounted once in
`(dashboard)/layout.tsx`; a `SearchTrigger` button in the sidebar opens it
via a `window` custom event (`command-palette:open`) so the trigger doesn't
need to own the palette's state.

**Bulk actions**: `/tasks` — `src/components/task-bulk-list.tsx` adds a
checkbox per top-level task row and a sticky bulk bar (Mark Done / Mark
Skipped / Clear) once anything's selected.
`bulkUpdateTaskStatus(taskIds, status)` in `src/lib/queries/projects.ts`
updates every task in one `UPDATE ... WHERE id IN (...)`, batch-inserts
activity log rows, then recomputes and persists the health score for every
distinct affected project (same logic `updateTaskStatus` already used for a
single task, just looped over the affected project set).

**Recurring maintenance**: `src/lib/queries/maintenance.ts`. Generated
checklist items land as real tasks under the project's existing
`post_launch` stage (already part of every project's stage list — no new
stage needed) and get tagged `maintenance:YYYY-MM` for history. **No cron
runs this** — `/dashboard` surfaces a "Maintenance due" section
(`listDueMaintenancePlans` — active plans with `nextDueAt <= now`) and Paul
clicks "Generate this cycle's checklist" by hand. `nextDueAt` is anchored to
generation time (`now + cadenceDays`), not the previous due date, so a plan
left overdue for a while doesn't immediately show due again right after
catching up. `/maintenance` manages plans (create, edit cadence/checklist,
pause/resume, delete).

**Real file upload**: `src/lib/storage.ts` uploads to a **private**
Supabase Storage bucket named `attachments` (created via
`ensureAttachmentsBucket()`, run once against the live project). Validated
server-side before upload: 10MB cap, MIME type must start with
`image/`, `video/`, `application/pdf`, or be `text/plain` — this is the one
code path in the app that accepts arbitrary user-supplied binary content,
so it's checked before Storage is ever touched. Rendered attachments (in
`(dashboard)/projects/[id]/page.tsx`) get a **fresh signed URL generated on
every page render** (1hr expiry) — the bucket has no public URL at all, by
design. Paste-a-link attachments are untouched (`attachments.url` still
works exactly as before); upload is additive, not a replacement, in
`src/components/task-details.tsx`.

**Client-facing handoff page**: `generateHandoffLink`/`revokeHandoffLink`/
`getProjectByHandoffToken` in `src/lib/queries/projects.ts`. Token is
`randomBytes(24).toString("hex")` (48 hex chars, effectively unguessable).
`/handoff/[token]` is a standalone route (`src/app/handoff/[token]/`,
outside the `(dashboard)` route group — no sidebar, no auth chrome) and
`proxy.ts`'s matcher was updated to exclude `handoff` explicitly, since
this page is deliberately public — gated by possession of the token, not a
login. **Never shows passwords** — access items list name/URL/username
only; a note on the page tells the client to ask for a password reset/share
if they need one. Managed from a new "Handoff Link" panel in the project
page's Command Center (generate / copy / revoke).

### Verification

Ran `tsc --noEmit` (clean), `pnpm test` (34/34 passing — unchanged, no new
unit tests added since this pass is almost entirely new integration-style
query/action code exercised directly against the real DB instead), and
`eslint` on every touched file (clean; two pre-existing `react-hooks/set-state-in-effect`
issues were caught in the new `command-palette.tsx` and fixed by moving
state resets from `useEffect` bodies to the React-documented
"adjust state during render" pattern instead).

Then ran one disposable script (`_tmp_verify.ts`, deleted after) against the
live Supabase project — created a real client/project/task, exercised every
new code path against it, and asserted results directly against the
database, not just against return values:

- Search finds the created project and task by name.
- Bulk update actually flips the task's `status` column to `DONE`.
- A generated handoff token round-trips through `getProjectByHandoffToken`
  and includes the critical task; after revoke, the same token resolves to
  `null`.
- A new maintenance plan is immediately due; generating a run creates
  exactly the checklist's 3 tasks and advances `nextDueAt` by ~30 days.
- A real file upload creates an `attachments` row with `storagePath` set and
  `url` null; the signed URL it returns is fetchable over HTTP and returns
  the exact bytes that were uploaded; a disallowed MIME type is rejected
  before ever reaching Storage.

All 17 assertions passed. Cleaned up afterward: deleted the uploaded test
object from Storage, then the test project (must delete before the client —
`projects.clientId` has no `ON DELETE CASCADE` back to `clients`, unlike
every child-of-project table), then the test client; confirmed zero rows
remain matching the test data's name pattern.

**Not verified**: the UI has not been visually exercised in a real browser
this session (Chrome extension unavailable throughout) — the command
palette's keyboard interactions, the bulk-select bar's visual state, and the
maintenance plan edit form are built to the same patterns as already-
verified UI elsewhere in the app, but haven't been click-tested. (The
handoff page *has* been checked, via `curl` against the running dev
server — see below — since it's a plain server-rendered page with no
client JS to exercise.)

## Server Action body size limit fix

Hit a real error while testing the file-upload feature against a file over
1MB: `Body exceeded 1 MB limit`. Next.js caps Server Action request bodies
at 1MB by default — separate from and in addition to the 10MB app-level
check already enforced in `src/lib/storage.ts`. A large upload never even
reached that check; Next rejected it first. Fixed in `next.config.ts`:
`experimental.serverActions.bodySizeLimit: "11mb"` (10MB cap plus headroom
for multipart boundary/header overhead, per Next's own docs). **Requires a
dev server restart** — `next.config.ts` isn't picked up by Turbopack hot
reload.

## Handoff page: full checklist + client action items

Prompted by asking directly "does the handoff page cover everything to show
a client?" and "if you're a client, is that what you need?" — both honest
self-checks that found real gaps, closed in the same pass:

- **"Completed work" section**: the page originally only showed *critical*
  tasks (the launch checklist), so a lot of genuinely-completed work (QA,
  content, non-critical polish) was invisible to the client. Now shows
  every DONE top-level task, grouped by stage, above the launch checklist —
  `getProjectByHandoffToken` in `src/lib/queries/projects.ts` gained a
  `completedTasks` query (top-level, DONE, joined to stage name/sortOrder).
- **"What we need from you" section**: the launch checklist mixed
  internal dev/QA items ("Verify SSL is active") with genuinely
  client-owned items ("Get final client approval", "Record final
  sign-off") in one flat list — a client had no way to tell which
  unchecked boxes were actually waiting on them. `src/data/client-action-keys.ts`
  is a small, extensible allowlist of canonical keys that are real client
  actions (currently `handoff.client_approval` and `handoff.final_approval`
  — both always-included cross-cutting tasks, so present on every project
  regardless of tech stack). Those two get pulled out of the dev checklist
  entirely and shown in their own highlighted callout instead — same
  "add a key to the list" extensibility pattern as `forgotten-task-rules.ts`.

Verified directly against the real "Reptile Merch" project by fetching the
live dev-server-rendered HTML (`curl localhost:3000/handoff/<token>`) before
and after each change — confirmed "Completed work — 12 item(s) delivered"
grouped correctly by stage, and confirmed the launch checklist count
dropped from 5/21 to 5/19 (the 2 client-owned items moved out, not
duplicated) once "What we need from you" was added.

## Accounts & Access redesign (credentials → access-status tracking)

Prompted by direct pushback on the original vault design: *"client will
just add me as a user on their platform right?"* — correct, and a real
modeling error on my part. Most of these platforms (Shopify, GA4, GTM, GSC,
Clarity, Klaviyo, Meta Business Manager) are invite-based — the client adds
`paul@doveraagency.com` as a collaborator/admin from their own dashboard.
There's no password to store for that flow; what actually needs tracking is
whether the invite went out and landed. The one genuine exception is
**WordPress and a handful of other properties Paul creates himself** under
his own agency access (Cloudways, GA4, GTM, GSC, Clarity, the domain
registrar) — he already has access from day one there; the real event is
handing *ownership* to the client later, which the workflow engine already
tracks separately via `handoff.*_ownership` tasks.

**Status vocabulary** (`accessStatusEnum` in `src/db/schema.ts`):
`NOT_REQUESTED → REQUESTED → INVITED → GRANTED → VERIFIED`, plus
`NOT_NEEDED`. Migrated on the live DB via `ALTER TYPE access_status RENAME
VALUE 'RECEIVED' TO 'GRANTED'` (an in-place rename — Postgres supports this
directly, so existing rows kept their meaning with zero data loss) followed
by `ALTER TYPE ... ADD VALUE` for the three new states. Ran as raw SQL
*before* updating `schema.ts`, so the subsequent `db:push` saw a
zero-diff enum and only needed to add new columns — avoided the much
riskier drop-and-recreate path Postgres would otherwise require to shrink
an enum.

**New `accessItems` columns**: `role` (what to request — Administrator,
Editor, Owner...), `instructions` (the exact ask, auto-suggested per
technology, editable per project), `grantedAt` (stamped the *first* time
status reaches `GRANTED`/`VERIFIED`, never overwritten by later changes —
same one-time-stamp pattern as `projects.launchedAt`). `username` /
`passwordEncrypted` are untouched at the data layer — nothing deleted.

**`src/data/access-item-presets.ts`** rewritten from a flat name list to
structured presets: `{ name, defaultRole, ownership, instructions }`.
`ownership: "self_created"` items (WordPress Admin, Cloudways, GA4, GTM,
GSC, Clarity, Domain Registrar) are inserted at project creation already
`GRANTED` with `grantedAt` stamped immediately — there's nothing to wait on
since Paul made them. `ownership: "client_invite"` items (Shopify Admin,
Klaviyo, Printify, GoHighLevel, Meta Business Manager) start
`NOT_REQUESTED` with an auto-filled instructions string (e.g. *"Ask the
client to add paul@doveraagency.com as an Administrator in Settings → Users
and permissions"*) pulled from the new `src/data/agency-info.ts` constant.

**UI** (`src/components/access-items-panel.tsx`, full rewrite): section
renamed "Links & Access" → **"Accounts & Access"**; primary add-flow is now
role + instructions, not username/password. The username/password fields
(AES-256-GCM vault, unchanged encrypt/decrypt logic) moved behind a
collapsed **"Shared login instead?"** toggle — present but no longer the
default assumption, per your call to keep it as a secondary path for the
real exceptions (a shared inbox, WP admin pre-handoff) rather than removing
it or keeping it equally prominent.

**Handoff page**: access items now show their status badge (Granted/
Verified/Requested/etc.) next to each account, and items marked
`NOT_NEEDED` are excluded from the client-facing list entirely (query-level
filter in `getProjectByHandoffToken`, not just a UI hide).

### Verification

`tsc --noEmit` clean, `pnpm test` 34/34 passing (unchanged — this pass is
integration-style query code, verified directly against the DB instead of
new unit tests), `eslint` clean on every touched file (one apostrophe
lint error introduced and fixed in the same pass). Then a disposable script
against the real Supabase project — created a real client/project spanning
WordPress + GA4 + Shopify + Klaviyo (covering both ownership types in one
generation) and asserted 19 things directly against the database:
`self_created` items land `GRANTED` with `grantedAt` stamped at creation;
`client_invite` items land `NOT_REQUESTED` with no `grantedAt` and a
correctly-filled instructions string; a full
`REQUESTED → INVITED → GRANTED → VERIFIED` transition stamps `grantedAt`
exactly once (confirmed the *second* stamp-eligible transition does **not**
move the timestamp); the shared-login fallback (create/edit/reveal) still
works end-to-end unchanged; `listAccessItems` still never exposes
ciphertext; and the handoff page includes a `GRANTED` item's status while
excluding a `NOT_NEEDED` one. All 19 passed. Cleaned up afterward (project
before client, per the FK constraint noted earlier in this doc); confirmed
zero rows remain matching the test data's name pattern.

## Command Center → operational dashboard (2026-08-17)

Full design rationale (brutal review, what got cut and why, what's
deliberately not built yet) is in `ROADMAP.md`'s matching section — this is
the implementation record. Delivered as a design-artifact mockup first
(published for review), then implemented against the real
`(dashboard)/projects/[id]/page.tsx` in the app's existing visual language,
not the mockup's separate design system — that reskin question was flagged
directly rather than assumed.

**New components** (all pure/presentational, no new client-side state
beyond the one waiting-on-client checkbox): `project-pulse.tsx`,
`project-timeline.tsx`, `next-actions-card.tsx`, `waiting-on-client-card.tsx`,
`recent-activity-card.tsx`.

**Schema**: `tasks.isWaitingOnClient` (boolean) + `tasks.waitingOnClientSince`
(timestamp, stamped on flag / cleared on unflag). Pushed live via `db:push`
— purely additive, no migration risk.

**New queries** in `src/lib/queries/projects.ts`: `listRecentActivity`
(reads the long-populated-but-never-displayed `activity_logs` table, left-joined
to `tasks` for a readable task title), `setTaskWaitingOnClient` /
`listWaitingOnClientTasks` (oldest-first, excludes Done/Skipped).

**Removed**: the old top-right `healthScore` corner display and the
separate "Launch readiness: X/Y — Ready/Not ready" summary line — both
subsumed by Pulse's readiness stat, avoiding two overlapping completion
percentages on one page.

### Verification

`tsc --noEmit` clean, `eslint` clean on every touched file, `pnpm test`
34/34 (unchanged — this pass is new query/presentational code, verified
directly against the DB and against real project data instead).

Pulse/Timeline/Next-Actions math was run against both real live projects
("Shopify Setup," "Reptile Merch") by replicating the exact page
computation in a disposable script and inspecting output — confirmed no
`NaN`/crashes, correct handling of a null `targetLaunchDate`, and a
sanity-checked edge case: a stage can legitimately show "done" even after
the "current" stage marker (e.g. Access & Credentials fully done while
Discovery — an earlier stage — still has open work), which the algorithm
handles correctly by checking each stage's own completion first rather than
assuming strict sequential progress.

Waiting-on-client and activity feed were verified end-to-end against the
real Supabase project: flagged two tasks a second apart, confirmed
oldest-first ordering and an accurate `waitingOnClientSince` stamp;
unflagging cleared the stamp and removed it from the list; marking a still-flagged
task DONE also removed it (Done tasks are never "waiting" regardless of the
flag); and a real status-change activity log entry appeared correctly
formatted and newest-first. 8/8 assertions passed; test client/project
deleted afterward, confirmed zero rows remain matching the test name
pattern.

Auth blocked a plain `curl` render check of the authenticated page itself
(same limitation noted earlier in this doc — Server Actions/login can't be
driven by a bare POST) — the data-layer verification above is the same
computation the page actually runs, so it's an equally meaningful check,
just not a pixel-level one. The Chrome extension has been unavailable all
session; the actual rendered layout hasn't been eyeballed in a browser yet.

## Tabbed project page (2026-08-17)

Follow-up: the page above was still one long scroll — the per-stage task
board (40-70+ tasks across many stages on real projects) sits below all of
Command Center's new sections. Split into two tabs via a new
`src/components/project-tabs.tsx` (client component, plain `useState`,
inactive panels hidden with `className="hidden"` rather than unmounted, so
nothing inside them — e.g. `AccessItemsPanel`'s local edit-state — resets
on tab switch): **Command Center** (Pulse, Timeline, Next Actions, Waiting
on Client, Launch Checklist, Recent Activity, Overview form, Accounts &
Access, Handoff Link) and **Tasks** (the ad-hoc-task form + full per-stage
board), with the Tasks tab showing a live count badge. All server-side data
fetching stayed exactly as-is in `page.tsx` — this is a pure client-side
render split, both tabs' content is server-rendered up front. `tsc`/`eslint`/
`pnpm test` all clean; not yet visually confirmed in a browser (Chrome tool
unavailable all session, noted above).

## Five more tabs: QA, Files, Notes, Activity, Settings (2026-08-17)

Grew the project page from 2 tabs to 7: **Command Center, Tasks, QA, Files,
Notes, Activity, Settings**. QA split out of Tasks per direct request ("make
the tasks only related on what we are building") — `stages.filter(s =>
s.key !== "qa")` for Tasks, the QA stage alone for its own tab, both reusing
a single new `TaskStageBoard` component (`src/components/task-stage-board.tsx`)
extracted from what used to be ~150 lines of inline JSX in `page.tsx` — so
the two boards can never drift out of sync with each other. The Tasks tab's
badge now counts only build-stage tasks (was previously all-project,
inflated by QA); Pulse's project-wide "tasks remaining" stat is unchanged.

**Schema**: `attachments.taskId` relaxed to nullable, new
`attachments.projectId` (exactly one of the two set — same invariant
pattern as `url`/`storagePath` already on that table). `projects.notes`
(text, nullable). Both additive, pushed live cleanly.

**Files tab**: `listProjectAttachments` unions task-scoped and
project-scoped attachments into one feed (left-join to `tasks` for a "via
{task title}" label on the task-scoped ones). Uploading a general project
file (a logo, a brand guide — nothing tied to a specific task step) goes
through a new `uploadProjectAttachment` in `src/lib/storage.ts`, refactored
to share its validation/upload logic with the existing task-attachment
path via a new `validateAndUpload` helper rather than duplicating the
10MB/MIME-type checks. Removal reuses the *existing* `removeTaskAttachment`
query function, generalized to resolve the owning project either directly
(`projectId` set) or via the task (`taskId` set) — no new remove action
needed.

**Notes tab**: single `projects.notes` textarea, autosave on blur — same
shape as every other simple field in this app (`ProjectOverviewForm`,
`AccessItemsPanel`'s instructions field). Deliberately not a wiki.

**Activity tab**: the exact same `listRecentActivity` query the Command
Center's compact card already used, called again with a high limit (500)
instead of the card's default cap of 8, grouped into Today / Yesterday /
This week / Earlier buckets. The message-formatting and relative-time
logic used to live inside `recent-activity-card.tsx` only — pulled out
into `src/lib/format-activity.ts` so both the compact card and the new
full tab stay byte-for-byte consistent instead of two copies drifting.

**Settings tab**: technologies (read-only reference list — no retroactive
"add a technology" flow, that's a separate, riskier feature not in scope
here), this project's maintenance plans (reused `CreateMaintenancePlanForm`
+ `MaintenancePlanRow` unchanged, except the create form gained an optional
`lockedProjectId` prop so it skips the project picker when embedded on a
single project's page instead of the global `/maintenance` list), and a
Danger Zone with "Delete project" — moved here from the page header, so a
destructive action isn't sitting in the header on every single visit.

### Verification

`tsc --noEmit` clean, `eslint` clean on every touched file, `pnpm test`
34/34 (unchanged — no new pure-function logic was added that unit tests
would cover; this pass is new query/component/storage code, verified
directly). A disposable script against the real Supabase project created a
project with one QA-stage task and one build-stage task and asserted 12
things directly against the database and Storage: `getProjectDetail` now
returns a `technologies` array; both tasks land under their correct
`stageId`; notes save and clear correctly; a mixed file listing correctly
distinguishes a project-level upload (`taskTitle: null`) from a task-level
one (`taskTitle` populated); the project-level file's actual byte content
round-trips through its signed URL; the generalized `removeTaskAttachment`
correctly resolves and removes a project-level file while leaving the
task-level one untouched; and a fresh project correctly shows zero
maintenance plans via the new project-scoped query. All 12 passed. Cleaned
up afterward — deleted the uploaded Storage objects, then the test
project/client; confirmed zero rows remain matching the test name pattern.

Same caveat as every UI change this session: not yet visually confirmed in
an actual browser (Chrome tool unavailable throughout).

## Full-width page + Command Center visual pass (2026-08-17)

Paul finally sent a real screenshot of the running app — confirmed the
7-tab structure above is genuinely live (tab labels, badge counts all
matched), and surfaced a real bug: the project page was capped at
`max-w-4xl` inside an already-wide `<main>`, leaving a large dead strip on
any real monitor. Changed to `max-w-[1400px]`.

Then a full visual pass on the Command Center tab against a second
reference image (a StudioHub-branded mockup), asked to be copied "exactly."
Two deliberate deviations from that reference, called out directly rather
than silently diverged from:
- The reference shows the same 4 numbers (launch date, tasks remaining,
  health, last activity) twice — once in a "Project Pulse" hero and again
  in a second row of mini-cards. That's the redundancy this app's own
  brutal-review pass already flagged and cut; not reintroduced here.
- The reference has a "Responsibility" card (assigns a task owner among
  named people). Team feature, already correctly excluded for solo use —
  the equivalent real signal for a solo dev (the *client* being the
  blocker) already exists as the Waiting on Client card, placed in the
  same layout slot instead.

**Pulse row**: added a colored icon circle per stat (🚀 readiness, 📅
launch date, ⚠ attention, ☑ tasks remaining) plus a progress bar under
readiness — matches the reference's mini-card treatment without the
duplicate second row.

**Timeline**: converted from a horizontal stepper to a vertical dated-style
list (connecting line, filled/outlined nodes, status text). Deliberately
shows status ("Complete"/"In progress"/"Pending"), not per-stage dates —
the reference invents specific dates per stage (Aug 24, Aug 28...) that
don't exist anywhere in this app's data model, and fabricating them would
be worse than omitting them.

**Accounts & Access**: added a colored monogram chip per platform (first
letter, deterministic color — a real lookup table for ~10 known platforms
in `src/components/access-items-panel.tsx`, hash-based fallback color for
anything else). Explicitly not real brand logos — no external logo assets
exist in this app and scraping real trademarked marks wasn't the right
call. Zero functional changes — every edit/remove/reveal/credentials path
from the earlier redesign is untouched.

**Launch Checklist**: new `src/components/launch-checklist-card.tsx` —
grouped by each task's actual project stage (Discovery, Security, QA...)
instead of the reference's invented categories (Website/Infrastructure/
Analytics), since real stage data was already sitting right there and is
more accurate than fictional buckets.

**Layout**: Overview + status now a slim top bar; Pulse row; a 3-column
`lg:grid-cols-3` row (Timeline / Accounts & Access / Launch Checklist); a
2-column row (Next Actions / Waiting on Client); a 2-column row (Recent
Activity / a newly-promoted standalone Handoff card, previously buried
inside the old single big "Command Center" wrapper box). All collapse to
one column below the `lg` breakpoint.

### Verification

`tsc --noEmit` and `eslint` clean on every touched file, `pnpm test`
34/34 (unchanged — this is a presentational/layout pass, no new pure
logic). Re-ran the checklist-grouping math against both real live
projects — **Shopify Setup's 14% matched Paul's own screenshot exactly**,
confirming the numbers already live in production are correct; grouped
correctly by real stage name with zero empty/missing groups on either
project. Still not visually confirmed in an actual browser — same
recurring caveat, Chrome tool unavailable all session (checked again
before this pass, still disconnected).

## shadcn/ui: Project Header redesign (2026-08-17)

Scoped request — redesign only the persistent header above the tabs
(breadcrumb, hero, KPI row), not the rest of the page. First real use of
shadcn/ui in this app: `components.json` and one generated component
(`button.tsx`) already existed from an earlier, unused scaffold — added
Badge, Card, DropdownMenu, Select, Avatar, Separator, Breadcrumb, Tooltip
via `npx shadcn@latest add`. All built on `@base-ui/react` and
`lucide-react`, both already dependencies — no new packages installed.

**One real conflict, resolved by asking rather than guessing**: the
requested spec included a "Team members" KPI card, which doesn't apply —
this app is explicitly solo, and a "Responsibility" team card was already
cut earlier this session for the same reason. Asked directly; replaced
with a **Client** card (name + contact email) instead of building a card
that would always just say "1 · You."

**New `src/components/project-header.tsx`** (client component): shadcn
Breadcrumb (Projects → Client → Project, all real links), a colored
monogram avatar (same hash-based pattern already used for Accounts &
Access platform chips), title + status Badge + a health indicator derived
from the existing `healthScore` calculation + a "Ready for Launch" badge
when every critical task is done (previously shown in the old inline
title, not dropped). Right side: status now a shadcn Select
(`project-status-select.tsx` rebuilt on it, same
`updateProjectStatusAction` underneath, zero behavior change), a shadcn
DropdownMenu for quick actions (View client, Copy handoff link — generates
one on the fly via the existing `generateHandoffLinkAction` if none exists
yet, Project Settings), and `AddTaskForm` promoted from inside the Tasks/QA
tab bodies to the persistent header CTA — restyled onto shadcn `Button`,
identical fields/logic otherwise. Below: a 5-card KPI row (Progress,
Current Milestone, Outstanding Issues, Launch Countdown, Client).

**Real bug found and fixed along the way**: the page was capped at
`max-w-4xl` inside an already-wide `<main>`, confirmed from a real
screenshot Paul sent — changed to `max-w-[1400px]`.

**Two things deliberately not literal 1:1 with the request**:
- The header's KPI "Progress %" is *overall* completion (all top-level
  tasks done/total) — a different, new metric from the Launch Checklist
  card's critical-only readiness %, kept distinct rather than duplicated.
- "Project Settings" in the quick-actions menu needed the tabs to actually
  respond to it — `ProjectTabs` gained a `slug` per tab and now reads an
  initial tab from `?tab=` via `useSearchParams`, rather than shipping a
  menu item that looked like it worked but silently did nothing.

**Consistency fix caught during verification**: `tasksRemainingInStage`
(the Current Milestone card's sub-line) was initially top-level-tasks-only,
which could read "0 tasks left in this stage" while the stage still showed
as the *current* (not-done) milestone — because the "done" check for a
stage considers subtasks too. Widened the count to match, confirmed live
against Reptile Merch: Discovery correctly reads 3 remaining (was
incorrectly reading 0) now that a still-open subtask is the reason the
stage isn't done.

### Verification

`tsc --noEmit` clean, `eslint` clean on every touched file, `pnpm test`
34/34. Additionally ran a full **production build**
(`next build`) specifically to check for the `useSearchParams`-without-
`Suspense` failure Next's own docs call out as a real build-time-only
error — compiled and type-checked successfully (the phase that error
would surface in); the build did fail afterward, but on an unrelated page
(`/maintenance`) hitting the Supabase pooler's connection limit during
static generation — a pre-existing characteristic of an app that has only
ever run via `next dev` and never been built for production before, not
something introduced by this change, and out of scope to fix here.
Re-verified the header's computed stats (overall progress %, current-stage
task count, client email) against both real live projects with no
`NaN`/crashes, caught and fixed the subtask-counting inconsistency above
in the process. Still not visually confirmed in an actual browser — same
recurring caveat.

## KPI row moved into Command Center + full-width page (2026-08-17)

Two quick follow-ups from the same screenshot exchange. First: the 5-card
KPI row (Progress/Milestone/Issues/Countdown/Client) moved out of the
persistent header — where it showed on every tab — into the top of the
Command Center tab specifically, since that's the one summary/dashboard
view where it actually belongs; the other 6 tabs no longer carry it.
Extracted into its own `src/components/project-kpi-row.tsx` (pure
presentational, no logic changes) so `project-header.tsx` could drop the
now-unrelated props (`overallProgressPercent`, `tasksDone`, `tasksTotal`,
`currentStageName`, `tasksRemainingInStage`, `issuesCount`,
`daysToLaunch`, `clientEmail`) entirely — the header component is now
scoped purely to identity/status/actions, matching what it actually shows.

Second: `max-w-[1400px]` from the earlier width fix still wasn't full
width on a real wide monitor (per a follow-up screenshot) — changed to
`w-full`, filling the entire `<main>` content area with no artificial cap
at all.

`tsc --noEmit`, `eslint`, and `pnpm test` (34/34) all clean after both
changes.

## Project Pulse card (2026-08-17)

Requested from a reference image showing a 4-panel hero (Launch Readiness,
Needs Attention, Next Milestone, Launch Countdown). Flagged directly before
building: two of those four panels are the exact same numbers as two KPI
cards one glance below — asked, and trimmed to the two that aren't
duplicates: **Launch Readiness** (critical-task % — genuinely different
from the KPI row's overall Progress %, and important enough to justify
appearing in both the hero and the detailed Launch Checklist card below)
and **Needs Attention**, which is the actually-new part — a real per-issue
list (not just a count) with a "Review →" link on each item routing to the
Tasks or QA tab via `?tab=`, sourced from the same live `getProjectIssues`
data the rest of the app already uses.

New `src/components/project-pulse-card.tsx`, first thing inside Command
Center, above the KPI row. "View checklist" is a real in-page anchor
(`#launch-checklist`, added to the existing `LaunchChecklistCard` wrapper)
rather than a link to nowhere. Verified against both real live projects:
readiness % matches prior verified numbers exactly (Shopify Setup 14%,
Reptile Merch 24%), both currently have zero flagged issues so the
"Nothing flagged" empty state is what's actually live right now — worth
knowing before judging the Needs Attention panel's layout against a real
screenshot, since it'll look different once an issue is actually flagged.

`tsc --noEmit`, `eslint`, `pnpm test` (34/34) all clean.

## Accounts & Access redesign: real logos, one-click connect (2026-08-17)

Two asks: bound the 3-column grid's height ("make the grid fit"), and
rework Accounts & Access so viewing/connecting a platform needs no clicks
to see and one click to update — plus real brand logos instead of colored
monogram letters.

**Dependency note**: installing the logo package hit a real hazard —
`npm install react-icons` (used out of habit) partially bypassed this
project's pnpm-managed `node_modules`, created a stray `package-lock.json`
(this repo is pinned to pnpm specifically to avoid a second lockfile
confusing deploy tooling, per this doc's own "Running this locally"
section). Caught immediately: deleted the npm lockfile, re-ran `pnpm
install` to resync `node_modules` and `pnpm-lock.yaml` properly. No lasting
damage, but a reminder to use `pnpm add` directly next time, not `npm
install` out of habit.

**Real logos**: `react-icons` (wraps Simple Icons, MIT-licensed, the
standard library for exactly this use case — third-party brand marks in a
UI, not scraping official logo assets) — new `src/components/platform-icon.tsx`
keyword-matches an access item's free-text name against 10 platforms with
real icons (WordPress, Elementor, Shopify, Google Analytics, Search
Console, Tag Manager, Meta, Facebook, Cloudways, plus a generic globe for
"Domain"). Klaviyo, Printify, GoHighLevel, and Microsoft Clarity have no
icon in Simple Icons — falls back to the existing colored-monogram circle
for those (and for any custom name someone types in), rather than showing
nothing. Verified: 8 of the 12 real preset platform names in this app
resolve to a real logo; the other 4 fall back cleanly.

**Row redesign** (`access-items-panel.tsx`, full rewrite): default view is
now icon, name, a colored status pill, and an "Open" button — nothing
else. The status pill *is* the one-click action: click marks it Connected
directly (skips the old dropdown-open-then-pick two-step for the by-far
most common case), stamping `grantedAt` the same way it always has. All
the more nuanced control — the full 6-state dropdown for
Requested/Invited/Not Needed, role/instructions editing, the shared-login
vault, remove — moved behind a small settings-icon toggle per row instead
of being visible by default. Nothing was removed, only decluttered: same
actions, same server functions, just not all visible at once.

**Grid fit**: capped the Accounts & Access list at `max-h-80 overflow-y-auto`
— matches the bounded-height pattern the Launch Checklist card already
used (`max-h-72 overflow-y-auto`). CSS Grid stretches row items to equal
height by default, so an unbounded Accounts list with many platforms was
previously dragging Timeline and Launch Checklist taller than their own
content needed — this was the actual cause of the "doesn't fit" look.

### Verification

`tsc --noEmit`, `eslint`, `pnpm test` (34/34) all clean after the
dependency resync. Live-DB check: a fresh access item starts
`NOT_REQUESTED` with no `grantedAt`; simulating the pill's one-click action
sets it to `GRANTED` and stamps `grantedAt` in the same call — confirmed
the fast path doesn't bypass the existing stamp-once logic. Icon
resolution checked against all 12 real technology-preset platform names
from `access-item-presets.ts`, not just the ones in the reference
screenshot.

## Quick-add platform picker (2026-08-17)

"+ Add platform" no longer opens straight into a typed form — it opens a
grid of clickable platform chips (real logo + name) built from a new
`ALL_ACCESS_ITEM_PRESETS` export in `access-item-presets.ts`, deduped
across every technology's presets. Clicking a chip is the entire flow: a
new `quickAddAccessItemAction` looks up that preset server-side and calls
the existing `createAccessItem` with its `defaultRole`/`instructions`
pre-filled, **and** its `ownership`-based initial status — self-created
platforms (Cloudways, GA4, GTM, GSC, Clarity, WordPress, domain registrar)
land already "Connected," client-invite ones (Shopify, Klaviyo, Printify,
GoHighLevel, Meta) land "Not requested" — exactly the same logic
`createProjectWithWorkflow` already used when seeding a brand-new project,
now reachable for adding a platform *after* the fact too (a client hands
over a Facebook account mid-project, say), not just at creation time.

Platforms already tracked on the project are filtered out of the picker
(matched case-insensitively against existing names) so it only ever offers
what's actually missing. A "+ Custom platform…" chip at the end still opens
the original typed form — nothing was removed, the free-text path just
isn't the default anymore since most real usage is one of the ~12 known
platforms.

### Verification

`tsc --noEmit`, `eslint`, `pnpm test` (34/34) clean. Live-DB check (9
assertions): the catalog has all 12 presets deduped correctly;
self-created vs. client-invite presets land with the correct initial
status and `grantedAt` behavior when quick-added (mirroring the
project-creation seeding logic exactly); role/instructions carry over from
the preset; and the "already added" filter correctly excludes
already-tracked platforms while still offering the rest. Cleaned up
afterward.

## Accounts & Access: remove internal scroll (2026-08-17)

Follow-up from a real screenshot: the `max-h-80 overflow-y-auto` cap added
earlier this session (to stop an unbounded platform list from stretching
Timeline/Launch Checklist taller than their own content) produced an
internal scrollbar Paul didn't want — asked for the panel to just fit its
own content instead. Removed the cap entirely, and switched the 3-column
grid (`page.tsx`) from the CSS Grid default (`align-items: stretch`, every
column forced to the row's tallest height) to `items-start`, so each of
Timeline / Accounts & Access / Launch Checklist now sizes to its own
content independently — Accounts & Access can grow as tall as it needs
without dragging the other two down with it (or, previously, without them
visibly capping and scrolling). `tsc`, `eslint`, `pnpm test` (34/34) clean.

## Accounts & Access: self-contained card, no row dividers (2026-08-18)

Two more follow-ups from real screenshots. `AccessItemsPanel` now owns its
entire card — title, description, and the border/background wrapper all
moved *into* the component (previously the header lived in `page.tsx`,
outside the component, which was the actual reason "+ Add platform"
couldn't sit next to the title before: the button's click handler needs
the component's internal `addMode` state). `page.tsx` now just renders
`<AccessItemsPanel projectId items />` directly in the 3-column grid, same
self-contained pattern `LaunchChecklistCard` already used.

"+ Add platform" moved from a text link at the bottom of the list to an
actual bordered button in the header, top-right next to the title — same
position/treatment as the reference. Removed the `divide-y` row separator
lines entirely; rows now separate with whitespace only (`py-2` per row,
`p-4` on the card), matching the reference's borderless list look.

`tsc`, `eslint`, `pnpm test` (34/34) all clean.

## Accounts & Access: "Open" falls back to a real login page (2026-08-18)

Each row's "Open" button used to only work once a project-specific URL had
been typed in — until then it rendered as a disabled-looking placeholder,
even though most of these platforms have a well-known login page that's
true for every project (analytics.google.com is always analytics.google.com,
regardless of client).

`src/components/platform-icon.tsx` was restructured from two separate
configs (icon-only) into one `PLATFORM_META` list per platform carrying an
optional `Icon` *and* an optional `loginUrl`, keeping the existing
keyword-match approach. New export `resolvePlatformLoginUrl(name)`. Added
generic login URLs for GA4, GSC, GTM, Shopify, Cloudways, Meta/Facebook,
Klaviyo, Printify, GoHighLevel, Microsoft Clarity, and Domain Registrar
(GoDaddy, consistent with the agency-GoDaddy-as-primary convention
documented earlier in this file). **Deliberately no login URL for
WordPress or Elementor** — those are self-hosted per site, so there's no
single correct URL to guess; a wrong guess would be worse than the
placeholder it replaces.

`AccessItemRow` in `access-items-panel.tsx` now computes
`item.url || resolvePlatformLoginUrl(item.name)` and uses that for the
"Open" link — a saved project-specific URL still always wins. The
placeholder `<span>` only remains for platforms with neither (custom
free-text names, or WordPress/Elementor with no URL saved yet), with a
`title` tooltip explaining why. When falling back to the generic URL, the
link also gets a `title` tooltip noting it's the platform's login page, not
a project-specific one.

### Verification

`tsc --noEmit`, `eslint` on both changed files, `pnpm test` (34/34) — all
clean. Pure-function check via a disposable script: ran
`resolvePlatformLoginUrl` against every real preset name in
`ALL_ACCESS_ITEM_PRESETS` (the same 12-platform catalog the quick-add
picker uses) — all 11 platforms with a known login page resolved to the
correct URL, and WordPress Admin correctly resolved to `(none)`. No DB
involved (pure function), no cleanup needed.

## Dashboard: Project Pulse strip per active project (2026-08-18)

Requested from a detailed spec for a 4-card "Project Pulse" section (health,
Needs Attention, Next Milestone, Launch Countdown) — the spec's own mock
data (82%, 12/35 tasks, a single milestone/launch date) is single-project
shaped, but `/dashboard` is cross-project (aggregates across every active
project), so this was a real scope question, not a styling one. Asked
directly rather than guessing which of three interpretations was meant
(one aggregate row vs. one row per project vs. actually belongs on the
project page); Paul picked **one Pulse row per project**, replacing the
old plain "Active projects" list.

**New query**: `listProjectPulseSummaries()` in
`src/lib/queries/projects.ts` — one `getProjectDetail` call per active
project (not two; `getProjectIssues` normally re-fetches detail
internally, deliberately avoided here since this now runs once per active
project on every dashboard load). Derives, per project: health score
(existing), top-level task done/total, `checkProject` issues (same
forgotten-task rule engine used everywhere else), current milestone (first
stage — in `project_stages` sort order — that isn't fully done/skipped,
plus that stage's own completion %, same "current stage" logic the project
page's own Timeline already uses), and days-to-launch from
`targetLaunchDate`. **No fabricated per-milestone ETA date** — the spec's
"Target Aug 22" field was left out, same reasoning as the project page's
Timeline decision earlier this session: there's no real per-stage due-date
data in the model, and inventing one would be worse than omitting it.

**New component**: `src/components/dashboard-project-pulse.tsx` — a
per-project header row (name + client, linked to the project, with an
overall On track/At risk/Behind `Badge`) above a 4-card `grid` (shadcn
`Card`/`Badge`, `lg:grid-cols-4` down to a single column on mobile), one
row per active project. Needs Attention shows a real top-3 issue preview
(not just a count); Next Milestone shows the stage name + % with a small
progress bar; Launch Countdown color-codes overdue (red) / due within a
week (amber) / on schedule (green) / no date set (grey).

**Removed**: the old flat "Needs attention — potentially forgotten"
global list and the plain "Active projects" list — both are now
redundant, since each project's own Pulse row surfaces its own top issues
and links straight to the project. The three top-of-page aggregate tiles
(active count / avg health / total issues) stayed — that's a genuinely
different altitude (portfolio glance before scrolling), not a duplicate of
the per-project numbers below them. Page wrapper widened `max-w-5xl` →
`max-w-6xl` to give the 4-column card rows room.

### Verification

`tsc --noEmit`, `eslint` on all three changed/new files, `pnpm test`
(34/34) — all clean. Live-DB check via a disposable script: ran
`listProjectPulseSummaries()` against the real Supabase project's 2 actual
active projects (Shopify Setup, Reptile Merch) — confirmed real, sane,
non-`NaN` values for both (health 11%/26%, correct task ratios, correct
current-stage names and percentages, correct days-to-launch), zero issues
flagged on either (matches what Command Center already showed for both
earlier this session). No cleanup needed (read-only check, no test data
created).

## Same Project Pulse design moved onto the project page itself (2026-08-18)

Immediate follow-up: put the same 4-card design on each project's own
Command Center tab, replacing the old `ProjectPulseCard` (Launch
Readiness + Needs Attention, 2 panels) and `ProjectKpiRow` (Progress /
Current Milestone / Outstanding Issues / Launch Countdown / Client, 5
cards) that used to sit stacked there — both deleted outright, fully
superseded, not left as dead code.

**Refactor**: the 4-card grid itself (`healthState`, `launchState`,
`CardShell`, and the card markup) was pulled out of
`dashboard-project-pulse.tsx` into a new shared
`src/components/project-pulse-cards.tsx` exporting `ProjectPulseCards({
summary })`. `DashboardProjectPulse` (used on `/dashboard`, looped per
active project) now just wraps it with the name/client/health-badge header
row that makes sense when scanning *multiple* projects at once.
`ProjectPulseCards` alone — no header — is what's now embedded directly on
a single project's Command Center tab, under a plain "Project Pulse"
label; repeating the project's own name/client there would be redundant
with `ProjectHeader` immediately above it on the same page, which already
shows both plus a health badge.

**Data**: rather than adding a second DB round-trip by calling
`listProjectPulseSummaries()` again from inside the project page (it
already re-fetches `getProjectDetail` per project, wasteful when the page
already has that project's detail in scope), `page.tsx` builds a
`ProjectPulseSummary` object directly from data it already computed —
`healthScore`, `tasksDone`/`tasksTotal`, and the `issues` array it already
had loaded. Milestone name/percent didn't previously exist on the project
page in that shape (it had `nextStageName` + a *remaining-count*, not a
percent) — added `milestonePercent`, computed with the exact same
"current stage = first not fully done/skipped, in sort order" logic as the
dashboard version and as the page's own pre-existing `Timeline`. The now
fully-superseded `overallProgressPercent`, `readinessPercent`,
`nextStageName`, and `tasksRemainingInStage` locals were removed rather
than left unused.

### Verification

`tsc --noEmit`, `eslint` on all three touched/new files, `pnpm test`
(34/34) — clean. Consistency check via a disposable script: independently
re-ran both the project page's inline milestone/task-count math and
`listProjectPulseSummaries()`'s version against every real project in the
live Supabase DB and diffed them field-by-field — `tasksDone`,
`tasksTotal`, `milestoneName`, and `milestonePercent` matched exactly for
both real active projects (Shopify Setup: 15/76, Discovery 18%; Reptile
Merch: 8/64, Discovery 73%), confirming the duplicated logic didn't drift
between the two call sites. No cleanup needed (read-only check).

## Command Center: swapped Timeline and Overview positions (2026-08-18)

Swapped which section is the full-width bar above the 3-column row and
which sits inside it: `Timeline / Milestones` (self-contained card, was
the first of the 3 grid columns) moved up to the full-width slot; `Overview`
(domain / target launch date — not self-contained, relied on `page.tsx`'s
wrapper `div` for its border/background) moved into the grid's first
column, now given its own `rounded-lg border ... p-4` wrapper matching its
new siblings (Accounts & Access, Launch Checklist) since it previously
borrowed the full-width wrapper's padding (`p-3`) instead of having one of
its own. `tsc`, `eslint`, `pnpm test` (34/34) clean.

## Timeline: back to a horizontal stepper (2026-08-18)

Immediate follow-up: now that Timeline sits in the full-width slot (above),
its old vertical dated-style list (a narrow column of stages down the left
side, from the earlier full visual pass) left most of the row empty.
Rewrote `project-timeline.tsx` back into a horizontal stepper — each
stage's node/name/status stacked in a fixed-width (`w-24`) column, joined
by a short connector line (`bg-[#0ca30c]` once a stage is done, `bg-black/10`
otherwise) — same status semantics and colors as before (green filled
circle + checkmark for done, blue outlined dot for current, grey outline
for pending), just laid out left-to-right instead of top-to-bottom. Wrapped
in `overflow-x-auto` on its own container (not the page body) so a
project with many stages scrolls horizontally within the card rather than
forcing the whole page wider. `tsc`, `eslint`, `pnpm test` (34/34) clean.

## Real bug: sidebar layout's `<main>` had no `min-w-0` (2026-08-18)

The horizontal stepper's own `overflow-x-auto` (added in the previous
change) wasn't actually containing the overflow — a real screenshot showed
stage nodes cut off flush at the browser edge with the whole page pushed
wide, not scrolling locally inside the Timeline card. Root cause wasn't in
`project-timeline.tsx` at all: `(dashboard)/layout.tsx`'s `<main
className="flex-1 p-8">` is a flex item (sibling of the sidebar `<aside>`
inside a `flex` row), and flex items default to `min-width: auto` — they
refuse to shrink below their content's intrinsic width. The stepper's
`min-w-max` inner `<ol>` (13 stages × ~96px+ each) gave `main` a large
intrinsic width, so the flex row grew `main` to fit it instead of letting
`overflow-x-auto` clip and scroll inside the card as designed.

Fix: `min-w-0` added to `<main>` (`min-w-0 flex-1 p-8`) — the standard fix
for this well-known flex/grid gotcha. This is a one-line, root-cause fix
at the layout level, not a per-page workaround: it applies globally, so
*any* future wide content anywhere in the app (a wide table, a code block,
another horizontal stepper) will correctly scroll within its own container
instead of blowing out the whole page — not just Timeline. Considered
"just show a compact overview + a separate full Timeline page" as an
alternative per Paul's own suggestion, but that would have papered over a
real CSS bug rather than fixing it, and the one-line fix is simpler and
prevents the same class of bug from recurring elsewhere.

`tsc`, `eslint`, `pnpm test` (34/34) clean. Not yet visually re-confirmed
in an actual browser (Chrome tool unavailable this session, as noted
throughout) — this is a well-understood, standard CSS fix for the exact
symptom shown in the screenshot (content escaping its scroll container and
widening the whole flex row), so confidence is high, but worth a quick
visual check next time the browser tool is available.

## Timeline redesigned: no scrollbar, progressive disclosure (2026-08-18)

Explicit pushback on the horizontal-scroll fix above: Paul didn't want a
scrollbar at all, and asked for a senior-product-designer, newbie-usable
take instead of just patching the overflow. The real problem with a
13-item stepper (scrolling or not) is that it makes someone scan every
stage to answer "where is this project right now?" — the wrong default
for a solo freelancer who wants the answer in one glance, not a research
task.

Redesigned `project-timeline.tsx` around **progressive disclosure**:
- **Always visible**: the current stage's name in large text (directly
  answers "where are we now"), an "X of Y stages complete" count, an
  "In progress"/"Complete" status line, and a single-row segmented
  progress bar — one flex-1 pill per stage (green done / blue current /
  grey pending), each with a `title` tooltip naming that stage on hover.
  A segmented bar scales to *any* number of stages without ever needing
  horizontal scroll, because `flex-1` segments compress rather than
  overflow — the opposite problem from the fixed-width stepper this
  replaces.
- **One click away**: a native `<details>/<summary>` "View all stages"
  disclosure (zero JavaScript, no client component needed — stays a
  server component) reveals the full per-stage list with status labels,
  for anyone who wants the detail. Collapsed by default so a newbie isn't
  shown 13 "Pending" rows on first look.

The `min-w-0` layout fix from the previous entry stays — it's a real,
general CSS correctness fix independent of this redesign (any future wide
content anywhere in the app benefits from it), even though Timeline itself
no longer needs it now that it can't overflow.

`tsc`, `eslint`, `pnpm test` (34/34) clean. Not yet visually confirmed in
a browser (tool unavailable this session, as noted throughout) — flagged
directly rather than claiming a pixel-level check that didn't happen.

## Overview card replaced with a 2x2 stat grid (2026-08-18)

Replaced the plain domain/launch-date text display inside the Overview
card with a 2x2 grid of the same `IconStatCard` mini-cards used in Project
Pulse: **Launch date** (formatted date + days-to-go/overdue), **Project
health** (On track/At risk/Behind, reusing `healthState` — same source of
truth as Project Pulse and the dashboard, so the label can never disagree
between sections), **Tasks remaining** (`tasksTotal - tasksDone`, of
total), **Last activity** (relative time of the most recent
`activity_logs` entry, "By Paul" — hardcoded, same pattern as the
dashboard's own hardcoded greeting, since this is a single-user app with
no other actor to attribute activity to).

`IconStatCard` (the icon-circle + label + value + sub-text shell) was
promoted from a `project-pulse-cards.tsx`-private `CardShell` to a shared,
exported component, so this is the same visual primitive in three places
now (dashboard Pulse strip, project-page Pulse strip, and this Overview
grid) rather than a fourth near-duplicate implementation.

**Editing was deliberately preserved, not dropped**: the reference image
only shows the read-only cards, but the old Overview card's domain +
target-launch-date edit form was real functionality, not just display —
removing it would have quietly taken away the only way to set a domain or
change the launch date. `ProjectOverviewForm` keeps its existing
`editing`-state toggle and "Edit" link unchanged; only the *non-editing*
display branch changed from the old 2-column domain/date text to the new
2x2 card grid. Domain itself is no longer shown in the compact glance view
(matching the reference, which doesn't show it either) but is still
editable via the same form — it just doesn't have its own always-visible
stat card.

`healthUpdatedAt` and `lastActivityAt` are passed down from data
`page.tsx` already had in scope (`project.updatedAt` — already stamped on
every health-score recompute by `updateTaskStatus`/`bulkUpdateTaskStatus`
— and `recentActivity[0]?.createdAt`) rather than adding new queries.

### Verification

`tsc --noEmit`, `eslint` on all three touched files, `pnpm test` (34/34) —
clean. Live-DB check via a disposable script: replicated the exact
tasksRemaining/health/last-activity computation against every real active
project (Reptile Merch, Shopify Setup, and a third, "FLPB", found already
live in the DB from Paul's own use) — all three produced sane, non-`NaN`,
non-negative values with correctly formatted relative times (e.g. "9m
ago", "6h ago"). No cleanup needed (read-only check).

## Overview: dropped the wrapper card and header, cards stand alone (2026-08-18)

Removed the bordered wrapper `div` around `ProjectOverviewForm` in
`page.tsx` (the 4 `IconStatCard`s are already individually self-bordered
shadcn `Card`s, so the outer wrapper was just a redundant second border)
and dropped the "Overview" title + "Edit" text link header entirely, so
the 4 cards render on their own with nothing above them — matching the
reference image exactly.

**Editing was kept, not silently dropped**: domain and target-launch-date
are real editable fields, not just display, so removing every trigger for
that form would have quietly broken the only way to set them. Rather than
an absolutely-positioned icon that risked overlapping the Project Health
card's own label in the 2x2 layout, `IconStatCard` gained an optional
`action` slot (right-aligned in its icon/label row — same shape as
shadcn's own `CardAction` pattern) and the Launch date card — the one
actually showing the field being edited — now carries a small icon-only
pencil button there. No visible label text, so it doesn't reintroduce a
header; hovering/tapping still reaches the same unchanged edit form
(domain + target launch date, Save/Cancel).

### Verification

`tsc --noEmit`, `eslint` on all three touched files, `pnpm test` (34/34) —
clean.

## Next Actions moved under Overview, in the same column (2026-08-18)

`NextActionsCard` moved out of its own 2-column row (previously paired
with `WaitingOnClientCard`) and now stacks directly below the Overview
2x2 stat grid, inside the same first column of the 3-column
Overview/Accounts & Access/Launch Checklist row — both wrapped in a
`flex flex-col gap-3` so they read as one vertical group in that column.
`WaitingOnClientCard`, now without its row partner, renders full-width on
its own line below that 3-column row instead of sitting in a half-empty
2-column grid. `tsc`, `eslint`, `pnpm test` (34/34) clean.

## Recent Activity: capped to 3, "View all" link, dropped stray margin (2026-08-18)

`RecentActivityCard` now shows only its 3 most recent entries (was up to
8) with a bordered "View all" button in its header, top-right, linking to
`?tab=activity` — the full-history Activity tab already built earlier this
session, not a new page. `page.tsx`'s `listRecentActivity(id)` call
changed from the default limit (8) to `listRecentActivity(id, 3)` to match
exactly what's displayed, rather than over-fetching and truncating
client-side.

This also fixes the actual height-mismatch Paul flagged: the card sits in
a 2-column grid row next to the Handoff card, which already stretches
both to equal height by CSS Grid default (no `items-start` on that row) —
so the two were never *misaligned*, but showing up to 8 activity rows
made Recent Activity's own natural height much taller than Handoff's,
forcing Handoff to stretch with a lot of dead space. Capping to 3 brings
its natural height back in line with its row partner. Also dropped a
stray `mb-4` that lived on the card's own root `div` (redundant once
inside a `gap-3` grid, and inconsistent since Handoff had no matching
margin) — was adding extra space under the left column only.

### Verification

`tsc --noEmit`, `eslint` on both changed files, `pnpm test` (34/34) —
clean. Live-DB check: ran `listRecentActivity(id, 3)` against every real
active project (FLPB, Reptile Merch, Shopify Setup) — each correctly
returned exactly 3 rows, newest first. No cleanup needed (read-only
check).

## Command Center: collapsed to 3 stacked columns (2026-08-18)

Moved Recent Activity and Client Portal/Handoff out of their own trailing
2-column row and into the existing 3-column Overview/Accounts &
Access/Launch Checklist grid, stacked (`flex flex-col gap-3`) under their
now-related cards: **column 1** is Overview → Next Actions → Recent
Activity; **column 2** is unchanged (Accounts & Access alone); **column
3** is Launch Checklist → Client Portal/Handoff. `WaitingOnClientCard`
(previously its own full-width row) is now the last element in Command
Center with nothing after it, so its wrapping `mb-4` div was dropped —
it renders directly, matching the no-trailing-margin convention already
used for the last section on this page. `tsc`, `eslint`, `pnpm test`
(34/34) clean.

## Timeline moved back to the top, above Project Pulse (2026-08-18)

Swapped the order of the two full-width bars at the top of Command
Center — Timeline/Milestones is now first, Project Pulse second. Pure
reorder, no styling changes to either section. `tsc`, `eslint`, `pnpm
test` (34/34) clean.

## "Project Pulse" label removed (2026-08-18)

Dropped the small uppercase "Project Pulse" heading above the 4-card row
— the cards render bare now, no label above them. `tsc`, `eslint`, `pnpm
test` (34/34) clean.

## Real bug: tab links (View all, Project Settings) didn't switch tabs (2026-08-18)

Recent Activity's "View all" link (`?tab=activity`) wasn't actually
switching to the Activity tab — a real bug, not a styling issue. Root
cause: `ProjectTabs` (`src/components/project-tabs.tsx`) read the
`?tab=` query param into a `useState(initialIndex)` that only ran once at
mount. A `<Link href="...?tab=activity">` to the *same* route only
updates the search params via client-side navigation — it doesn't remount
`ProjectTabs`, so that one-time initial state never picked up the new
value. This silently affected every `?tab=` deep link on the page, not
just Recent Activity's — `ProjectHeader`'s "Project Settings" quick-action
menu item had the identical bug.

Fixed by making the URL the single source of truth instead of local
state: `active` is now derived fresh from `useSearchParams()` on every
render (no `useState` at all), and clicking a tab button calls
`router.replace(..., { scroll: false })` to update `?tab=` rather than
just flipping local state — so the tab bar and the URL can never drift
apart in either direction. `tsc`, `eslint`, `pnpm test` (34/34) clean.

## Launch Checklist split: compact overview + full detail on Tasks tab (2026-08-18)

`launch-checklist-card.tsx` (Command Center) is now a compact readiness
overview only — percent, progress bar, "N of M critical tasks completed"
— no more per-stage scrollable task list. Its "Check Project" button was
replaced with a "View all checklist" link
(`/projects/{id}?tab=tasks#launch-checklist`).

The full grouped-by-stage checklist (with checkboxes) and the
`CheckProjectButton` it used to carry both moved into a new
`launch-checklist-detail.tsx` (`LaunchChecklistDetail`), rendered first —
above `TaskStageBoard` — in the Tasks tab's content, carrying the
`id="launch-checklist"` anchor that used to live on the Command Center
card. Nothing was deleted: Check Project is still one click away, just
relocated to sit next to the actual checklist it inspects instead of
tucked inside a Command Center summary card.

Landing on the Tasks tab already puts the checklist first regardless of
whether the `#launch-checklist` hash scroll itself fires — it's
deliberately the first element in that tab's content, so "View all
checklist" satisfies "show it there at the top" even in the worst case
where the anchor scroll doesn't kick in (not verified in an actual browser
this session, per the standing Chrome-tool-unavailable caveat).

### Verification

`tsc --noEmit`, `eslint` on all three touched/new files, `pnpm test`
(34/34) — clean.

## Launch Checklist: preview restored on Command Center, full view un-capped on Tasks (2026-08-18)

Follow-up correction on the split above: the compact overview was too
thin — Paul asked for real "viewable content" back on the Command Center
card, pasting an example of the grouped-by-stage list with checkboxes.
`launch-checklist-card.tsx` now shows a **capped preview** (`PREVIEW_LIMIT
= 6`) of the same grouped checklist — stops filling a stage group once 6
items total are shown — plus `CheckProjectButton` moved back here (it now
lives in exactly one place, not duplicated across both components), the
percent/progress footer, and a `"+N more — view all checklist →"` link
(exact count when truncated, plain "View all checklist →" when the
preview already shows everything) pointing at `?tab=tasks#launch-checklist`.

`launch-checklist-detail.tsx` (Tasks tab) lost its `max-h-72
overflow-y-auto` cap per Paul's explicit ask ("make it full view so it
won't have a scroll") — the whole checklist now renders at full height,
appropriate since this tab is the checklist's own dedicated view with
room to spare. Its `CheckProjectButton` was removed (redundant now that
Command Center owns it) and its `projectId` prop dropped since nothing in
the component needs it anymore.

### Verification

`tsc --noEmit`, `eslint` on all three touched files, `pnpm test` (34/34)
— clean. Live-DB check via a disposable script: replicated the preview
truncation logic against every real active project (FLPB: 65 critical
tasks, Shopify Setup: 28, Reptile Merch: 21) — all three correctly capped
at exactly 6 shown with accurate remaining counts and correct per-stage
grouping. No cleanup needed (read-only check).

## Launch Checklist card: preview to 12, Check Project replaced with View all (2026-08-18)

`PREVIEW_LIMIT` raised 6 → 12. The header's `CheckProjectButton` was
replaced with a "View all" link (bordered button, same treatment as
Recent Activity's own "View all") pointing at
`?tab=tasks#launch-checklist`. The bottom `"+N more — view all
checklist →"` link is now plain, non-interactive text — just `+N more`,
no link, no arrow — since the click-through action now lives once, in the
header.

**Real dead code removed, not left behind**: with `CheckProjectButton`
no longer referenced anywhere (it was already dropped from the Tasks tab
detail view in the previous change), `src/components/check-project-button.tsx`
and its backing `checkProjectAction` in `src/lib/actions.ts` were deleted
outright, along with the now-unused `getProjectIssues` import that
action needed. The underlying feature isn't gone — `checkProject()`
(the actual rule engine) still runs automatically inside Project Pulse's
"Needs Attention" card and the dashboard's per-project Pulse rows; only
the redundant manual on-demand button (whose output duplicated what
Needs Attention already shows automatically) was removed.

`tsc --noEmit`, `eslint` on both changed files, `pnpm test` (34/34) —
clean.

## Launch Checklist: bumped font sizes on both cards (2026-08-18)

Confirmed for Paul that the checklist markup isn't a shared component —
`launch-checklist-card.tsx` (Command Center preview) and
`launch-checklist-detail.tsx` (Tasks tab full view) duplicate the same
grouped-list JSX, so this needed editing in both places. Bumped: stage
labels `text-[11px]` → `text-xs`, task rows `text-xs` → `text-sm` (with
row spacing loosened `space-y-0.5` → `space-y-1` to match), and the
"Ready for launch" / "+N more" secondary text `text-[11px]` → `text-xs`.
Left the small uppercase "Launch checklist · X/Y" eyebrow label alone —
that's the app-wide section-header convention used consistently
elsewhere, not what was flagged as hard to read. Also fixed a stale doc
comment in `launch-checklist-detail.tsx` still referencing Check Project,
left over from the button's removal in the previous change.

`tsc --noEmit`, `eslint` on both files, `pnpm test` (34/34) — clean.

## Tasks tab checklist: header reflow + minimize toggle (2026-08-18)

Two changes to `launch-checklist-detail.tsx` (Tasks tab full view), per a
direct plan-it-yourself request:

**Header reflow**: the percent + "Ready for launch" that used to sit in
its own bottom footer row moved up into the header, right of the title —
`<h2>` (shrink-0), a `flex-1` spacer div, then percent + "Ready for
launch", so the spacer grows to push them flush against the card's right
edge regardless of title length. The old bottom border-top footer row is
gone; nothing duplicate remains.

**Minimize toggle**: the component is now a client component (`useState`)
with a `ChevronsDownUp`/`ChevronsUpDown` icon-only button next to the
header. Expanded (full list, no cap) is the default, matching the earlier
"full view, no scroll" request — minimizing collapses to a capped preview
of at least `MINIMIZED_LIMIT = 12` tasks (grouped by stage, same
truncation rule as Command Center's preview), with a "+N more — expand to
view all" text link beneath that also re-expands, so there's two ways
back to full view (the header icon and this link).

**Shared truncation logic, not a third copy**: `src/lib/checklist-utils.ts`
(`groupChecklistByStage`, `truncateChecklistGroups`) was extracted from
what was duplicated inline in `launch-checklist-card.tsx` — now both that
component (Command Center's `PREVIEW_LIMIT = 12`) and this one's
minimized state (`MINIMIZED_LIMIT = 12`) call the same functions instead
of drifting apart.

### Verification

`tsc --noEmit`, `eslint` on all three touched/new files, `pnpm test`
(34/34) — clean. Live-DB check via a disposable script: ran
`truncateChecklistGroups` at both limit=12 and limit=6 against every real
active project (FLPB: 65 critical tasks, Shopify Setup: 28, Reptile
Merch: 21) — every case correctly capped at exactly `min(total, limit)`
shown with accurate remaining counts and correct per-stage grouping. No
cleanup needed (read-only check).

## Checklist preview/minimize limits: 12 → 9 (2026-08-18)

`PREVIEW_LIMIT` (Command Center card) and `MINIMIZED_LIMIT` (Tasks tab
minimize state) both dropped from 12 to 9. `tsc`, `eslint`, `pnpm test`
(34/34) clean.

## Command Center checklist card: same header reflow as Tasks tab (2026-08-18)

Applied the identical header reflow from the Tasks tab's
`LaunchChecklistDetail` to Command Center's `LaunchChecklistCard`: the
percent + "Ready for launch" that used to sit in a bottom border-top
footer row moved into the header, right after a `flex-1` spacer (so it
sits flush right regardless of title length), with "View all" as the
rightmost element. The old footer row is gone. `tsc`, `eslint`, `pnpm
test` (34/34) clean.

## Tasks tab checklist: dropped the redundant expand link (2026-08-18)

Removed the "+N more — expand to view all" text link from
`launch-checklist-detail.tsx` — the header's minimize/expand icon button
was already the primary control, so this was a second, redundant way to
do the same thing. Default stays expanded (full view, `useState(false)`
for `minimized`) as it already was. The now-unused `remaining` local
(only the removed link read it) was dropped along with it. `tsc`,
`eslint`, `pnpm test` (34/34) clean.

## Command Center: 3-column row now equal-height (2026-08-18)

The 3-column Overview/Accounts & Access/Launch Checklist row used
`items-start` (chosen earlier this session specifically so Accounts &
Access could grow without dragging the other two taller or getting
capped/scrolled) — visually this left Accounts & Access and Launch
Checklist/Handoff falling noticeably short of the taller Overview/Next
Actions/Recent Activity column, per a real screenshot.

Rather than a rigid pixel height (which would force internal scrolling
back in — explicitly rejected multiple times already this session for
Timeline, Accounts & Access, and the Tasks tab checklist), the fix
distributes the height difference as breathing room, not squished
content:
- Grid: `items-start` → `items-stretch`, so all 3 columns share the
  tallest column's row height.
- The two stacked columns (Overview+NextActions+RecentActivity;
  LaunchChecklist+Handoff) changed from `flex flex-col gap-3` to `flex
  h-full flex-col justify-between gap-3` — `gap-3` still sets the
  minimum spacing, `justify-between` distributes any extra stretched
  height as *additional* gap between cards rather than stretching one
  card's border oddly.
- `AccessItemsPanel`'s own root card gained `h-full` so its visible
  border actually fills the stretched grid cell (grid stretch alone only
  sizes the invisible cell; the card needs `h-full` to visually match).

`tsc --noEmit`, `eslint` on both touched files, `pnpm test` (34/34) —
clean. Not yet visually confirmed in an actual browser (Chrome tool
unavailable this session, per the standing caveat) — this is a standard,
well-understood CSS pattern for equal-height card rows, so confidence is
high, but worth a quick visual check next time the browser tool is
available.

## Fixed the gap the equal-height change created (2026-08-18)

A real screenshot showed the actual problem with the previous fix:
`justify-between` doesn't distribute the leftover height gracefully — it
dumps it all into a single stretched *gap*, which reads as a floating
blank rectangle sitting between two bordered cards (most visible between
Launch Checklist and Client Portal/Handoff) rather than looking aligned.

Fix: swapped `justify-between` for a plain fixed `gap-3`, and instead made
the **last card in each stack** absorb the leftover height itself
(`flex-1` on its wrapper, `h-full` on the card's own root) — so any extra
space becomes that card's own internal breathing room, inside its border,
rather than a borderless dead zone between two cards. Applied to both
stacks: `RecentActivityCard` (now accepts being stretched via `h-full` on
its root, wrapped in a `flex-1` div in `page.tsx`) and the inline Client
Portal/Handoff card (`flex-1` added directly to its own className, no
component to touch).

`tsc --noEmit`, `eslint` on both touched files, `pnpm test` (34/34) —
clean. Still not visually re-confirmed in a browser this session (tool
unavailable) — flagged directly per the standing caveat, worth a real
look next time it's available.

## Command Center checklist expanded to full list; real client-view tracking (2026-08-18)

Two changes, both in the same 3-column row.

**Launch Checklist card, expanded**: dropped the `PREVIEW_LIMIT`/truncation
entirely — `LaunchChecklistCard` now renders the full grouped checklist,
same as the Tasks tab (which additionally offers the minimize toggle).
Swapped which card absorbs the column's leftover stretched height:
`flex-1` moved from the Client Portal/Handoff card to the checklist card
(now `h-full` on its own root too) — showing everything means it now
grows with real content instead of empty padding, so it's the natural
choice to be the one that stretches. Handoff went back to its natural,
unstretched size.

**Client Portal/Handoff: real "last viewed" tracking** — Paul asked to
know if the client actually opened the handoff link he sent them, not
just whether a link exists. `getProjectByHandoffToken` (called on every
real load of the public `/handoff/[token]` page) now logs an
`activity_logs` row with a new action, `handoff_viewed`, each time —
reusing the existing activity-log infrastructure rather than adding a
dedicated column. New `getLastHandoffView(projectId)` query returns the
most recent such log's timestamp (or `null` if the client has never
opened it). The Handoff card header now shows "Client viewed {relative
time}" or "Not viewed yet" — only rendered once a handoff link actually
exists (`project.handoffToken` set), since there's nothing to have viewed
otherwise. Also added a `handoff_viewed` case to
`formatActivityMessage()` ("Client viewed the handoff page") so it reads
naturally in the Recent Activity feed and full Activity tab too, instead
of falling through to the generic `action.replace(/_/g, " ")` fallback.

### Verification

`tsc --noEmit`, `eslint` on all four touched files, `pnpm test` (34/34) —
clean. Live-DB check via a disposable script (created a real throwaway
client/project, cleaned up after): confirmed `getLastHandoffView` returns
`null` before any view, picks up the newest `handoff_viewed` log
correctly after each of two simulated views (with a real timestamp
increase between them), and correctly ignores an unrelated activity-log
action recorded for the same project. Hit repeated Supabase session-pooler
connection-limit errors (`max clients reached, pool_size: 15`) attempting
the full end-to-end path through `getProjectByHandoffToken`'s real
6-way join fan-out — a live environment/connection-budget issue (likely
the dev server holding its own connections), not a code defect each
partial run got further through a different query before hitting the
cap, and the actually-new logic (the log insert + `getLastHandoffView`)
was verified directly and passed cleanly once scoped down to avoid the
expensive fan-out.

## Real bug: hydration mismatch on the handoff link (2026-08-18)

A real Next.js runtime error, pasted directly: `HandoffLinkPanel` computed
`url` with `currentToken && typeof window !== "undefined" ? window.location.origin + ... : null`
— a textbook server/client branch. Server-side, `window` doesn't exist, so
it rendered the relative path `/handoff/{token}`; client-side after
hydration it rendered the full `http://localhost:3000/handoff/{token}`.
Different text between SSR and hydration = React's hydration-mismatch
error, exactly matching one of the causes React's own error message lists.

Fixed by separating *what's rendered* from *what's copied*: a `path`
value (`/handoff/{token}`) is used for the on-page `<code>` display —
identical on server and client, no `window` involved, so it can never
mismatch. The absolute URL (`window.location.origin + path`) is now
computed only inside the "Copy link" button's `onClick`, which only ever
runs in the browser after hydration is already complete — never part of
render output, so it's not subject to hydration comparison at all.

`tsc --noEmit`, `eslint` on the touched file, `pnpm test` (34/34) —
clean.

## Client Portal card redesigned; checklist reverted to a stretchy capped preview (2026-08-18)

Three fast follow-ups from a reference screenshot, landing together.

**Client Portal/Handoff redesign** (`handoff-link-panel.tsx`, full
rewrite): now a fully self-contained card (title/border/description all
moved *into* the component, out of `page.tsx` — same pattern
`AccessItemsPanel`/`LaunchChecklistCard` already use). Per the reference:
a dot + "Active"/"Not generated" status badge top-right (describes
whether a handoff link currently exists, not the project's own lifecycle
status — a deliberate scope choice, since duplicating `ProjectHeader`'s
project-status badge here would've been redundant); a prominent "Client
view last accessed" line using the `lastHandoffView` tracking added
earlier this session, styled as a clickable relative-time link (opens the
portal) with an external-link icon, or "Not viewed yet"; the URL field
restyled from a bare `<code>` chip to an input-style pill next to a solid
blue "Copy link" button; a new "Open client portal →" link. "Revoke"
stayed (not in the reference, but real functionality — kept as a small
secondary action rather than dropped). `page.tsx` now just renders
`<HandoffLinkPanel projectId token lastViewedAt />` directly.

**Checklist reverted to capped preview, kept stretchy**: the "show the
full list" change from the previous entry was walked back — Paul wanted
the capped `PREVIEW_LIMIT = 9` preview back (matching what shipped
before), but still wanted the card to auto-fill whatever leftover height
the row's stretch gives it, rather than leaving a raw gap. Both are true
at once: `truncateChecklistGroups`/`PREVIEW_LIMIT` are back, and the card
keeps `h-full` plus its `flex-1` wrapper in `page.tsx` — so any extra
height becomes blank space *inside* the checklist card's own border
(acceptable card breathing room) rather than a floating gap outside any
card (the actual thing that looked broken two entries ago).

**Client Portal card no longer force-stretched**: with the checklist
column's `flex-1` back on the checklist card specifically, the Client
Portal card's own `h-full` (added when this pattern was first split
across two components) was removed — it goes back to its natural,
compact size instead of being stretched to match the tallest column.

### Verification

`tsc --noEmit`, `eslint` on all three touched files, `pnpm test` (34/34)
— clean after each of the three edits.

## Dropped a stray margin on Next Actions (2026-08-18)

`NextActionsCard`'s own `mb-4` was redundant — it sits in a `flex
flex-col gap-3` column now, so the gap already handles spacing; the extra
margin was adding uneven space below it on top of that. Removed. `tsc`,
`eslint`, `pnpm test` (34/34) clean.

## Launch Checklist card: dynamic fill instead of a fixed item cap (2026-08-18)

Replaced the static `PREVIEW_LIMIT = 9` with real overflow-based
truncation — a screenshot showed a fixed count leaving a lot of dead
white space on projects where the stretched column has room for more than
9 rows. `LaunchChecklistCard` is now a client component: it renders every
checklist row (flattened stage headers + tasks, each with a ref) inside a
`min-h-0 flex-1 overflow-hidden` container, measures each row's real
height in a `useLayoutEffect` (isomorphic-guarded to `useEffect` so SSR
doesn't warn), and walks cumulative height against the container's actual
`clientHeight` — which is the *real* stretched space this card was given
by the 3-column grid, not a guess — to find exactly how many rows fit,
reserving room for a trailing "+N more" line. Rows past that point are
dropped from the rendered output (only the fitting ones stay in the DOM),
and truncation never ends on a dangling stage header with none of its
tasks visible under it. A `ResizeObserver` re-measures if the stretched
height ever changes after mount (e.g. a sibling column's content changing
height). `min-h-0` on the measurement container is load-bearing — without
it a flex item won't shrink below its content's natural height, the same
class of bug fixed globally on `<main>` earlier this session, just on the
vertical axis instead of horizontal.

Before the first measurement (server-render and the initial client
paint), every row renders — clipped only by the container's
`overflow-hidden`, never spilling out — so the *very first* SSR paint can
briefly show a hard-clipped bottom edge with no "+N more" line until
hydration completes and the layout effect runs; on any client-side
navigation this resolves before the browser paints (that's the point of
`useLayoutEffect`), so it's only a first-load, sub-frame artifact — a
known, accepted tradeoff of this pattern, not a bug.

### Verification

`tsc --noEmit`, `eslint`, `pnpm test` (34/34) — all clean. Not
independently exercised in an actual browser this session (Chrome tool
unavailable, per the standing caveat) — the measurement logic is a
by-hand implementation of a well-established pattern (server-side full
render + `ResizeObserver`-driven client truncation), so confidence is
reasonable, but this one genuinely warrants a real visual check (does the
fit calculation land exactly right, does the first-paint clip look
acceptable) the next time the browser tool is available — flagged
directly rather than glossed over, since it's more novel than this
session's earlier CSS-only layout fixes.

## Launch Checklist: fixed budget instead of matching the tallest column (2026-08-18)

The previous entry's "fill the stretched height" approach was rejected:
Paul didn't want the card matching the tallest sibling column at all
("not making it a full height") — on a project where the Overview/Next
Actions/Recent Activity column happens to be tall, the checklist grew to
match it and ended up showing far more rows than felt right for an
overview card.

Switched the fill target from "however tall the grid row stretched me"
to a fixed, self-contained budget: `LIST_HEIGHT_PX = 320` (an explicit
pixel height on the measurement container, via `style`, not a Tailwind
class, since it needs a plain number for the JS row-fitting math to
share). The card is no longer `h-full`/`flex-1` at all — it sizes to its
own natural content (header + the fixed 320px list area + an optional
"+N more" line) regardless of what the sibling columns are doing. Same
row-by-row measurement logic as before, just measuring against a constant
instead of `container.clientHeight`, and the now-pointless `ResizeObserver`
(there's nothing that would change a fixed constant) was removed along
with it — one measurement pass on mount is enough.

Since the checklist card no longer stretches to fill column 3's leftover
height, that job moved back to the Handoff card (`flex-1` wrapper in
`page.tsx`, `h-full` restored on `HandoffLinkPanel`'s own root) — the
same role it had two entries ago, before the "expand the checklist"
detour.

### Verification

`tsc --noEmit`, `eslint` on all three touched files, `pnpm test` (34/34)
— clean.

## Column 3 fully un-stretched — Handoff has no flex role at all (2026-08-18)

Asked directly which of two options was intended (stop stretching the
column entirely, vs. keep the column aligned to column 1 with blank space
below Handoff) — Paul picked fully un-stretched. Removed `flex-1` from
around `HandoffLinkPanel` in `page.tsx` and `h-full` from the component's
own root — it's back to a plain, naturally-sized card with no stretch
role whatsoever, matching `LaunchChecklistCard` (also natural height,
fixed 320px list budget). The column wrapper's own `h-full` was dropped
too.

That alone wasn't enough: the 3-column grid still has `items-stretch`
(needed for column 2's `AccessItemsPanel` to keep matching column 1), and
grid `align-items: stretch` forces *every* grid item's own box to the row
height regardless of what its children do — so without an override,
column 3's grid cell would still balloon to match column 1, just with
dead space below Handoff *inside the grid cell* instead of inside a card.
Fixed with `self-start` on column 3's wrapper specifically — a per-item
override of the grid's default stretch, so column 3 sizes to its own
natural content while columns 1 and 2 keep participating in the grid's
stretch as before.

### Verification

`tsc --noEmit`, `eslint` on both touched files, `pnpm test` (34/34) —
clean.

## Handoff card: "no link yet" state matches the active state's height (2026-08-18)

The empty state (no handoff link generated) used to collapse to a single
button with none of the surrounding sections — much shorter than the
active state, which looked inconsistent now that this card sizes to its
own natural height (previous entry) instead of being force-stretched.

Dropped the "Not generated" status badge entirely (the header row now
shows nothing there when inactive, rather than a grey "not generated"
label) and made the "Client view last accessed" section render
unconditionally — showing a plain "—" placeholder instead of a real
value when no link exists yet, rather than omitting the whole block. The
"Generate handoff link" button also grew to `w-full` with the same
padding as the active state's URL-pill + Copy-link row, so the primary
action row is the same height in both states. Only the bottom "Open
client portal / Revoke" row still doesn't render when inactive — there's
nothing real to open or revoke yet, so a placeholder row for it didn't
seem worth inventing; that's the one small height difference left.

### Verification

`tsc --noEmit`, `eslint` on the touched file, `pnpm test` (34/34) —
clean.

## Handoff card: one unified layout, no separate empty-state button (2026-08-18)

Went one step further per two real screenshots side by side: rather than
matching heights between two different layouts (a full-width standalone
button vs. the URL-pill row), there's now only **one** layout, always.
The URL pill and its adjacent action button render unconditionally — the
pill shows the real path when a link exists or "Not generated yet" as a
placeholder when it doesn't; the button reads "Copy link" (and copies)
once a token exists, or "Generate link" (and generates one) when it
doesn't, sharing a single `onClick` that branches on `currentToken`. The
"Active" badge and the "Open client portal / Revoke" row are still the
only pieces that stay conditional — genuinely nothing to badge, open, or
revoke before a link exists — everything else is identical markup in
both states, so there's no longer a height-matching concern at all: it's
the same layout.

`tsc --noEmit`, `eslint` on the touched file, `pnpm test` (34/34) —
clean.

## Launch Checklist: fixed list budget 320px → 350px (2026-08-18)

Iterated live to a final value of 350px (tried 480, reverted to 320, then
350/340/350) for `LIST_HEIGHT_PX` in `launch-checklist-card.tsx`. `tsc`,
`eslint`, `pnpm test` (34/34) clean at each step.

## Launch Checklist: swapped the JS row-measurement approach for plain CSS flex (2026-08-18)

Paul pushed back on the whole dynamic-measurement system from a few
entries back — pasted the standard shadcn/Tailwind "equal-height dashboard
card" recipe (`Card h-full flex-col` + `CardContent flex-1`, capped
content rather than showing everything) and asked for that instead of a
`ResizeObserver`/row-by-row-measured client component. Simpler, and it's
the right call: the JS approach was solving a problem plain flexbox
already solves.

`launch-checklist-card.tsx` is a server component again (no `"use
client"`, no refs, no effects) — `flex h-full flex-col` root, the header
row `shrink-0`, and a `min-h-0 flex-1 overflow-hidden` content area
holding a **capped** preview (`truncateChecklistGroups`, `PREVIEW_LIMIT =
12` — reused from `checklist-utils.ts`, not reimplemented) with a
`shrink-0` "+N more" line below it. In `page.tsx`, the card is wrapped in
`flex-1` again inside column 3 (which also has `h-full` again, dropping
the `self-start` override from two entries ago) — so it's the checklist,
not Handoff, that absorbs the column's leftover stretched height once
more, pushing `HandoffLinkPanel` down naturally. `HandoffLinkPanel` itself
goes back to being unwrapped/natural-height, no `flex-1`/`h-full` of its
own.

This does mean column 3 is back to matching column 1's height (the exact
thing rejected a few turns ago) — but the objection then was specifically
that the checklist's *content* grew to match (page after page of tasks on
a tall project); with a capped preview, the card now fills that same
stretched space as blank breathing room inside its own border when
content is short, never by rendering more tasks than the cap allows.

### Verification

`tsc --noEmit`, `eslint` on both touched files, `pnpm test` (34/34) —
clean. `truncateChecklistGroups`/`groupChecklistByStage` are the same
functions already verified against live data earlier this session (used
identically here, just re-wired into a simpler component), so no new
live-DB check was run for this pass.

## Command Center: bigger h2s, and the 4 Pulse card labels are now real h2s (2026-08-18)

Two changes across every Command Center card:

- Every `h2` on the tab got bigger: the uppercase eyebrow-style headers
  (Timeline, Accounts & Access, Launch Checklist, Client Portal/Handoff —
  `text-[10px]`) went to `text-xs`; the sentence-case titles (Next
  Actions, Recent Activity, Waiting on Client — `text-sm`) went to
  `text-base`.
- The 4 Project Pulse card labels ("Project Pulse," "Needs Attention,"
  "Next Milestone," "Launch Countdown") were plain `<span>`s inside the
  shared `IconStatCard` — changed to real `<h2>` elements (same `text-xs`
  eyebrow styling as the rest). Since `IconStatCard` also backs the
  Overview 2x2 grid (Launch date/Project health/Tasks remaining/Last
  activity) and the dashboard's per-project Pulse rows, all of those
  labels became real headings too, not just the 4 named in the request —
  one shared component, so the fix landed everywhere it's used rather
  than needing a special case.

`tsc --noEmit`, `eslint` on all eight touched files, `pnpm test` (34/34)
— clean.

## Sidebar: project switcher dropdown, Search moved to the bottom (2026-08-18)

Asked to reposition sidebar Search "to most relevant" (left to judge) and
turn something into a project-switcher dropdown showing each project's
technology logos. Judgment call: for a solo dev juggling several projects
at once, jumping straight to a specific project is the single most
frequent sidebar action — more frequent than global search, which still
works everywhere via its existing `Ctrl/Cmd+K` shortcut regardless of
where its visible trigger sits. So the new project switcher took Search's
old spot (right under the logo, above the main nav), and `SearchTrigger`
moved down into a new bottom section (above "Log out", inside the same
border-top-divided block).

**New query**: `listProjectsForSwitcher()` in `queries/projects.ts` — one
query for every project (id/name/status/client) plus one query for all
`project_technologies` rows joined to technology names, merged in memory
by project id. Deliberately lighter than `listProjects()`'s existing
consumers need (no health score, no dates) since this only has to render
a dropdown row and navigate.

**New component**: `src/components/project-switcher.tsx` — a shadcn
`DropdownMenu` (same primitive already used in `ProjectHeader`'s
quick-actions menu, same `onClick={() => router.push(...)}` navigation
pattern rather than a raw `Link`) triggered by a "Projects" button with a
`ChevronsUpDown` icon. Each row shows up to 3 technology logos (overlapping
`-space-x-1.5`, avatar-stack style) plus the project name and client name;
`DropdownMenuContent` already caps its own height and scrolls
(`max-h-(--available-height)`), so a long project list doesn't need any
extra handling.

**Real gap caught before shipping**: my first pass only rendered a logo
when `resolvePlatformIcon` matched, silently skipping technologies with no
Simple Icons entry (Microsoft Clarity, Klaviyo, Printify, GoHighLevel) —
a project whose first 3 technologies happened to be logo-less ones would
show *zero* icons in the switcher, reading as broken rather than just
generic. Caught by a live-DB check before finalizing (FLPB's own tech list
includes several no-icon entries). Fixed by promoting the existing
colored-monogram fallback pattern (previously only inline in
`access-items-panel.tsx`) into a new shared `PlatformBadge` component in
`platform-icon.tsx` — always renders *something*, the real brand icon
when one resolves, otherwise a deterministic colored-monogram circle —
and switched the switcher to use that instead of the icon-only
`PlatformIcon`.

`layout.tsx` is now an `async` server component (previously it did no
data fetching at all) to call the new query directly — safe to do here
specifically because `/login` and `/handoff/[token]` are both outside the
`(dashboard)` route group and don't use this layout, so no DB call runs
before authentication.

### Verification

`tsc --noEmit`, `eslint` on all four touched/new files, `pnpm test`
(34/34) — clean. Live-DB check via a disposable script: ran
`listProjectsForSwitcher()` against the real Supabase project's 3 actual
projects and cross-checked every returned technology name against
`resolvePlatformIcon` — this is exactly what surfaced the no-icon gap
above (Clarity/Klaviyo/Printify (Print-on-Demand)/GoHighLevel all
resolved to "no icon" before the `PlatformBadge` fix). No cleanup needed
(read-only check).

## Project switcher: highlight the currently open project (2026-08-18)

`ProjectSwitcher` reads `usePathname()` and matches it against
`/projects/[id]` to find which project's page is currently open —
deliberately *not* `project.status` (the ACTIVE/ON_HOLD/etc. business
status already shown elsewhere, e.g. the Handoff card's badge); "active"
here means "the one you're currently on," the standard meaning for a
switcher dropdown. That row gets a light-blue background, its name in the
same blue used for links/current-state elsewhere in the app, and a
trailing checkmark. On any non-project page (dashboard, tasks, etc.)
nothing matches, so no row is marked — correct, since there isn't a
"current project" in that context.

`tsc --noEmit`, `eslint` on the touched file, `pnpm test` (34/34) —
clean.

## Investigated: why Needs Attention is always empty (2026-08-18, no code change)

Paul asked why the Needs Attention card never shows anything. Not a bug —
every one of the 9 `checkProject()` rules in `forgotten-task-rules.ts` is
a narrow "did X but forgot Y" pattern that only fires once a specific
*prerequisite* task is marked `DONE` (e.g., GA4 installed but conversions
unverified needs `analytics.ga4.install` done first). Checked all 3 real
active projects via a disposable script: every prerequisite key across
all 9 rules was still `TODO` except FLPB's `printify.payment_card`
(marked done, but that rule also has a 3-day delay before it fires, so
it's not due yet). All 3 projects are early-stage, so none of the 9
scenarios have anything to catch yet.

Asked directly whether to leave this as-is (it'll start surfacing real
issues automatically as these projects progress) or add broader
early-stage rules (e.g. "critical task overdue/stalled") that could fire
even on a brand-new project. Paul chose to leave it as-is — nothing
changed. Worth revisiting if a future session gets asked the same
question again without this context.

## Activity log: real "who did this" tracking, built to scale past one user (2026-08-18)

Asked to show who had activity on a project — "for now it's me, but make
it scalable." There's no user-accounts table yet (single shared-password
app), so the design deliberately avoids inventing a fake one: a plain
`actorName` text column, not a `userId` foreign key, with every write site
passing a real value from one new shared source of truth,
`src/data/agency-info.ts` (`AGENCY_OWNER_NAME = "Paul"`,
`CLIENT_ACTOR_NAME = "Client"`) — swapping in a real auth-derived name
later is a one-line change per call site, not a schema redesign.

**Schema**: `activity_logs.actor_name` (text, `NOT NULL DEFAULT 'Paul'` —
backfills every existing row sensibly, since all of them genuinely were
Paul). Pushed live via `drizzle-kit push`.

**All 9 activity-log write sites** (`queries/projects.ts` ×8,
`queries/maintenance.ts` ×1 — status changes, ad-hoc tasks, handoff
link generate/revoke, maintenance runs, project creation) now pass
`actorName: AGENCY_OWNER_NAME`. **One real exception, caught by actually
reading through every call site rather than assuming they're all the
same**: `handoff_viewed` (logged inside `getProjectByHandoffToken`,
added earlier this session) is genuinely triggered by the *client*
opening the public link, not Paul — that one gets
`actorName: CLIENT_ACTOR_NAME`. Blindly stamping every row "Paul" would
have been actively wrong for that one action.

**Read side**: `listRecentActivity` now selects `actorName`;
`ActivityRow` (`format-activity.ts`) carries it; `RecentActivityCard` and
`ActivityTab` both show it next to the relative time (`"2h ago · Paul"`).
**Also fixed a latent bug this surfaced**: the Overview card's "Last
activity" stat had a hardcoded `"By Paul"` string — harmless before
`handoff_viewed` existed, but wrong the moment a client's view became a
project's most recent activity (it would've still said "By Paul"). Now
takes a real `lastActivityActor` prop (`recentActivity[0]?.actorName`)
threaded from `page.tsx`.

### Verification

`tsc --noEmit`, `eslint` on all nine touched/new files, `pnpm test`
(34/34) — clean. Live-DB check via a disposable script (real throwaway
client/project, cleaned up after): created a task (Paul-attributed
action) and directly inserted a client-attributed `handoff_viewed` row,
then confirmed `listRecentActivity` returned exactly `"Paul"` for the
task/creation actions and exactly `"Client"` for the handoff view — no
mislabeling in either direction.

## Recent Activity: avatar + "Name did X" sentence style (2026-08-18)

Per a reference screenshot ("**Sarah** connected Google Analytics · 2
hours ago"): each activity row now gets a colored initial avatar and the
actor's name rendered bold as the sentence's subject, rather than tacked
on after the timestamp.

**Deduped a hash-color function that had been copy-pasted three times
already** (`access-items-panel.tsx`'s platform monogram,
`platform-icon.tsx`'s brand-icon-fallback monogram, `project-header.tsx`'s
project-initial avatar) — before writing a *fourth* copy for actor
avatars, extracted the shared algorithm into `src/lib/hash-color.ts`
(`hashPick<T>(key, options[])`) and pointed all three existing call sites
at it, each keeping its own palette/usage. New `src/components/actor-avatar.tsx`
(`ActorAvatar`) uses the same utility for a per-person colored initial
circle.

**`format-activity.ts`**: `formatActivityMessage(row): string` replaced
with `formatActivitySentence(row): { actor, rest }` — the actor is always
the sentence's grammatical subject (e.g. `rest: "marked X Done"`, `rest:
"generated the handoff link"`), never re-stated inside `rest`, so
consumers can render the two parts with different styling without string-
parsing. Both `RecentActivityCard` and `ActivityTab` updated to render
`<ActorAvatar> <b>{actor}</b> {rest}` per row instead of a single
undifferentiated message string.

### Verification

`tsc --noEmit`, `eslint` on all eight touched/new files, `pnpm test`
(34/34) — clean. Live-DB check: ran `formatActivitySentence` against real
recent activity from all 3 active projects — every sentence read
naturally ("Paul marked Confirm domain access Blocked", "Paul generated
the handoff link", etc.). One old `handoff_viewed` row predating the
Client-actor fix from the previous entry still shows "Paul" (it was
inserted before that fix landed) — expected, historical data, not a bug;
already end-to-end verified that new views get "Client" correctly.

## Access items now always start "Not requested," reversing the self_created auto-grant (2026-08-18)

Paul flagged that new projects showed some Accounts & Access items as
already "Connected" — that was the `self_created` ownership model from
earlier this session (WordPress Admin, Cloudways, GA4, GTM, GSC, Clarity,
Domain Registrar auto-inserted as `GRANTED` since Paul creates those
himself). He wants every new access item defaulting to `NOT_REQUESTED`
instead, full stop — no exceptions by platform.

Removed the `preset.ownership === "self_created" ? GRANTED : NOT_REQUESTED`
branch from both insertion sites: `createProjectWithWorkflow` (project
creation) and `quickAddAccessItemAction` (the "+ Add platform" picker,
mid-project). Both now always pass `NOT_REQUESTED` — nothing special-cased
by platform anymore; the schema's own default handles it either way.

**Didn't delete the `ownership` field** on `AccessItemPreset` — it's now
purely descriptive (which platforms Paul creates himself vs. which the
client already owns), still real, useful domain knowledge encoded per
preset, just no longer read by any code path. Updated its doc comment so
a future reader doesn't assume it still drives behavior.

### Verification

`tsc --noEmit`, `eslint` on all three touched files, `pnpm test` (34/34)
— clean. Live-DB check via a disposable script (real throwaway
client/project spanning both ownership types — WordPress+GA4
self_created, Shopify+Klaviyo client_invite — cleaned up after):
confirmed every access item landed `NOT_REQUESTED` with no `grantedAt`
stamp at project creation, and confirmed the same for a quick-added
Cloudways item (exercised via `createAccessItem` directly with the same
status the Server Action now passes, since the action itself needs a real
request context for `cookies()`/`revalidatePath` that a standalone script
doesn't have).

## Next Actions: "View tasks" button (2026-08-18)

Added a header-row button to `next-actions-card.tsx`, same bordered
"View X" treatment already used on Recent Activity/Launch Checklist,
linking to `?tab=tasks`. Needed a new `projectId` prop (only usage
updated in `page.tsx`). `tsc`, `eslint`, `pnpm test` (34/34) clean.

## Accounts & Access row simplified: dropdown-as-pill, delete replaces gear (2026-08-18)

Asked directly whether removing the gear/settings toggle would also take
role/instructions editing and the shared-login vault down with it (they
were the gear panel's other two features, not just status) — Paul chose
to remove the gear function entirely rather than keep a smaller "Details"
fallback for those.

`AccessItemRow` (`access-items-panel.tsx`) is now flat, no expand/collapse
state at all: icon, name, a real `<select>` styled as a pill (all 6
statuses — Not requested/Requested/Invited/Access granted/Access
verified/Not needed — directly changeable inline, no click-through), Open,
and a trash icon that deletes with the same confirm dialog as before. The
whole `expanded` block — role/instructions display+edit, `grantedAt`
display, and the AES-256-GCM shared-login vault (view/reveal/edit/clear)
— is gone from the row.

**Real functionality intentionally left in place, not deleted**: the
Server Actions those features used
(`updateAccessItemDetailsAction`, `setAccessItemCredentialsAction`,
`revealAccessItemPasswordAction`, `clearAccessItemCredentialsAction`) and
their underlying query functions in `queries/access-items.ts` are now
unreferenced by any component — but they weren't removed. This isn't
ordinary leftover dead code; it's a working, previously-real feature
(encrypted credential storage, built carefully earlier this session)
that's currently unreachable from the UI, not deleted data or deleted
logic — re-wiring it to a different entry point later (e.g. a future
per-item detail view) is a UI change, not a rebuild. The custom-add
form's own "Shared login instead?" flow (setting credentials at initial
creation) is untouched and still works; only *editing/viewing/clearing*
an existing stored login after creation is currently unreachable.

Also changed the GRANTED/VERIFIED label from "Connected"/"Connected" to
"Access granted"/"Access verified" — the old pill only ever displayed one
of them as text ("Connected" either way), but a real `<select>` needs two
visually distinct option labels or they'd be indistinguishable in the
dropdown list.

### Verification

`tsc --noEmit`, `eslint` on the touched file, `pnpm test` (34/34) —
clean. Live-DB check via a disposable script (real throwaway
client/project/access item, cleaned up after): confirmed the dropdown's
underlying update path (`GRANTED` status + `grantedAt` stamp) and the
trash button's underlying delete path both work correctly against the
real database.

## Access status pill: shadcn Select, fixed width so it doesn't reflow (2026-08-18)

Two follow-ups on the row: the plain native `<select>` looked bare and
had its chevron sitting flush against the pill's edge, and — the more
important bug — switching status pushed a longer/shorter label into the
pill, changing its width and visibly shoving the Open/delete buttons
sideways every time.

Swapped it for shadcn's `Select` (same primitive `ProjectStatusSelect`
already uses, same `value`/`onValueChange` pattern), still colored via
inline `style` per status like before. Fixed at `w-36` regardless of
which label is showing — "Access verified" and "Not requested" now take
up the identical footprint, so the row's layout is static exactly like
the checklist card's fixed 320px list budget: the content inside can
change, the box around it doesn't. Bumped right padding to `pr-3` so the
built-in chevron icon (part of `SelectTrigger`) has real breathing room
instead of sitting on the pill's edge.

### Verification

`tsc --noEmit`, `eslint` on the touched file, `pnpm test` (34/34) —
clean.

## Two real Select bugs, caught from a real screenshot (2026-08-18)

A screenshot of the access-status dropdown surfaced two genuine bugs in
`ui/select.tsx`'s usage pattern — both were latent all session (never
visually confirmed in a browser until now) and affected *every* shadcn
`Select` in the app, not just the new one.

**Bug 1 — raw enum values instead of labels**: the pill showed
`NOT_NEEDED` / `INVITED` / `GRANTED` instead of "Not needed" / "Invited" /
"Access granted." Root cause: base-ui's `<Select.Value>` only renders a
matching item's *label* automatically if the `<Select.Root>` is given an
`items` map (`Record<string, ReactNode>`) — without it, `Value` just
prints the raw value verbatim, which is exactly what both `<SelectValue>`
usages in the app (`access-items-panel.tsx`, `project-status-select.tsx`)
were missing. Fixed by passing `items={STATUS_LABELS}` to both `<Select>`
roots — the existing label maps, already the right shape, no new data
needed.

**Bug 2 — dropdown overlapping the trigger instead of sitting below it**:
`SelectContent` in `ui/select.tsx` defaults `alignItemWithTrigger={true}`
— base-ui's macOS-style behavior that centers the popup on the
*currently-selected* item rather than anchoring it below the trigger like
an ordinary dropdown, which is why the open popup visually overlapped the
pill above it in the screenshot. Fixed by passing
`alignItemWithTrigger={false}` on both call sites — same fix applied to
`ProjectStatusSelect` (the project header's status pill), which Paul
flagged has the identical problem, not just the new access-item one.

Left the shared `ui/select.tsx` primitive's own default unchanged (still
`alignItemWithTrigger={true}`) rather than flipping the shadcn default —
that's the intended behavior for some select patterns; each *usage* opts
out explicitly instead.

### Verification

`tsc --noEmit`, `eslint` on all three touched files, `pnpm test` (34/34)
— clean. Not independently re-confirmed in a browser this session
(Chrome tool unavailable, as throughout) — flagged directly since this is
exactly the kind of bug that only a real screenshot caught in the first
place, so extra caution is warranted before calling it fully resolved.

## Access status pill: rounded-lg instead of pill-shaped (2026-08-18)

Matched the card's own corner radius (`rounded-lg`, same as the card
wrapper and every other button in the row) instead of `rounded-full`.
`tsc`, `eslint`, `pnpm test` (34/34) clean.

## Real bug: Accounts & Access rows reordered on status change (2026-08-18)

Paul reported the list visibly reshuffling whenever a status was changed
— not a UI illusion, a real query bug. `listAccessItems` ordered by
`accessItems.createdAt` alone. Confirmed against live data: items
batch-inserted together (project creation's preset seeding, or several
quick-adds in a row) frequently share the *exact same* `createdAt`
millisecond — one real project had 8 access items all timestamped
`06:12:25.440Z`. With no tiebreaker, Postgres has no defined order among
tied rows, and `UPDATE` (MVCC writing a new row version) can change which
physical order those ties come back in — which is exactly what looked
like "reordering" after a status change.

Fixed with a stable secondary sort key: `.orderBy(accessItems.createdAt,
accessItems.id)`. `id` doesn't necessarily preserve true insertion order
within a same-millisecond batch (no guarantee cuids sort chronologically),
but it guarantees a *fixed* order that can never change again regardless
of how many times a row is updated — which is what "static, doesn't move"
actually requires, as opposed to a dedicated `sortOrder` column (not
needed here; overkill for what was asked).

### Verification

`tsc --noEmit`, `eslint` on the touched file, `pnpm test` (34/34) —
clean. Live-DB check via a disposable script (real throwaway
client/project spanning 4 technologies — reliably produces same-millisecond
batch-inserted items — cleaned up after): recorded the list order,
updated a *middle* item's status twice in a row, and confirmed the
returned order was byte-for-byte identical all three times.

## shadcn theme swapped to a green-primary palette (2026-08-18)

Replaced the `:root`/`.dark` OKLCH token blocks in `globals.css` with a
pasted theme — green `--primary` (`oklch(0.508 0.118 165.612)` light /
`oklch(0.432 0.095 166.913)` dark) instead of the previous near-black/
near-white neutral primary, a slightly tighter `--radius` (0.45rem vs
0.625rem), and matching sidebar/chart/border tokens for both light and
dark. Pure token substitution — the `@theme inline` mapping block and
`@layer base` rules that consume these variables were untouched, no
structural change.

**Scope worth knowing**: this only affects components built on shadcn
primitives (`Button`, `Select`, `Badge`, `DropdownMenu`, `Card`,
`Breadcrumb`, `Tooltip`, `Avatar` — e.g. `ProjectHeader`,
`ProjectStatusSelect`, the Accounts & Access status dropdown) via classes
like `bg-primary`/`text-primary`/`bg-sidebar`. The majority of this app's
UI still uses hardcoded hex colors directly (`#2a78d6`, `#0ca30c`, etc.)
rather than these theme tokens, so most of the app's look won't shift
from this change alone — only the shadcn-primitive pieces will pick up
the new green.

`tsc --noEmit`, `pnpm test` (34/34) clean (no ESLint-relevant changes —
pure CSS). Not visually confirmed in a browser this session (Chrome tool
unavailable, as throughout).

## Site-wide hardcoded-color → theme-token refactor (2026-08-18)

Direct follow-up on the theme swap above: Paul reported the new theme
"not implementing" and correctly self-diagnosed hardcoded colors as the
cause, and offered a `shadcn init --preset <id>` command as a possible
fix. Declined to run it as-is and explained why before touching anything:
it fetches an unaudited external preset (that command pattern is how
tweakcn.com hands out generated themes) and risks overwriting
`components.json`/`globals.css` — including the exact palette just
hand-applied last turn — with something different. Asked directly
whether to run it or refactor the app's own hardcoded colors instead;
Paul chose the refactor.

**Real scope, surveyed before touching anything**: grepped for every core
color across `src` — over 500 total hardcoded hex/black-opacity
occurrences across 40+ files, accumulated incrementally over the whole
session (every component was hand-styled with literal hex from the
start). A "convert literally everything" pass wasn't realistic to do
safely in one sitting, so this pass targeted the color roles that are
genuinely site identity (would make the new green theme actually visible
site-wide) and left the ones that are a *different* semantic system
untouched, on purpose:

- **Converted** (mechanical, bracket-notation Tailwind classes only —
  never touched raw hex inside JS string literals, to avoid corrupting
  status-color maps): `#2a78d6` (brand blue) → `primary`/`primary-foreground`
  across `text-*`/`bg-*`/`border-*`/`accent-*`/hover variants (58
  occurrences, 30 files); `#0b0b0b` → `foreground`; `#898781` →
  `muted-foreground`; `#fcfcfb` → `card`; `border-black/10` → `border-border`;
  `divide-black/10` → `divide-border`; `hover:bg-[#f9f9f7]` → `hover:bg-muted`;
  the 3 page-root `bg-[#f9f9f7]` → `bg-background`; the 2 remaining panel-fill
  `bg-[#f9f9f7]` → `bg-muted`. `text-white` was additionally swapped to
  `text-primary-foreground`, but *only* on the 19 elements where it was
  paired with `bg-primary` on the same class string (checked via regex
  requiring `bg-primary` to precede it) — `text-white` elsewhere (e.g. on
  semantic-color buttons) was left alone since it's not tied to the brand
  token there.
- **Deliberately left untouched**: the true semantic status colors —
  green `#0ca30c` (success/connected/done), orange `#c9720a`
  (warning/pending), red `#d03b3b` (danger/blocked) — these represent
  status meaning, not brand identity, and shadcn's token set has no
  distinct success/warning tokens; coupling them to `--primary` would've
  been actively wrong the moment `--primary` stops being green (a future
  theme change would then silently break "this task is done" turning the
  wrong color). Also left the four rotating hash-based avatar/monogram
  palettes (`FALLBACK_PALETTE`/`AVATAR_PALETTE`/`MONOGRAM_PALETTE`/
  `PROJECT_COLOR_PALETTE`) untouched — `#2a78d6` is one of six fixed
  colors used for visually distinguishing different items by hash, not a
  brand-identity reference. And left the dozen remaining raw-string
  `#898781` usages inside status-color `Record` maps alone, for the same
  "different semantic system" reason.
- IconStatCard's blue icon circles (Launch date, Last activity, Next
  Milestone) now use `iconColor="var(--primary)"` and
  `iconBg="color-mix(in oklch, var(--primary) 15%, white)"` instead of
  independent literal hex — these derive from the theme now, so they'll
  actually shift if `--primary` ever changes again.

**Caught and fixed along the way, unrelated to the refactor itself**: a
whole-`src` `eslint` pass (broader than any single-file check run so far
this session) surfaced 5 pre-existing unescaped-apostrophe errors in
`clients/[id]/page.tsx`, `integrations/page.tsx`, and `settings/page.tsx`
— plain prose text, nothing to do with color classes, just never
previously caught since verification was always scoped to touched files.
Fixed while already here.

### Verification

`tsc --noEmit` clean. `eslint` run across the *entire* `src` directory
(not just touched files, given the scale) — clean. `pnpm test` 34/34.
Additionally ran a full production `next build`: compiled successfully
and TypeScript passed cleanly (the phase that would catch a broken
Tailwind arbitrary-value string or malformed JSX from a bad sed
replacement) — it failed afterward during static page generation on
`/dashboard`, hitting the same pre-existing Supabase session-pooler
connection-limit issue documented multiple times earlier this session
(this environment's Supabase pool caps at 15 connections; unrelated to
this change, a live-environment constraint, not a code defect). Not
independently confirmed in a real browser this session (Chrome tool
unavailable, as throughout) — flagged directly given the sheer number of
files touched; worth a visual pass the next time that tool is available.

## Ran shadcn init with a preset ID — real theme/font/component changes, not just colors (2026-08-18)

Paul explicitly asked twice to run `shadcn@latest init --preset b6Sth1NkLy
--template next --pointer` (that command pattern is how tweakcn.com hands
out generated themes). Substituted `bunx --bun` → `pnpm dlx` — this repo
is pinned to pnpm specifically after an earlier `npm install` incident
partially bypassed pnpm's managed `node_modules`; bun would risk the same
class of problem as a third package manager.

**Safety checkpoint first**: before running it, flagged that ~94 files of
uncommitted work (this entire session, never committed since the original
MVP commit) had no backup, and asked whether to commit first. Paul said
yes — committed everything as `3e51a17` before touching anything, so the
init command had a real rollback point instead of risking unrecoverable
work.

**Running it needed two retries** — `-y`/`--yes` alone didn't skip two
separate confirmation prompts (`components.json already exists`, `Would
you like to re-install existing UI components?`); needed `--force` and
`--reinstall` explicitly added.

**The actual result was a real surprise, reported directly rather than
assumed**: the preset resolved to `style: "base-maia"`, `baseColor:
"taupe"` — a completely different (warm brown/near-black) palette than
the green `:root`/`.dark` values Paul had pasted and had me hand-apply two
turns earlier, not a variation of it. It also rewrote 7 shadcn primitives
(`Button`, `Card`, `Select`, `Badge`, `Breadcrumb`, `DropdownMenu`,
`Tooltip`) to use a brand-new `hugeicons` dependency instead of
`lucide-react` (used everywhere else in the app), and restyled them
`rounded-4xl` instead of `rounded-lg` — directly undoing the "match the
access-status pill's radius to the card" change from a few entries back.
Fonts were the one unambiguous win: real `Outfit` (body) + `Space
Grotesk` (heading) via `next/font/google`, properly wired into
`layout.tsx` and consumed through `--font-sans`/`--font-heading`.

Asked directly how to proceed given the mismatch (keep fonts only and
revert the rest / full revert / keep everything) rather than guessing;
Paul chose to keep everything, including the taupe palette and the two
icon libraries.

**Why the earlier token refactor didn't need redoing**: because that pass
converted hardcoded hex to CSS-variable *references* (`bg-primary`,
`var(--primary)`) rather than baking in the green hex values directly,
every one of those ~50 files now automatically reflects the new taupe
palette with zero additional changes — this is exactly the point of using
tokens instead of literal colors.

**Icon library resolution**: `hugeicons` stays confined to the 7
regenerated `ui/*.tsx` primitive files (as the CLI produced them);
`lucide-react` stays as-is across the app's own ~100+ existing icon
usages elsewhere. A full migration wasn't requested and isn't warranted
just because two small icon libraries now coexist in the bundle.

**Real bug this surfaced, fixed immediately**: `task-status-select.tsx`'s
`IN_PROGRESS` and `project-status-select.tsx`'s `ACTIVE` had both been
converted to `var(--primary)` in the earlier token refactor (reasonable
when primary was blue) — once primary became taupe, both status pills
silently went dark/brown instead of staying a recognizable blue. Paul
caught it live ("the inprogress bar also gets the dark color"). Fixed by
reverting both back to a fixed `#2a78d6`, decoupled from the theme's
primary token — these are status-semantic colors (like the already-fixed
green/red/orange ones), not brand-identity references, so they
shouldn't move when `--primary` changes. This is the same "don't couple
status meaning to brand color" principle already applied everywhere else;
missing it on exactly these two was the oversight.

### Verification

`tsc --noEmit` clean, `eslint` across the entire `src` directory clean,
`pnpm test` 34/34, and a full production `next build` — compiled and
type-checked successfully (confirming the new fonts/dependencies/
`cn()`-merged component overrides all resolve correctly), failing
afterward only on the same pre-existing Supabase connection-pool limit
seen earlier this session (this time on `/clients` instead of
`/dashboard` — confirms it's pool-state-dependent, not tied to a specific
page). Also spot-checked that `tailwind-merge` (used by `cn()`) correctly
lets a consumer's own `className` — e.g. the access-status pill's
`rounded-lg` override — win over the regenerated primitive's new
`rounded-4xl` default, so existing per-usage overrides throughout the app
still apply correctly on top of the new base components. Not
independently confirmed in a browser this session (Chrome tool
unavailable, as throughout) — worth a real visual pass given how much
changed in this one command.

## More status/progress indicators found turned black — same fix pattern (2026-08-18)

A follow-up screenshot showed the Timeline's current-stage bar segment and
the Next Milestone card's progress bar both rendering black instead of
blue — the same `bg-primary`/`var(--primary)` coupling issue just fixed
on the status pills, in two more spots the earlier sweep missed.

Fixed in `project-timeline.tsx`: `STATUS_TEXT_COLOR.current` and
`STATUS_DOT_COLOR.current` (were `text-primary`/`bg-primary`) and the
"In progress" label's ternary — all three back to fixed `#2a78d6`,
matching the already-fixed hex used for `done`/`pending` in those same
maps. Fixed in `project-pulse-cards.tsx`: Next Milestone's progress bar
fill (`bg-primary` → `bg-[#2a78d6]`) and its flag icon
(`iconColor`/`iconBg` back to fixed `#2a78d6`/`#e8f0fb`). Proactively
also reverted the same icon-color pattern on `project-overview-form.tsx`'s
Launch date and Last activity cards, even though the screenshot didn't
show them — same family of stat-card icon circles, would have looked
inconsistent (some blue, some taupe) within the same 2x2 grid otherwise.

Checked the rest of the app for any other `bg-primary`/`text-primary`
usage that might be a status/progress indicator rather than a genuine
button or link — everything remaining is confirmed to be actual
interactive UI (solid buttons, text links, the active-tab indicator, the
project-switcher's "currently open" checkmark) where following the theme
color is correct and expected, not status semantics that need to stay
fixed. Nothing else needed changing.

### Verification

`tsc --noEmit`, `eslint` on all three touched files, `pnpm test` (34/34)
— clean.

## Subtask container background reverted (2026-08-18)

Another instance of the same regression: `task-stage-board.tsx`'s
subtask-list container was converted from a literal `bg-[#f9f9f7]` to
`bg-muted` in the earlier bulk refactor — a static, always-visible panel
fill, so the new taupe theme's `--muted` value showed up as a visibly
different grey wash behind every subtask block. Reverted to the literal
hex. Found and fixed the one other identical case proactively
(`access-items-panel.tsx`'s shared-login box, same "static bg-muted panel
fill" pattern) before it got its own bug report — left the `hover:bg-muted`
states elsewhere alone, since those are transient hover backgrounds, not
persistently-visible fills, and weren't what was flagged.

`tsc --noEmit`, `eslint` on both touched files, `pnpm test` (34/34) —
clean.

## Font reverted from Outfit/Space Grotesk back to Geist (2026-08-18)

Paul asked to swap the font back. `layout.tsx`: dropped the `Outfit`/
`Space_Grotesk` font loaders entirely; `Geist`'s loader now sets
`--font-sans` directly (was `--font-geist-sans`, an unused variable name
after the swap) instead of a separate font filling that slot; `Geist_Mono`
untouched (`--font-geist-mono`, which `--font-mono` already referenced —
that half of the shadcn init's font change was never actually applied to
mono, so nothing to revert there). `globals.css`: `--font-heading` was
`var(--font-heading)` — self-referential and only resolved because the
now-removed `Space_Grotesk` loader supplied that variable; changed to
`var(--font-sans)` so headings fall back to Geist too, matching the
original single-font-family setup from before any of this session's font
changes.

### Verification

`tsc --noEmit`, `eslint` on both touched files, `pnpm test` (34/34) —
clean. Ran a full production `next build` given this touches the root
font loader — compiled and type-checked successfully, failing afterward
only on the same pre-existing Supabase connection-pool limit seen
repeatedly this session (this time on `/clients`, confirming it's
pool-state-dependent, not code-related).

## Pill-shaped buttons matched to the global radius (2026-08-18)

Per a screenshot of the project header (Active status select, the "⋮"
quick-actions trigger, "+ New Task") all rendering fully pill-shaped —
same root cause as the earlier Select-pill radius fix, just not yet
caught at the source: the `base-maia` preset's `ui/button.tsx`,
`ui/badge.tsx`, `ui/select.tsx`, and `ui/tooltip.tsx` all default to
`rounded-4xl`. Rather than patch each of these three usages individually
(the way the access-status pill was fixed earlier, before the pattern was
recognized as systemic), fixed all four primitives at the source:
`rounded-4xl` → `rounded-lg` everywhere it appeared — `rounded-lg` is
`var(--radius)` directly per the `@theme inline` mapping (`--radius-lg:
var(--radius)`), so every button/badge/select/tooltip in the app now
matches the same 0.625rem radius already used throughout the app's own
hand-styled cards, with no per-usage overrides needed. Confirmed no
`rounded-4xl` remains anywhere in `src`.

### Verification

`tsc --noEmit`, `eslint` on all four touched files, `pnpm test` (34/34)
— clean.

## Next Actions: one priority pill instead of two redundant labels (2026-08-18)

Each row used to show a red "CRITICAL" badge inline next to the title
(only for `isCritical` tasks) *and* a separate plain-text priority label
on the right (always shown) — visually redundant per a screenshot.
Collapsed to one: the inline critical badge is gone, and the right-side
plain text is now a colored pill keyed off `priority` itself (CRITICAL
red, HIGH orange, MEDIUM/LOW neutral grey) — same position the plain text
used to occupy, just styled as a badge instead of bare text.

### Verification

`tsc --noEmit`, `eslint` on the touched file, `pnpm test` (34/34) —
clean.
