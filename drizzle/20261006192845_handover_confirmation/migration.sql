ALTER TABLE "signup_request" ADD COLUMN "reviewer_notification_state" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "signup_request" ADD COLUMN "handover_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "signup_request" ADD COLUMN "handover_confirmed_by_directory_id" text;