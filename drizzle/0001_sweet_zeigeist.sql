CREATE TABLE `changes` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`provider_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`summary` text NOT NULL,
	`payload` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `changes_createdAt_idx` ON `changes` (`created_at`);--> statement-breakpoint
CREATE INDEX `changes_providerId_idx` ON `changes` (`provider_id`);--> statement-breakpoint
CREATE TABLE `endpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`activity` text NOT NULL,
	`method` text NOT NULL,
	`path` text NOT NULL,
	`description` text,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `endpoints_providerId_idx` ON `endpoints` (`provider_id`);--> statement-breakpoint
CREATE TABLE `models` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`raw_id` text NOT NULL,
	`activity` text,
	`display_name` text,
	`context_window` integer,
	`max_output` integer,
	`modalities` text,
	`pricing` text,
	`capabilities` text,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`deprecated_at` integer,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `models_providerId_idx` ON `models` (`provider_id`);--> statement-breakpoint
CREATE INDEX `models_activity_idx` ON `models` (`activity`);--> statement-breakpoint
CREATE TABLE `providers` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`spec_source_url` text NOT NULL,
	`models_endpoint` text,
	`auth_env_var` text,
	`last_polled_at` integer,
	`last_synced_at` integer,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `schema_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`endpoint_id` text NOT NULL,
	`kind` text NOT NULL,
	`content_hash` text NOT NULL,
	`schema` text NOT NULL,
	`spec_revision` text,
	`created_at` integer NOT NULL,
	`superseded_at` integer,
	FOREIGN KEY (`endpoint_id`) REFERENCES `endpoints`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `schema_versions_endpointId_kind_idx` ON `schema_versions` (`endpoint_id`,`kind`);--> statement-breakpoint
CREATE INDEX `schema_versions_contentHash_idx` ON `schema_versions` (`content_hash`);