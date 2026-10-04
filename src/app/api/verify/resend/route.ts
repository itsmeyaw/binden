import { and, eq, gt } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { mailMessage, signupRequest } from "@/lib/schema";
import { verifyTurnstile } from "@/lib/turnstile";
import {
  createVerificationToken,
  hashVerificationToken,
  parseResendInput,
  verificationMessage,
} from "@/lib/verification";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

type ResendDependencies = {
  getDb: typeof getDb;
  verifyTurnstile: typeof verifyTurnstile;
};

export function createResendHandler(overrides: Partial<ResendDependencies> = {}) {
  const database = overrides.getDb ?? getDb;
  const validateTurnstile = overrides.verifyTurnstile ?? verifyTurnstile;

  return async function POST(request: Request) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Submit the form again." }, 400);
    }

    const parsed = parseResendInput(body);
    if (!parsed.data) return json({ errors: parsed.errors }, 422);
    if (!(await validateTurnstile(parsed.data.turnstileToken, request, "resend"))) {
      return json({ errors: { turnstileToken: "Verification failed. Please try again." } }, 403);
    }
    if (process.env.MAIL_CAPTURE !== "true" || !process.env.APP_URL) {
      return json({ error: "Verification email is temporarily unavailable." }, 503);
    }

    const verificationToken = createVerificationToken();
    try {
      await database().transaction(async (tx) => {
        const [signup] = await tx
          .update(signupRequest)
          .set({ verificationTokenHash: hashVerificationToken(verificationToken) })
          .where(
            and(
              eq(signupRequest.contactEmail, parsed.data.contactEmail),
              eq(signupRequest.status, "pending_verification"),
              gt(signupRequest.verificationExpiresAt, new Date()),
            ),
          )
          .returning({ id: signupRequest.id, contactEmail: signupRequest.contactEmail });
        if (!signup) return;

        await tx.insert(mailMessage).values({
          signupRequestId: signup.id,
          to: signup.contactEmail,
          subject: "Verify your Workspace signup request",
          text: verificationMessage(process.env.APP_URL!, verificationToken),
        });
      });
    } catch {
      return json(
        { error: "Verification email is temporarily unavailable. Please try again." },
        503,
      );
    }

    return json({ message: "If an eligible request exists, we sent a verification email." });
  };
}

export const POST = createResendHandler();
