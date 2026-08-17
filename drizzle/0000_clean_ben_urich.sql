CREATE TABLE `project_events` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`document_type` text NOT NULL,
	`title` text NOT NULL,
	`revision` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Registrado' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_by_email` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_project_events_project_created` ON `project_events` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text DEFAULT '' NOT NULL,
	`project_type` text DEFAULT 'Residential' NOT NULL,
	`status` text DEFAULT 'Ativo' NOT NULL,
	`created_by` text NOT NULL,
	`created_by_email` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_projects_updated_at` ON `projects` (`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_projects_status` ON `projects` (`status`);