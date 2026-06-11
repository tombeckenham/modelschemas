CREATE TABLE `cache_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`fetched_at` integer NOT NULL,
	`stale_time` integer NOT NULL,
	`last_error` text,
	`refreshing` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`url` text NOT NULL,
	`secret` text NOT NULL,
	`events` text NOT NULL,
	`provider_filter` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`provider_filter`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `subscriptions_agentId_idx` ON `subscriptions` (`agent_id`);--> statement-breakpoint
CREATE TABLE `webhook_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription_id` text NOT NULL,
	`change_id` text NOT NULL,
	`attempt` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`last_response_code` integer,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`change_id`) REFERENCES `changes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `webhook_deliveries_status_nextAttemptAt_idx` ON `webhook_deliveries` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `webhook_deliveries_subscriptionId_idx` ON `webhook_deliveries` (`subscription_id`);