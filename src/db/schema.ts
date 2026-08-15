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

export const accessStatusEnum = pgEnum("access_status", [
  "NOT_REQUESTED",
  "REQUESTED",
  "RECEIVED",
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
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const projects = pgTable("projects", {
  id: cuid(),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id),
  name: text("name").notNull(),
  projectType: text("project_type").notNull(),
  status: projectStatusEnum("status").notNull().default("ACTIVE"),
  healthScore: integer("health_score").notNull().default(0),
  launchReady: boolean("launch_ready").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  launchedAt: timestamp("launched_at"),
});

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
    title: text("title").notNull(),
    description: text("description"),
    status: taskStatusEnum("status").notNull().default("TODO"),
    priority: taskPriorityEnum("priority").notNull().default("MEDIUM"),
    isCritical: boolean("is_critical").notNull().default(false),
    dueDate: timestamp("due_date"),
    assignee: text("assignee"),
    notes: text("notes"),
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

export const attachments = pgTable("attachments", {
  id: cuid(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  label: text("label"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const accessItems = pgTable("access_items", {
  id: cuid(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: accessStatusEnum("status").notNull().default("NOT_REQUESTED"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const activityLogs = pgTable("activity_logs", {
  id: cuid(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  detail: text("detail"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
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
