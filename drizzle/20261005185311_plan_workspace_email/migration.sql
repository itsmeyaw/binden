CREATE TABLE "signup_request_group" (
	"signup_request_id" uuid,
	"group_id" text,
	"group_email" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	CONSTRAINT "signup_request_group_pkey" PRIMARY KEY("signup_request_id","group_id")
);
--> statement-breakpoint
ALTER TABLE "signup_request" ADD COLUMN "workspace_email" text;--> statement-breakpoint
CREATE UNIQUE INDEX "active_signup_request_workspace_email_idx" ON "signup_request" (lower("workspace_email")) WHERE "workspace_email" is not null and "status" in ('verified', 'under_review', 'accepted', 'provisioning', 'awaiting_handover');--> statement-breakpoint
ALTER TABLE "signup_request_group" ADD CONSTRAINT "signup_request_group_signup_request_id_signup_request_id_fkey" FOREIGN KEY ("signup_request_id") REFERENCES "signup_request"("id") ON DELETE CASCADE;