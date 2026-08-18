# Roadmap — Reducing Clicks, Preventing Mistakes

Source: Paul's feature brief, 2026-08-15. The framing shift that drove this:
the MVP (workflow engine + generated checklists) is done — the next layer of
value isn't more checklist content, it's removing the friction *around* the
checklist: context switching, chasing credentials, remembering what's done,
verifying integrations, client communication, handover prep.

The end-state vision: a **Website Delivery Command Center** — every project
shows progress %, access status, one-click links (WP admin, hosting, GA4,
GTM, GSC, Meta, Klaviyo, GHL, Figma...), verification proof, launch
readiness, and the single next action. Less "checklist app," more "personal
operating system for running WordPress/Shopify/marketing-integration
projects."

## The 10 features (as proposed)

1. **Next Action Dashboard** — don't show everything, show only what needs
   attention right now, one line per project, plus an estimated-work total.
2. **Project Health Score** — instant per-area breakdown (✓ Design ✓ Dev
   ⚠ Tracking Missing) without opening the project. *(Already exists as a
   single %; the area-by-area breakdown is new.)*
3. **Verification System** — proof-of-work per integration (GA4, GTM, GSC,
   Clarity, Meta Pixel, Klaviyo, GHL): not just "done," but evidence it
   actually works. Doubles as QA record, client proof, portfolio material.
4. **Launch Readiness** — a score plus the *specific* missing items, not
   just a fraction.
5. **Command Center** — one page per project: overview (client, domain,
   hosting, CMS, status, launch date) + one-click links to every tool.
6. **Access Manager** — centralized received/waiting status for every
   account a project touches, even alongside a password manager.
7. **Dynamic Templates** — presets like "Shopify + Klaviyo," "Shopify +
   Full Tracking," "WordPress Lead Gen Site" instead of one generic
   template per technology.
8. **Recurring SOPs** — monthly maintenance checklists for retainer clients
   (plugin updates, backup check, GA4 review, speed audit).
9. **Global Search** — search anything (client, project, tech, "domain",
   "klaviyo") and jump straight there. Matters once you're past ~20 projects.
10. **Keyboard-First UX** — `N` new project, `P` project search, `Space`
    mark complete, `/` search. Never touch the mouse.

## Phased priority (Paul's ordering)

- **Phase 1 (biggest ROI)** — Next Action Dashboard, Command Center,
  Launch Readiness, Verification System.
- **Phase 2** — Dynamic Templates, Access Manager, Global Search.
- **Phase 3** — SOP Automation, Keyboard Shortcuts, Reporting.

## Phase 1 — build notes (this pass)

- **Next Action Dashboard** (`/dashboard` rewrite): for every active
  project, surface the single highest-priority actionable task (not done,
  not blocked) as its "next action," plus a rough total estimated time
  across all shown next actions. No task-level time tracking exists yet, so
  the estimate is a priority-based heuristic (CRITICAL≈45m, HIGH≈30m,
  MEDIUM≈20m, LOW≈10m) — good enough to plan a morning, not meant to be
  precise. Real per-task estimates are a natural Phase 2/3 add if the
  heuristic isn't good enough in practice.
- **Command Center**: added to the existing project detail page rather than
  a new route — Overview (domain, target launch date, inline editable) and
  a Links & Access grid. This **resurrects the `access_items` table**,
  which existed in the schema from the original MVP design but was never
  wired to any query or UI. Added a `url` column to it, so one table now
  serves both Command Center's "one-click links" and (in Phase 2) Access
  Manager's status tracking — they're the same underlying data, just
  different views of it. Concretely this means Phase 2's Access Manager is
  mostly a UI pass on data this phase already collects, not a new build.
- **Launch Readiness**: enhanced the existing inline bar (project page) to
  list the actual titles of remaining critical tasks, not just "5/21."
  Didn't build a separate `/launch/[id]` route — the ask was for less
  navigation, not more, and the inline bar covers the mockup.
- **Verification System v1**: reuses the attachments feature already built
  (URL + label per task) rather than standing up file upload/storage
  infrastructure. A task with status DONE *and* at least one attachment now
  gets a visible "✓ Verified" treatment. This is a deliberate scope call —
  pasting a screenshot link (Drive, clipboard-to-link tools) is often
  faster than a multi-step upload dialog anyway, and it ships today instead
  of after a Supabase Storage integration. **Fast-follow candidate:** real
  drag-drop file upload to Supabase Storage (already an available
  dependency/project) if link-pasting proves too much friction in practice.

## Command Center v2 (built right after Phase 1)

Follow-up pass specifically on feature #5. Proposed a longer list, built the
three highest-leverage ones now, left the rest for later:

**Built:**
- Auto-populated Links & Access from the project's selected technologies
  (`src/data/access-item-presets.ts`) — no more typing the same names by
  hand every project.
- Project status shown and editable on the project page itself (existed in
  the schema, was completely absent from the UI before this).
- "Mark as Launched" via that same status dropdown — stamps
  `projects.launchedAt` the first time only, never overwritten by later
  status changes.

**Proposed, not yet built** (revisit when Command Center comes up again):
- Tech stack badges on the project page (which technologies this project
  actually uses, at a glance — currently only inferable from which stage
  sections happen to render).
- Client contact inline (email/phone, click-to-email/call) — avoids a
  detour to the Clients page for a quick outreach.
- Recent activity feed — `activity_logs` already records every status
  change, task addition, and project creation; it's written on every
  mutation but never displayed anywhere.
- Project notes field — clients and tasks have one, projects don't.
- Verification rollup — "4 of 9 integrations verified" as one summary line
  instead of scanning the task list for ✓ VERIFIED badges.
- Per-stage health breakdown (✓ Design / ⚠ Tracking Missing) — bigger than
  the others, needs a real per-stage completion calculation; better as its
  own pass than bolted onto this one.

## Gap-closing pass (2026-08-15)

Prompted by an honest "does this actually make a senior WP dev's workflow
fast?" self-assessment — five concrete gaps named in that assessment, closed
in one pass:

**Global Search + Command Palette (features #9 and half of #10):**
- `src/lib/queries/search.ts` — plain ILIKE search across clients, projects,
  and top-level tasks. Deliberately no full-text index; fine at this app's
  real scale (dozens of rows, not millions).
- `/search` page — server-rendered fallback / direct-navigation entry point.
- Command palette (`Ctrl/Cmd+K` or `/` when not typing in a field) —
  debounced live search plus static nav shortcuts to every page, arrow-key
  navigation, Enter to jump. Mounted once in the dashboard layout.
- Not built: the `N`/`P`/`Space` single-key shortcuts from the original
  brief. The palette covers the same "never touch the mouse" goal with one
  mechanism instead of a half-dozen individual bindings — simpler to
  remember, and easy to extend later if specific single-key shortcuts prove
  worth the complexity.

**Bulk actions (rest of #10):** `/tasks` now has per-row checkboxes and a
sticky bulk bar (Mark Done / Mark Skipped) — `bulkUpdateTaskStatus` in
`src/lib/queries/projects.ts` updates many tasks and recomputes health
scores for every affected project in one call.

**Recurring maintenance (feature #8, "Recurring SOPs"):** new
`maintenance_plans` table (`src/lib/queries/maintenance.ts`). Deliberately
reuses the existing `post_launch` stage for generated tasks rather than
inventing a new one — no schema/stage changes needed to slot recurring work
in alongside the build workflow. Each cycle's tasks get tagged
`maintenance:YYYY-MM` for history. **No real cron runs this** — there's no
background job runner in this app, so due plans surface on the dashboard
("Maintenance due") and Paul triggers generation by hand. `/maintenance`
page manages plans (cadence, checklist template, pause/resume). If this
becomes the primary way retainer work gets tracked, a real scheduled job
(e.g. Vercel Cron hitting a route that calls `generateMaintenanceRun` for
every due plan) is the natural next step — not built now since it'd need a
deployment target this app doesn't have yet.

**Real file upload (Verification System v1's flagged fast-follow):**
`src/lib/storage.ts` — uploads go to a **private** Supabase Storage bucket
(service-role key, never public), validated server-side (10MB cap,
image/video/PDF/text only). Rendered via signed URLs generated fresh on
every page load (1hr expiry) — no permanent public URL exists anywhere.
Paste-a-link attachments still work unchanged; upload is an additional
option, not a replacement. `attachments.url` is now nullable, with a new
`storagePath` column — exactly one of the two is set per row.

**Client-facing handoff page (named gap in the self-assessment, not one of
the original 10):** `projects.handoffToken` (random, 48 hex chars) gates a
public `/handoff/[token]` page — deliberately outside `proxy.ts`'s auth
gate (see its updated matcher comment). Shows status, domain, tech stack,
critical-task checklist, and access items **by name/URL/username only —
never passwords**. Generate/copy/revoke lives in the project page's Command
Center. This is a share-link model (anyone holding the link can view), same
trust model as a Google Doc "anyone with link."

## Accounts & Access redesign (2026-08-17)

Prompted directly: *"client will just add me as a user on their platform
right?"* — correct, and the original vault design modeled the wrong default
(shared password) for what's actually an invite flow on most platforms.
Full rationale/verification is in `PROJECT_STATUS.md`'s matching section —
summary: status vocabulary became `Not Requested → Requested → Invited →
Access Granted → Access Verified` (+ `Not Needed`), new `role`/
`instructions`/`grantedAt` fields, and two ownership models baked into
`access-item-presets.ts` — `self_created` (WordPress, Cloudways, GA4, GTM,
GSC, Clarity, domain registrar — Paul creates these, so they start already
`GRANTED`) vs `client_invite` (Shopify, Klaviyo, Printify, GHL, Meta — the
client owns the account, so these start `NOT_REQUESTED` with an
auto-suggested ask). The password vault didn't go away — it's a collapsed
"Shared login instead?" secondary path now, not the default.

## Command Center → operational dashboard (2026-08-17)

Prompted by a full product-design brief (treat the Command Center as an
operational dashboard, not a project-info page) plus a visual reference
(SaaS-analytics style: stat cards, status pills, timeline stepper). Built a
first mockup as a design artifact to align on IA before touching real code,
then implemented the confirmed top-3 + two more against the actual
`/projects/[id]` page — deliberately in the app's existing visual language
(blue `#2a78d6` accent, light-only), not the mockup's separate indigo/
dark-mode design-system, since a full app reskin is a distinct, much larger
job nobody asked for yet.

Explicitly **cut** from the brief's own draft: a "Team & Responsibilities"
section — this is a solo-developer tool, and per-person task ownership only
becomes real once a second executor exists. "Waiting on Client" survived
that same scrutiny because the client genuinely is a solo dev's real
blocker — it's not a team feature wearing a costume.

**Project Pulse** (`src/components/project-pulse.tsx`): a 4-stat row —
launch readiness % (existing critical-task math, just promoted to the
hero number instead of buried text), days to launch (from the existing
`targetLaunchDate`), items needing attention (existing `getProjectIssues`
count, now shown eagerly instead of only behind the manual "Check Project"
button), tasks remaining. Replaced the old duplicate healthScore corner
display — that number is still computed and used on `/projects` and
`/dashboard`, just no longer redundantly repeated on this page next to a
second, different completion metric.

**Timeline** (`src/components/project-timeline.tsx`): deliberately **not**
a new milestones concept — it's the project's existing `project_stages`
list, each stage's completion derived from its own tasks'
`effectiveStatus` at render time. Zero schema for this one. A stage reads
"done" if every task in it is Done/Skipped regardless of position, so a
later stage can legitimately show done while an earlier one is still
"current" — reflects real non-linear completion rather than forcing a
false sequential fiction.

**Next Actions (per-project)**: narrowed version of the dashboard's
existing `getNextActions` ranking (critical first, then priority) applied
to one project's top-level tasks instead of across all projects.

**Waiting on Client**: new `tasks.isWaitingOnClient` boolean +
`waitingOnClientSince` timestamp (stamped on flag, cleared on unflag — same
stamp-once-on-transition pattern as `grantedAt`/`launchedAt`), toggled from
a checkbox in the existing task-details panel. `listWaitingOnClientTasks`
excludes Done/Skipped tasks and sorts oldest-first. Card hides entirely
when nothing's flagged.

**Recent Activity**: `listRecentActivity` reads the `activity_logs` table
that's been recording every mutation since the MVP but was never displayed
anywhere — exactly the gap flagged in this file's "Command Center v2"
section months ago. Human-readable message formatting + relative
timestamps live in the component, not the query, so the query stays a
plain data read.

**Accounts & Access visual pass**: a status-colored dot per row plus a
matching soft background tint (green for Granted/Verified, amber for
Requested/Invited) — same "encode state in the row background" convention
already used for Done tasks elsewhere on this page. No behavior changes;
all the edit/remove functionality from the redesign above is untouched.

### Not built from the brief (by design)

- App-wide indigo/dark-mode reskin — the mockup was a design reference,
  not a mandate to reskin every page; flagged directly, not assumed.
- Handoff link view-tracking (`lastViewedAt`) — named as a real gap in the
  brutal review, but wasn't in the confirmed 3-phase build list, so left
  for a future pass.
- Friday-launch / risk-flag nudges — same: identified, not yet built.
- Project Notes field, Client Portal further polish — ranked "nice to
  have," not in the confirmed build order.

## Open questions for what's left

- Dynamic Templates: presets are a new concept on top of the existing
  per-technology template model — needs a design decision on whether a
  preset is just "a saved technology-key combo" (simple, reuses everything)
  or something that can override/add tasks per preset (more powerful, more
  schema).
- Access Manager: mostly a UI pass on data already collected (see Command
  Center note above) — hasn't come up again since Phase 1.
- Single-key keyboard shortcuts (`N`, `P`, `Space`): deferred in favor of
  the command palette (see above) — revisit only if the palette proves too
  slow for a specific repeated action.
