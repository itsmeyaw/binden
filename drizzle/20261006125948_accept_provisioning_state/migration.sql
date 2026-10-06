ALTER TABLE "signup_request" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "signup_request" ADD COLUMN "approved_by_directory_id" text;--> statement-breakpoint
ALTER TABLE "signup_request" ADD COLUMN "account_create_state" text DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "signup_request" ADD COLUMN "google_user_id" text;--> statement-breakpoint
ALTER TABLE "signup_request_group" ADD COLUMN "state" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "signup_request_google_user_idx" ON "signup_request" ("google_user_id") WHERE "google_user_id" is not null;