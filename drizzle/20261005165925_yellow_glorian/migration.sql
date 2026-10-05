ALTER TABLE "signup_request" ADD COLUMN "contact_email_confirmed_by_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "signup_request" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "signup_request" ADD COLUMN "rejected_at" timestamp with time zone;