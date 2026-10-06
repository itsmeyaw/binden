import { and, eq, gt } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { sendReviewerNotification } from "@/lib/review";
import { signupRequest } from "@/lib/schema";
import { hashVerificationToken } from "@/lib/verification";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

type VerificationDependencies = { getDb: typeof getDb };

export function createVerificationHandler(overrides: Partial<VerificationDependencies> = {}) {
  const database = overrides.getDb ?? getDb;

  return async function GET(request: Request) {
    const token = new URL(request.url).searchParams.get("token");
    if (!token || token.length > 256) return json({ outcome: "invalid" });

    const tokenHash = hashVerificationToken(token);
    try {
      const db = database();
      const [verified] = await db
        .update(signupRequest)
        .set({ status: "verified" })
        .where(
          and(
            eq(signupRequest.verificationTokenHash, tokenHash),
            eq(signupRequest.status, "pending_verification"),
            gt(signupRequest.verificationExpiresAt, new Date()),
          ),
        )
        .returning({ id: signupRequest.id });
      if (verified) {
        // Never fails verification: an unsent notice stays retryable from the review queue.
        await sendReviewerNotification(verified.id, database);
        return json({ outcome: "verified" });
      }

      const [existing] = await db
        .select({
          status: signupRequest.status,
          verificationExpiresAt: signupRequest.verificationExpiresAt,
        })
        .from(signupRequest)
        .where(eq(signupRequest.verificationTokenHash, tokenHash))
        .limit(1);
      if (!existing) return json({ outcome: "invalid" });
      if (existing.status !== "pending_verification") return json({ outcome: "used" });
      if (
        existing.status === "pending_verification" &&
        existing.verificationExpiresAt <= new Date()
      ) {
        return json({ outcome: "expired" });
      }
      return json({ outcome: "invalid" });
    } catch {
      return json({ error: "Verification is temporarily unavailable. Please try again." }, 503);
    }
  };
}

export const GET = createVerificationHandler();
