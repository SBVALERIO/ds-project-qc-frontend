CREATE TABLE `task_statuses` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`finding_id` integer NOT NULL,
	`status` text DEFAULT 'Pendente' NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `project_events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_task_statuses_event_finding` ON `task_statuses` (`event_id`,`finding_id`);
