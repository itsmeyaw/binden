import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { mailMessage, signupRequest, signupRequestGroup } from "@/lib/schema";

export const reviewRequestFields = {
  id: signupRequest.id,
  givenName: signupRequest.givenName,
  familyName: signupRequest.familyName,
  contactEmail: signupRequest.contactEmail,
  phone: signupRequest.phone,
  connection: signupRequest.connection,
  workspaceEmail: signupRequest.workspaceEmail,
  status: signupRequest.status,
  rejectionReason: signupRequest.rejectionReason,
  createdAt: signupRequest.createdAt,
};

// Accepted requests stay visible so their provisioning progress can be followed.
const reviewableStatuses = [
  "verified",
  "rejection_pending_notification",
  "accepted",
  "provisioning",
  "awaiting_handover",
];

export async function listReviewableSignupRequests(database = getDb) {
  return database()
    .select(reviewRequestFields)
    .from(signupRequest)
    .where(inArray(signupRequest.status, reviewableStatuses))
    .orderBy(signupRequest.createdAt);
}

export async function getReviewableSignupRequest(id: string, database = getDb) {
  const [request] = await database()
    .select(reviewRequestFields)
    .from(signupRequest)
    .where(and(eq(signupRequest.id, id), inArray(signupRequest.status, reviewableStatuses)))
    .limit(1);
  return request;
}

export type SignupRequestCorrection = Pick<
  typeof signupRequest.$inferInsert,
  "givenName" | "familyName" | "contactEmail" | "phone" | "connection"
> & { workspaceEmail?: string | null };

export async function correctVerifiedSignupRequest(
  id: string,
  correction: SignupRequestCorrection,
  database = getDb,
) {
  const [request] = await database()
    .update(signupRequest)
    .set(correction)
    .where(and(eq(signupRequest.id, id), eq(signupRequest.status, "verified")))
    .returning(reviewRequestFields);
  return request;
}

export async function beginSignupRejection(id: string, reason: string, database = getDb) {
  const [request] = await database()
    .update(signupRequest)
    .set({
      status: "rejection_pending_notification",
      rejectionReason: reason,
      rejectedAt: new Date(),
    })
    .where(and(eq(signupRequest.id, id), eq(signupRequest.status, "verified")))
    .returning(reviewRequestFields);
  return request;
}

export function rejectionMessage(reason: string) {
  return `Your Workspace signup request was not approved. Reason: ${reason}`;
}

export async function captureRejectionNotification(id: string, database = getDb) {
  return database().transaction(async (tx) => {
    const [request] = await tx
      .update(signupRequest)
      .set({ status: "rejection_pending_notification" })
      .where(
        and(eq(signupRequest.id, id), eq(signupRequest.status, "rejection_pending_notification")),
      )
      .returning({
        id: signupRequest.id,
        contactEmail: signupRequest.contactEmail,
        rejectionReason: signupRequest.rejectionReason,
      });
    if (!request?.rejectionReason) return undefined;

    await tx.insert(mailMessage).values({
      signupRequestId: request.id,
      to: request.contactEmail,
      subject: "Your Workspace signup request",
      text: rejectionMessage(request.rejectionReason),
    });
    const [completed] = await tx
      .update(signupRequest)
      .set({ status: "rejected" })
      .where(
        and(eq(signupRequest.id, id), eq(signupRequest.status, "rejection_pending_notification")),
      )
      .returning(reviewRequestFields);
    return completed;
  });
}

function nameToken(name: string) {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

export function suggestWorkspaceEmail(givenName: string, familyName: string, domain: string) {
  const given = nameToken(givenName.trim().split(/\s+/)[0] ?? "");
  const family = nameToken(familyName);
  return given && family ? `${given}.${family}@${domain.toLowerCase()}` : "";
}

export type PlannedGroup = {
  groupId: string;
  groupEmail: string;
  role: "member" | "manager" | "owner";
};

export async function getSignupPlan(id: string, database = getDb) {
  const [request] = await database()
    .select({ workspaceEmail: signupRequest.workspaceEmail })
    .from(signupRequest)
    .where(eq(signupRequest.id, id));
  const groups = await database()
    .select({
      groupId: signupRequestGroup.groupId,
      groupEmail: signupRequestGroup.groupEmail,
      role: signupRequestGroup.role,
    })
    .from(signupRequestGroup)
    .where(eq(signupRequestGroup.signupRequestId, id));
  return { workspaceEmail: request?.workspaceEmail ?? null, groups };
}

// Throws a unique violation (23505) when another active request already plans this address.
export async function saveSignupPlan(
  id: string,
  plan: { workspaceEmail: string; groups: PlannedGroup[] },
  database = getDb,
) {
  return database().transaction(async (tx) => {
    const [request] = await tx
      .update(signupRequest)
      .set({ workspaceEmail: plan.workspaceEmail })
      .where(and(eq(signupRequest.id, id), eq(signupRequest.status, "verified")))
      .returning({ id: signupRequest.id });
    if (!request) return false;
    await tx.delete(signupRequestGroup).where(eq(signupRequestGroup.signupRequestId, id));
    if (plan.groups.length)
      await tx
        .insert(signupRequestGroup)
        .values(plan.groups.map((group) => ({ ...group, signupRequestId: id })));
    return true;
  });
}
