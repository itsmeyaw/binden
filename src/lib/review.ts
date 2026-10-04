import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { signupRequest } from "@/lib/schema";

export const reviewRequestFields = {
  id: signupRequest.id,
  givenName: signupRequest.givenName,
  familyName: signupRequest.familyName,
  contactEmail: signupRequest.contactEmail,
  phone: signupRequest.phone,
  connection: signupRequest.connection,
  createdAt: signupRequest.createdAt,
};

export async function listVerifiedSignupRequests(database = getDb) {
  return database()
    .select(reviewRequestFields)
    .from(signupRequest)
    .where(eq(signupRequest.status, "verified"))
    .orderBy(signupRequest.createdAt);
}

export async function getVerifiedSignupRequest(id: string, database = getDb) {
  const [request] = await database()
    .select(reviewRequestFields)
    .from(signupRequest)
    .where(and(eq(signupRequest.id, id), eq(signupRequest.status, "verified")))
    .limit(1);
  return request;
}
