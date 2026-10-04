CREATE TABLE `pay_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`employee` text NOT NULL,
	`effective` text NOT NULL,
	`type` text NOT NULL,
	`cents` integer NOT NULL,
	FOREIGN KEY (`employee`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pay_rates_employee_effective` ON `pay_rates` (`employee`,`effective`);