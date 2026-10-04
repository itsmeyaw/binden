import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const signupRequest = pgTable(
  "signup_request",
  {
    id: uuid().defaultRandom().primaryKey(),
    givenName: text("given_name").notNull(),
    familyName: text("family_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    phone: text(),
    connection: text(),
    status: text().notNull().default("pending_verification"),
    verificationTokenHash: text("verification_token_hash").notNull(),
    verificationExpiresAt: timestamp("verification_expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("active_signup_request_contact_email_idx")
      .on(sql`lower(${table.contactEmail})`)
      .where(
        sql`${table.status} in ('pending_verification', 'verified', 'under_review', 'accepted', 'provisioning', 'awaiting_handover')`,
      ),
  ],
);

export const mailMessage = pgTable("mail_message", {
  id: uuid().defaultRandom().primaryKey(),
  signupRequestId: uuid("signup_request_id")
    .notNull()
    .references(() => signupRequest.id, { onDelete: "cascade" }),
  to: text().notNull(),
  subject: text().notNull(),
  text: text().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
