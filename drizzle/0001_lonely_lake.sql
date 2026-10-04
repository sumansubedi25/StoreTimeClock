CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`at` integer NOT NULL,
	`action` text NOT NULL,
	`employee` text NOT NULL,
	`reason` text NOT NULL,
	`before` text,
	`after` text
);
--> statement-breakpoint
CREATE INDEX `audit_owner_at` ON `audit` (`owner`,`at`);