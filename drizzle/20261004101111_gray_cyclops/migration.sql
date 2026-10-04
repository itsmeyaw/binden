CREATE TABLE "mail_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"signup_request_id" uuid NOT NULL,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signup_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"given_name" text NOT NULL,
	"family_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"phone" text,
	"connection" text,
	"status" text DEFAULT 'pending_verification' NOT NULL,
	"verification_token_hash" text NOT NULL,
	"verification_expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "active_signup_request_contact_email_idx" ON "signup_request" (lower("contact_email")) WHERE "status" in ('pending_verification', 'verified', 'under_review', 'accepted', 'provisioning', 'awaiting_handover');--> statement-breakpoint
ALTER TABLE "mail_message" ADD CONSTRAINT "mail_message_signup_request_id_signup_request_id_fkey" FOREIGN KEY ("signup_request_id") REFERENCES "signup_request"("id") ON DELETE CASCADE;