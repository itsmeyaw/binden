import { randomUUID } from "node:crypto";

import { and, eq, lte } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { mailMessage, signupRequest } from "@/lib/schema";
import { parseSignupInput } from "@/lib/signup";
import { verifyTurnstile } from "@/lib/turnstile";
import {
  createVerificationToken,
  hashVerificationToken,
  verificationMessage,
} from "@/lib/verification";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

type SignupDependencies = {
  getDb: typeof getDb;
  verifyTurnstile: typeof verifyTurnstile;
};

export function createSignupHandler(overrides: Partial<SignupDependencies> = {}) {
  const database = overrides.getDb ?? getDb;
  const validateTurnstile = overrides.verifyTurnstile ?? verifyTurnstile;

  return async function POST(request: Request) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Submit the form again." }, 400);
    }

    const parsed = parseSignupInput(body);
    if (!parsed.data) return json({ errors: parsed.errors }, 422);
    const { turnstileToken, ...requestData } = parsed.data;
    if (!(await validateTurnstile(turnstileToken, request))) {
      return json({ errors: { turnstileToken: "Verification failed. Please try again." } }, 403);
    }
    if (process.env.MAIL_CAPTURE !== "true") {
      return json({ error: "Signup is temporarily unavailable." }, 503);
    }

    const appUrl = process.env.APP_URL;
    if (!appUrl) return json({ error: "Signup is temporarily unavailable." }, 503);

    const requestId = randomUUID();
    const messageId = randomUUID();
    const verificationToken = createVerificationToken();
    const verificationTokenHash = hashVerificationToken(verificationToken);
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    try {
      const db = database();
      await db
        .delete(signupRequest)
        .where(
          and(
            eq(signupRequest.contactEmail, requestData.contactEmail),
            eq(signupRequest.status, "pending_verification"),
            lte(signupRequest.verificationExpiresAt, new Date()),
          ),
        );
      await db.transaction(async (tx) => {
        await tx.insert(signupRequest).values({
          id: requestId,
          ...requestData,
          verificationTokenHash,
          verificationExpiresAt,
        });
        await tx.insert(mailMessage).values({
          id: messageId,
          signupRequestId: requestId,
          to: parsed.data.contactEmail,
          subject: "Verify your Workspace signup request",
          text: verificationMessage(appUrl, verificationToken),
        });
      });
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === "23505") {
        return json({ error: "An active signup request already uses this contact email." }, 409);
      }
      return json({ error: "Signup is temporarily unavailable. Please try again." }, 503);
    }

    return json(
      { message: "Your signup request was received. Check your contact email to verify it." },
      201,
    );
  };
}

export const POST = createSignupHandler();
