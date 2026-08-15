# Developer & Marketing Workflow OS — MVP Plan

_This is the original plan approved at the start of the build (before the
Prisma→Drizzle swap and other in-flight decisions — see `PROJECT_STATUS.md`
for current state and what's changed since)._

## Context

Paul runs client web/marketing projects (WordPress, Elementor, Shopify, GA4,
GSC, Clarity, Klaviyo, GHL, Meta Ads, SEO, QA...) and wants software that
remembers his professional workflow so nothing gets forgotten between
Discovery and Handoff. The full vision spec covers 12+ technology workflows,
AI features, and a large nav — too much to build at once. This plan cuts a
buildable MVP that proves the one piece everything else depends on: a
**data-driven workflow engine** that turns "these technologies are involved"
into a correct, deduplicated set of stages/tasks/dependencies — then wraps
it in just enough UI to run real projects day to day.

**Assumptions locked in for this plan** (flag if wrong, easy to change before
we start building):
- **Single user** (just Paul). No teams/roles — one login gates one
  person's data. Saves real build time vs. multi-tenant auth.
- **Stack**: Next.js (App Router) + TypeScript + Tailwind + Supabase
  (Postgres + Auth) + Prisma as the ORM + Zod for validation, deployed on
  Vercel. Supabase was chosen because tooling for it is already connected
  in this session and it bundles Postgres + Auth + storage in one place —
  fastest path to a running app for a solo project.
- **First technology templates** (per your answer): WordPress, Elementor
  Pro, Shopify, GA4, Google Search Console, Microsoft Clarity, Klaviyo.
  I'm adding **Google Tag Manager** to this set as a bundled part of the
  "Analytics & Tracking" pack — your own `integrations-playbook` skill
  routes GA4/Clarity/Meta Pixel through GTM rather than installing them
  directly, so the workflow engine should reflect how you actually work.
  Say the word if you'd rather leave GTM out for now.
- Project types unlocked by this tech set: WordPress Website, Elementor
  Website, Shopify Store, Website Redesign, Analytics Setup, Tracking
  Setup, Email Marketing Setup, SEO Project.
- Stages used (subset of the 18 in the spec, only the ones this tech set
  touches): Discovery, Access & Credentials, Planning, Design, Development,
  Integrations, SEO, Analytics & Tracking, CRM & Email, Ecommerce, QA,
  Performance, Security, Deployment, Launch, Handoff, Post-Launch.
  (Advertising/CRM-pipeline stages stay out until Meta Ads/GHL are added.)

**Explicitly deferred past MVP**: AI features, multi-user/roles, Reports
tab, live Integrations tab (OAuth-synced data), GHL/Meta Ads/HubSpot/
Mailchimp/WooCommerce/Webflow templates, notifications, file-upload
attachments (MVP stores attachments as links), Workflow Template visual
editor (MVP ships templates as seed data, editable via DB/seed file, not UI).

## Database Schema

Extends the spec's suggested table list; subtasks are modeled as tasks with
a nullable `parentTaskId` (self-join) so status/dependency/blocking logic
only has to be written once and works identically for tasks and subtasks.
(Implemented with Drizzle, not Prisma — see PROJECT_STATUS.md — but the
table shapes below are what actually shipped, in `src/db/schema.ts`.)

Core tables:
- `clients` — id, name, company, contactEmail, contactPhone, notes
- `projects` — id, clientId, name, projectType, status, healthScore,
  launchReady, createdAt, launchedAt
- `technologies` — id, key, name, category (seeded: wordpress, elementor,
  shopify, ga4, gtm, gsc, clarity, klaviyo)
- `project_technologies` — projectId, technologyId
- `stages` — id, key, name, sortOrder (the fixed master stage list)
- `project_stages` — projectId, stageId, sortOrder (materialized subset +
  order for one project)
- `tasks` — id, projectId, stageId, parentTaskId (nullable, self-ref),
  canonicalKey (nullable — traces back to the template task it came from),
  title, description, status, priority, dueDate, assignee, notes,
  sortOrder, createdAt, completedAt
- `task_dependencies` — taskId, dependsOnTaskId
- `tags` / `task_tags`
- `attachments` — taskId, url, label
- `access_items` — projectId, name (e.g. "WordPress admin", "GA4 access"),
  status (not_requested/requested/received), notes
- `activity_logs` — projectId, taskId (nullable), action, detail, createdAt

Template tables (the authored content the engine draws from — schema exists,
but as of this writing the engine reads templates from `src/data/templates`
code directly rather than these tables; see PROJECT_STATUS.md):
- `templates` — id, technologyId (nullable for cross-tech bundles like QA
  or Handoff), key, name
- `template_stages` — templateId, stageId, sortOrder
- `template_tasks` — id, templateId, stageId, **canonicalKey** (stable
  string, e.g. `access.wp_admin`, `analytics.ga4.install`), title,
  description, defaultPriority, isCritical (drives Launch Mode), sortOrder
- `template_task_dependencies` — templateTaskId, dependsOnCanonicalKey
  (dependencies are expressed by canonical key, not by row id, so they
  resolve correctly *after* cross-template dedup)
- `template_subtasks` — templateTaskId, title, sortOrder

`Task.status`: Todo / In Progress / Blocked / Review / Done / Skipped.
`Task.priority`: Critical / High / Medium / Low.

## The Workflow Engine

A pure function, independent of the DB and UI, so it's directly testable:

```
generateWorkflow(technologyKeys: string[]): {
  stages: GeneratedStage[]
  tasks: GeneratedTask[]        // includes subtasks via parentCanonicalKey
  dependencies: GeneratedDependency[]
}
```

**Algorithm:**
1. Resolve `technologyKeys` → matching `templates` (a technology can map to
   more than one template; some templates like "QA" or "Access &
   Credentials" are cross-cutting and always included).
2. Collect every `template_task` from every matched template.
3. **Dedup by `canonicalKey`**: group tasks by key; each group collapses to
   one generated task (first template's title/description/priority wins;
   `isCritical` becomes true if *any* contributing template marks it
   critical). This is the mechanism that prevents "Install GA4" or
   "Receive WordPress admin access" from appearing twice when multiple
   templates reference it.
4. Resolve `template_task_dependencies` by canonical key against the
   deduped set — so a dependency edge from Elementor's "Build header" to
   the shared `access.wp_admin` task still resolves correctly even though
   that task was only materialized once.
5. Collect `stages` referenced by any surviving task, ordered by the master
   `stages.sortOrder` — stages with zero generated tasks are dropped, so a
   Shopify-only project never shows a "Development" stage meant for custom
   theme code it doesn't need... (only stages actually populated appear).
6. Return the plan; the caller persists it as real `project_stages` /
   `tasks` / `task_dependencies` rows.

**Concrete dedup example with the chosen tech set:**
- WordPress template emits `access.wp_admin` ("Receive WordPress admin
  access") in the Access & Credentials stage.
- Elementor, Klaviyo (for the signup-form embed), and the QA template all
  declare a dependency *on* `access.wp_admin` but do not re-emit it →
  engine creates exactly one task, with downstream dependency edges
  pointing at it.
- Elementor's "Desktop/Mobile QA" and Shopify's "Mobile QA" fold into the
  same `qa.visual.*` canonical keys used across templates, so QA doesn't
  duplicate per tech.

**Blocked-status propagation**: whenever a task's dependency isn't Done,
the dependent task's effective status shown in the UI is `Blocked` (stored
status stays whatever it was, so manual overrides survive); recomputed on
every write to the graph. Implemented as one shared function used by the
project view and health scoring — not reimplemented per screen.

## Screens (MVP nav — trims the full spec's nav to what's buildable now)

- `/dashboard` — stat tiles, Needs Attention feed, active projects table.
- `/clients`, `/clients/[id]`
- `/projects`, `/projects/new` (wizard: Client → Project Type →
  Technologies → Generate Workflow), `/projects/[id]` (stage-grouped task
  list + health/launch-readiness panel)
- `/today` — tasks due/overdue across all projects — **not built yet**
- `/qa` — QA-tagged tasks across projects — **not built yet** (currently
  QA tasks are only visible inside each project's own stage board)
- `/launch/[projectId]` — dedicated Launch Mode — **not built yet**
  (launch readiness currently shows inline on the project page instead)
- `/templates` — read-only browse of seeded templates — **not built yet**
- `/settings` — **not built yet**

`Reports` and `Integrations` nav items are stubbed/deferred entirely.

## Project Health & Forgotten Task Detection (rule-based, no AI)

- **Health score**: critical-task completion weighted 60%, overall
  completion 40%, minus *ratio-based* penalties for blocked/overdue tasks
  (changed from a flat per-task penalty after smoke testing showed it
  zeroed out health on any large freshly-generated project — see
  PROJECT_STATUS.md).
- **Check Project**: hand-written rule functions per technology, run on
  demand, listed as "Potential Issues." Ships with rules for GA4
  conversions, GSC sitemap, Klaviyo test submission, Clarity production
  data, backup confirmation. Adding a rule = adding a function, not a
  schema change.

## Build Order (for reference — steps 1-5, 7 are done; 6 partial; 8 pending)

1. Repo scaffold — **done** (Drizzle instead of Prisma)
2. Schema + migration + seed script for stages/technologies — **done**
3. Author template content for the 8 technologies — **done**
4. Workflow engine + unit tests — **done** (20 tests)
5. Project creation wizard + project detail view — **done**
6. Dashboard, Today, QA, Launch Mode, Handoff checklist — **dashboard done,
   Today/QA/Launch Mode/Handoff screens not built**
7. Health score + Check Project heuristics — **done** (with the health
   formula fix above)
8. Deploy to Vercel + Supabase, smoke test against a real project —
   **pending** (Supabase project decision still open)

## Verification

- Vitest unit tests on `generateWorkflow` — **done**, 20 tests.
- `npx tsc --noEmit` — **clean**.
- Manual smoke test (data layer + full headless-browser click-through) —
  **done**, see `scripts/smoke-test.ts` and `scripts/browser-smoke.mjs`.
