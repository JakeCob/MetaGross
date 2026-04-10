CREATE TABLE `analysis_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`cache_key` text NOT NULL,
	`cache_type` text NOT NULL,
	`result_json` text NOT NULL,
	`model` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`cost_usd` real,
	`created_at` integer,
	`expires_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `analysis_cache_cache_key_unique` ON `analysis_cache` (`cache_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `analysis_cache_cache_key_idx` ON `analysis_cache` (`cache_key`);--> statement-breakpoint
CREATE TABLE `match_turn_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`turn_id` text,
	`side` text,
	`slot` integer,
	`action_type` text,
	`move_name` text,
	`target_side` text,
	`target_slot` integer,
	`damage_dealt_percent` real,
	`was_critical_hit` integer DEFAULT 0,
	`was_ko` integer DEFAULT 0,
	`switch_in_species` text,
	`switch_out_species` text,
	`mega_evolved` integer DEFAULT 0,
	`move_grade` text,
	`grade_reason` text,
	`optimal_play` text,
	`created_at` integer,
	FOREIGN KEY (`turn_id`) REFERENCES `match_turns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `match_turn_actions_turn_id_idx` ON `match_turn_actions` (`turn_id`);--> statement-breakpoint
CREATE TABLE `match_turns` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text,
	`turn_number` integer,
	`field_state` text DEFAULT '{}',
	`active_p1` text DEFAULT '[]',
	`active_p2` text DEFAULT '[]',
	`win_probability` real,
	`is_turning_point` integer DEFAULT 0,
	`created_at` integer,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `match_turns_match_id_idx` ON `match_turns` (`match_id`);--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text DEFAULT '00000000-0000-0000-0000-000000000001',
	`team_id` text,
	`format` text DEFAULT 'champions-reg-m-a',
	`mode` text,
	`result` text,
	`played_at` integer,
	`notes` text,
	`my_team` text,
	`opponent_team` text,
	`my_brought` text DEFAULT '[]',
	`opponent_brought` text DEFAULT '[]',
	`my_leads` text DEFAULT '[]',
	`opponent_leads` text DEFAULT '[]',
	`rule_analysis_json` text,
	`ai_analysis_json` text,
	`analyzed_at` integer,
	`opponent_name` text,
	`archetype_self` text,
	`archetype_opponent` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `matches_user_id_idx` ON `matches` (`user_id`);--> statement-breakpoint
CREATE INDEX `matches_played_at_idx` ON `matches` (`played_at`);--> statement-breakpoint
CREATE TABLE `meta_spreads` (
	`id` text PRIMARY KEY NOT NULL,
	`species` text NOT NULL,
	`format` text DEFAULT 'champions-reg-m-a',
	`source` text,
	`nature` text NOT NULL,
	`evs` text,
	`usage_percent` real,
	`rank` integer,
	`common_moves` text,
	`common_items` text,
	`common_abilities` text,
	`common_teammates` text,
	`fetched_at` integer,
	`expires_at` integer
);
--> statement-breakpoint
CREATE INDEX `meta_spreads_species_format_idx` ON `meta_spreads` (`species`,`format`);--> statement-breakpoint
CREATE TABLE `team_pokemon` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text,
	`slot` integer,
	`species` text NOT NULL,
	`ability` text NOT NULL,
	`item` text,
	`nature` text DEFAULT 'Hardy',
	`level` integer DEFAULT 50,
	`mega_evolution` text,
	`tera_type` text,
	`moves` text DEFAULT '[]',
	`evs` text DEFAULT '{"hp":0,"atk":0,"def":0,"spa":0,"spd":0,"spe":0}',
	`ivs` text DEFAULT '{"hp":31,"atk":31,"def":31,"spa":31,"spd":31,"spe":31}',
	`created_at` integer,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `team_pokemon_team_id_idx` ON `team_pokemon` (`team_id`);--> statement-breakpoint
CREATE INDEX `team_pokemon_species_idx` ON `team_pokemon` (`species`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text DEFAULT '00000000-0000-0000-0000-000000000001',
	`name` text NOT NULL,
	`format` text DEFAULT 'champions-reg-m-a',
	`is_active` integer DEFAULT 0,
	`pokepaste` text,
	`notes` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `teams_user_id_idx` ON `teams` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`display_name` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);