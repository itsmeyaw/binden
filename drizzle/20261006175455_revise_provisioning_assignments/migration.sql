CREATE TABLE "signup_request_revision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"signup_request_id" uuid NOT NULL,
	"removed_group_id" text NOT NULL,
	"removed_group_email" text NOT NULL,
	"replacement_group_id" text,
	"replacement_group_email" text,
	"replacement_role" text,
	"revised_by_directory_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "signup_request_revision" ADD CONSTRAINT "signup_request_revision_P9SjsEplZNMM_fkey" FOREIGN KEY ("signup_request_id") REFERENCES "signup_request"("id") ON DELETE CASCADE;