import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    code: text("code").notNull().default(""),
    projectType: text("project_type").notNull().default("Residential"),
    status: text("status").notNull().default("Ativo"),
    createdBy: text("created_by").notNull(),
    createdByEmail: text("created_by_email").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_projects_updated_at").on(table.updatedAt),
    index("idx_projects_status").on(table.status),
  ],
);

export const projectEvents = sqliteTable(
  "project_events",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    documentType: text("document_type").notNull(),
    title: text("title").notNull(),
    revision: text("revision").notNull().default(""),
    status: text("status").notNull().default("Registrado"),
    notes: text("notes").notNull().default(""),
    findingsSummary: text("findings_summary").notNull().default(""),
    findingsJson: text("findings_json").notNull().default("[]"),
    createdBy: text("created_by").notNull(),
    createdByEmail: text("created_by_email").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_project_events_project_created").on(table.projectId, table.createdAt),
  ],
);

// A finding's `id` is only unique within the analysis run that produced
// it (re-numbered from 1 per upload), so a status/reason needs the pair
// (event_id, finding_id) as its key, not the finding id alone.
export const taskStatuses = sqliteTable(
  "task_statuses",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => projectEvents.id, { onDelete: "cascade" }),
    findingId: integer("finding_id").notNull(),
    status: text("status").notNull().default("Pendente"),
    reason: text("reason").notNull().default(""),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_task_statuses_event_finding").on(table.eventId, table.findingId),
  ],
);
