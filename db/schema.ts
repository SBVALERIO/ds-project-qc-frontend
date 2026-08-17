import { sql } from "drizzle-orm";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
    createdBy: text("created_by").notNull(),
    createdByEmail: text("created_by_email").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_project_events_project_created").on(table.projectId, table.createdAt),
  ],
);
