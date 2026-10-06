import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const user = pgTable("auth_user", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const session = pgTable(
  "auth_session",
  {
    id: text().primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text().notNull().unique(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_idx").on(table.userId)],
);

export const account = pgTable(
  "auth_account",
  {
    id: text().primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text(),
    password: text(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    index("account_user_idx").on(table.userId),
    uniqueIndex("account_provider_subject_idx").on(table.providerId, table.accountId),
  ],
);

export const verification = pgTable(
  "auth_verification",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [uniqueIndex("verification_identifier_idx").on(table.identifier)],
);

// Immutable Google and Directory identifiers, not a profile or local role copy.
export const workspaceIdentity = pgTable("workspace_identity", {
  googleSubject: text("google_subject").primaryKey(),
  directoryId: text("directory_id").notNull().unique(),
});

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
    rejectionReason: text("rejection_reason"),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    workspaceEmail: text("workspace_email"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    // Directory id of the acting administrator who accepted the request.
    approvedByDirectoryId: text("approved_by_directory_id"),
    // not_started -> attempting -> created | uncertain. `attempting` left behind is uncertain too.
    accountCreateState: text("account_create_state").notNull().default("not_started"),
    googleUserId: text("google_user_id"),
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
    uniqueIndex("active_signup_request_workspace_email_idx")
      .on(sql`lower(${table.workspaceEmail})`)
      .where(
        sql`${table.workspaceEmail} is not null and ${table.status} in ('verified', 'under_review', 'accepted', 'provisioning', 'awaiting_handover')`,
      ),
    uniqueIndex("signup_request_google_user_idx")
      .on(table.googleUserId)
      .where(sql`${table.googleUserId} is not null`),
  ],
);

// Selected groups are stored by immutable Google group id so provisioning can resume.
export const signupRequestGroup = pgTable(
  "signup_request_group",
  {
    signupRequestId: uuid("signup_request_id")
      .notNull()
      .references(() => signupRequest.id, { onDelete: "cascade" }),
    groupId: text("group_id").notNull(),
    groupEmail: text("group_email").notNull(),
    role: text().notNull().default("member"),
    // pending -> added | failed
    state: text().notNull().default("pending"),
  },
  (table) => [primaryKey({ columns: [table.signupRequestId, table.groupId] })],
);

// Recorded, confirmed removal or replacement of an unfinished group assignment.
export const signupRequestRevision = pgTable("signup_request_revision", {
  id: uuid().defaultRandom().primaryKey(),
  signupRequestId: uuid("signup_request_id")
    .notNull()
    .references(() => signupRequest.id, { onDelete: "cascade" }),
  removedGroupId: text("removed_group_id").notNull(),
  removedGroupEmail: text("removed_group_email").notNull(),
  replacementGroupId: text("replacement_group_id"),
  replacementGroupEmail: text("replacement_group_email"),
  replacementRole: text("replacement_role"),
  revisedByDirectoryId: text("revised_by_directory_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
