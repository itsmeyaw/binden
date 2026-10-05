import { and, eq, or } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { mailMessage, signupRequest } from "@/lib/schema";

export const reviewRequestFields = {
  id: signupRequest.id,
  givenName: signupRequest.givenName,
  familyName: signupRequest.familyName,
  contactEmail: signupRequest.contactEmail,
  contactEmailConfirmedByAdmin: signupRequest.contactEmailConfirmedByAdmin,
  phone: signupRequest.phone,
  connection: signupRequest.connection,
  status: signupRequest.status,
  rejectionReason: signupRequest.rejectionReason,
  createdAt: signupRequest.createdAt,
};

const reviewableStatuses = ["verified", "rejection_pending_notification"] as const;

export async function listReviewableSignupRequests(database = getDb) {
  return database()
    .select(reviewRequestFields)
    .from(signupRequest)
    .where(
      or(
        eq(signupRequest.status, reviewableStatuses[0]),
        eq(signupRequest.status, reviewableStatuses[1]),
      ),
    )
    .orderBy(signupRequest.createdAt);
}

export async function getReviewableSignupRequest(id: string, database = getDb) {
  const [request] = await database()
    .select(reviewRequestFields)
    .from(signupRequest)
    .where(
      and(
        eq(signupRequest.id, id),
        or(
          eq(signupRequest.status, reviewableStatuses[0]),
          eq(signupRequest.status, reviewableStatuses[1]),
        ),
      ),
    )
    .limit(1);
  return request;
}

export type SignupRequestCorrection = Pick<
  typeof signupRequest.$inferInsert,
  | "givenName"
  | "familyName"
  | "contactEmail"
  | "contactEmailConfirmedByAdmin"
  | "phone"
  | "connection"
>;

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
