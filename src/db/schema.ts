import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

const cuid = () => text("id").primaryKey().$defaultFn(() => createId());

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const taskStatusEnum = pgEnum("task_status", [
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "REVIEW",
  "DONE",
  "SKIPPED",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
]);

// Most platforms grant access via invite (add paul@... as a collaborator/
// admin), not a shared password — this vocabulary tracks that flow.
// NOT_NEEDED covers e.g. a technology that turned out not to require a
// separate account for this project.
export const accessStatusEnum = pgEnum("access_status", [
  "NOT_REQUESTED",
  "REQUESTED",
  "INVITED",
  "GRANTED",
  "VERIFIED",
  "NOT_NEEDED",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "ACTIVE",
  "ON_HOLD",
  "LAUNCHED",
  "ARCHIVED",
]);

// ---------------------------------------------------------------------------
// Core: clients, projects, technologies
// ---------------------------------------------------------------------------

export const clients = pgTable("clients", {
  id: cuid(),
  name: text("name").notNull(),
  company: text("company"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  address: text("address"),
  notes: text("notes"),
  // Client Portal — a persistent, unguessable link (same pattern as
  // projects.handoffToken, one level up) giving the client themselves
  // access to a dashboard of all their projects, no login required.
  portalToken: text("portal_token").unique(),
  // 'manual' (Paul entered them) vs 'intake' (they self-submitted via the
  // public intake form) — lets Paul spot self-service signups at a glance
  // without needing an activity_logs entry, which requires a projectId
  // this client may not have yet.
  source: text("source").notNull().default("manual"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const projects = pgTable(
  "projects",
  {
    id: cuid(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id),
    name: text("name").notNull(),
    projectType: text("project_type").notNull(),
    status: projectStatusEnum("status").notNull().default("ACTIVE"),
    healthScore: integer("health_score").notNull().default(0),
    launchReady: boolean("launch_ready").notNull().default(false),
    domain: text("domain"),
    targetLaunchDate: timestamp("target_launch_date"),
    // Bearer token for the public read-only /handoff/[token] page — null
    // until "Generate handoff link" is clicked. Unguessable (32 random
    // bytes), not tied to a login — treat it like a share link: anyone
    // holding it can view.
    handoffToken: text("handoff_token"),
    // Freeform scratchpad — "client prefers WhatsApp," "don't launch
    // Fridays." Not a wiki, not structured; a single field is enough at
    // solo scale.
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    launchedAt: timestamp("launched_at"),
  },
  (t) => [uniqueIndex("project_handoff_token_unique").on(t.handoffToken)]
);

export const technologies = pgTable("technologies", {
  id: cuid(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
});

export const projectTechnologies = pgTable(
  "project_technologies",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    technologyId: text("technology_id")
      .notNull()
      .references(() => technologies.id),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.technologyId] })]
);

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------

export const stages = pgTable("stages", {
  id: cuid(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const projectStages = pgTable(
  "project_stages",
  {
    id: cuid(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    stageId: text("stage_id")
      .notNull()
      .references(() => stages.id),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [uniqueIndex("project_stage_unique").on(t.projectId, t.stageId)]
);

// ---------------------------------------------------------------------------
// Tasks, dependencies, tags, attachments
// ---------------------------------------------------------------------------

export const tasks = pgTable(
  "tasks",
  {
    id: cuid(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    stageId: text("stage_id")
      .notNull()
      .references(() => stages.id),
    parentTaskId: text("parent_task_id"),
    canonicalKey: text("canonical_key"),
    // Set only on tasks generateMaintenanceRun() creates. A recurring
    // checklist item is one persistent task, not a fresh row every cycle —
    // regenerating looks this up to reset status/due date on the existing
    // task instead of inserting a duplicate (see generateMaintenanceRun's
    // own comment for why that used to happen).
    maintenancePlanId: text("maintenance_plan_id").references(() => maintenancePlans.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    status: taskStatusEnum("status").notNull().default("TODO"),
    priority: taskPriorityEnum("priority").notNull().default("MEDIUM"),
    isCritical: boolean("is_critical").notNull().default(false),
    dueDate: timestamp("due_date"),
    assignee: text("assignee"),
    notes: text("notes"),
    // The client, not a dependency or Paul's own backlog, is the blocker.
    // waitingOnClientSince stamps when it was flagged (cleared on un-flag)
    // so "oldest waiting" is exact, not inferred from unrelated edits.
    isWaitingOnClient: boolean("is_waiting_on_client").notNull().default(false),
    waitingOnClientSince: timestamp("waiting_on_client_since"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (t) => [
    index("task_project_stage_idx").on(t.projectId, t.stageId),
    index("task_project_canonical_idx").on(t.projectId, t.canonicalKey),
  ]
);

export const taskDependencies = pgTable(
  "task_dependencies",
  {
    id: cuid(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    dependsOnTaskId: text("depends_on_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("task_dependency_unique").on(t.taskId, t.dependsOnTaskId),
  ]
);

export const tags = pgTable("tags", {
  id: cuid(),
  name: text("name").notNull().unique(),
});

export const taskTags = pgTable(
  "task_tags",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.tagId] })]
);

export const attachments = pgTable(
  "attachments",
  {
    id: cuid(),
    // Exactly one of taskId / projectId is set: taskId for proof attached to
    // a specific task (the original use), projectId for a general project
    // file that isn't tied to any one step (a client's logo, a brand guide) —
    // a chat-uploaded file (messageId set below) also sets projectId, so it
    // shows up in the Files tab the same way any other project file does.
    taskId: text("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
    // Set only when this file was uploaded via the Comments thread — lets a
    // message render its attachment inline. Cascades so deleting a message
    // (or the whole thread) removes its file's DB row automatically; the
    // actual Supabase Storage object still needs an explicit delete first
    // (see deleteProjectMessage/deleteAllProjectMessages).
    messageId: text("message_id").references(() => projectMessages.id, { onDelete: "cascade" }),
    // Exactly one of url / storagePath is set: url for a pasted external link
    // (Drive, Loom, etc.), storagePath for a file uploaded straight into the
    // private Supabase Storage "attachments" bucket — see src/lib/storage.ts.
    url: text("url"),
    storagePath: text("storage_path"),
    label: text("label"),
    // Bytes — only set for storagePath uploads (file.size at upload time);
    // null for pasted-link attachments and for rows uploaded before this
    // column existed.
    fileSize: integer("file_size"),
    // True when uploaded by the client via the public Client Portal
    // (src/lib/storage.ts's uploadProjectAttachment fromClient option),
    // false for everything Paul uploads internally — lets the Files tab
    // badge which is which.
    uploadedByClient: boolean("uploaded_by_client").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("attachment_task_idx").on(t.taskId),
    index("attachment_project_idx").on(t.projectId),
    index("attachment_message_idx").on(t.messageId),
  ]
);

export const accessItems = pgTable("access_items", {
  id: cuid(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: accessStatusEnum("status").notNull().default("NOT_REQUESTED"),
  url: text("url"),
  // What role to request / was granted (Administrator, Editor, Owner...).
  role: text("role"),
  // What to actually ask the client for — auto-suggested per technology
  // (see src/data/access-item-presets.ts), editable per project.
  instructions: text("instructions"),
  grantedAt: timestamp("granted_at"),
  username: text("username"),
  // AES-256-GCM ciphertext (base64), never plaintext — see src/lib/crypto.ts.
  // Secondary path now: most platforms are invite-based, not credential-
  // based (see status/role/instructions above) — this covers the real
  // exceptions (a shared inbox, WP admin before ownership handoff).
  passwordEncrypted: text("password_encrypted"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Backs login rate limiting. DB-backed rather than in-memory — an
// in-memory counter would silently reset on every cold start if this ever
// runs on a serverless platform (Vercel), which defeats the point.
export const loginAttempts = pgTable("login_attempts", {
  id: cuid(),
  success: boolean("success").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Recurring/retainer maintenance checklists — separate from the one-time
// build workflow. "Generate this cycle's checklist" materializes
// checklistTemplate's lines as real tasks under the project's existing
// post_launch stage, tags them with a dated tag for history, and advances
// nextDueAt. No real cron runs this; it's surfaced as a due list on the
// dashboard that Paul triggers by hand.
export const maintenancePlans = pgTable("maintenance_plans", {
  id: cuid(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  cadenceDays: integer("cadence_days").notNull().default(30),
  // Newline-separated checklist item titles.
  checklistTemplate: text("checklist_template").notNull(),
  nextDueAt: timestamp("next_due_at").notNull(),
  lastGeneratedAt: timestamp("last_generated_at"),
  isActive: boolean("is_active").notNull().default(true),
  // Whether the client has paid for the current cycle — manually toggled,
  // there's no billing/invoicing integration to derive this from. Reset to
  // false every time generateMaintenanceRun() advances to a new cycle, so
  // a paid cycle doesn't silently read as still-paid once a new invoice is
  // actually due.
  isPaid: boolean("is_paid").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: cuid(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    detail: text("detail"),
    // Who did this — a plain name string, not a userId/FK, since there's no
    // user accounts table yet (single shared-password app). Every write site
    // passes a real value from src/data/agency-info.ts (the agency owner, or
    // "Client" for the one action a client actually triggers themselves —
    // opening the handoff page), so this scales cleanly to a real userId FK
    // later without changing what's displayed today.
    actorName: text("actor_name").notNull().default("Paul"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("activity_log_project_idx").on(t.projectId)]
);

// A simple two-way thread per project, readable/postable from both the
// internal app (as "Paul") and the public Client Portal (as "Client") —
// backs Comments on both sides. Not folded into activity_logs: that table
// is a lightweight event feed, this is real conversational content.
export const projectMessages = pgTable(
  "project_messages",
  {
    id: cuid(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("project_message_project_idx").on(t.projectId)]
);

// A single settings row, not scoped to any client/project — currently just
// holds the one reusable "New Client Intake" link. First agency-wide
// setting this app has needed; add more columns here rather than a new
// table if others come up later.
export const agencySettings = pgTable("agency_settings", {
  id: text("id").primaryKey().default("singleton"),
  intakeToken: text("intake_token").unique(),
});

// ---------------------------------------------------------------------------
// Templates (authored content the workflow engine draws from)
// ---------------------------------------------------------------------------

export const templates = pgTable("templates", {
  id: cuid(),
  technologyId: text("technology_id").references(() => technologies.id),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  // Always included in generation regardless of selected technologies
  // (e.g. cross-cutting QA / Handoff packs).
  alwaysInclude: boolean("always_include").notNull().default(false),
});

export const templateStages = pgTable(
  "template_stages",
  {
    id: cuid(),
    templateId: text("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    stageId: text("stage_id")
      .notNull()
      .references(() => stages.id),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [uniqueIndex("template_stage_unique").on(t.templateId, t.stageId)]
);

export const templateTasks = pgTable("template_tasks", {
  id: cuid(),
  templateId: text("template_id")
    .notNull()
    .references(() => templates.id, { onDelete: "cascade" }),
  stageId: text("stage_id")
    .notNull()
    .references(() => stages.id),
  canonicalKey: text("canonical_key").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  defaultPriority: taskPriorityEnum("default_priority")
    .notNull()
    .default("MEDIUM"),
  isCritical: boolean("is_critical").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const templateSubtasks = pgTable("template_subtasks", {
  id: cuid(),
  templateTaskId: text("template_task_id")
    .notNull()
    .references(() => templateTasks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

// Dependencies are expressed by canonical key (not template_task id) so they
// resolve correctly across templates *after* cross-template dedup.
export const templateTaskDependencies = pgTable(
  "template_task_dependencies",
  {
    id: cuid(),
    templateTaskId: text("template_task_id")
      .notNull()
      .references(() => templateTasks.id, { onDelete: "cascade" }),
    dependsOnCanonicalKey: text("depends_on_canonical_key").notNull(),
  },
  (t) => [
    uniqueIndex("template_task_dependency_unique").on(
      t.templateTaskId,
      t.dependsOnCanonicalKey
    ),
  ]
);

// ---------------------------------------------------------------------------
// Relations (for Drizzle's relational query API)
// ---------------------------------------------------------------------------

export const clientsRelations = relations(clients, ({ many }) => ({
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(clients, { fields: [projects.clientId], references: [clients.id] }),
  technologies: many(projectTechnologies),
  stages: many(projectStages),
  tasks: many(tasks),
  accessItems: many(accessItems),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  stage: one(stages, { fields: [tasks.stageId], references: [stages.id] }),
  parentTask: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id],
    relationName: "subtasks",
  }),
  subtasks: many(tasks, { relationName: "subtasks" }),
  tags: many(taskTags),
  attachments: many(attachments),
  dependsOn: many(taskDependencies, { relationName: "dependent" }),
}));

export const templatesRelations = relations(templates, ({ many, one }) => ({
  technology: one(technologies, {
    fields: [templates.technologyId],
    references: [technologies.id],
  }),
  templateStages: many(templateStages),
  templateTasks: many(templateTasks),
}));

export const templateTasksRelations = relations(templateTasks, ({ one, many }) => ({
  template: one(templates, {
    fields: [templateTasks.templateId],
    references: [templates.id],
  }),
  stage: one(stages, { fields: [templateTasks.stageId], references: [stages.id] }),
  subtasks: many(templateSubtasks),
  dependsOn: many(templateTaskDependencies),
}));
