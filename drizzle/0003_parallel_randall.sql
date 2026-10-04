CREATE TABLE `kiosk_access` (
	`owner` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	FOREIGN KEY (`owner`) REFERENCES `settings`(`owner`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kiosk_access_email` ON `kiosk_access` (`email`);