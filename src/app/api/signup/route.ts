import { createHash, randomBytes, randomUUID } from "node:crypto";

import { getDb } from "@/lib/db";
import { mailMessage, signupRequest } from "@/lib/schema";
import { parseSignupInput } from "@/lib/signup";
import { verifyTurnstile } from "@/lib/turnstile";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Submit the form again." }, 400);
  }

  const parsed = parseSignupInput(body);
  if (!parsed.data) return json({ errors: parsed.errors }, 422);
  const { turnstileToken, ...requestData } = parsed.data;
  if (!(await verifyTurnstile(turnstileToken, request)))
    return json({ errors: { turnstileToken: "Verification failed. Please try again." } }, 403);
  if (process.env.NODE_ENV === "production" || process.env.MAIL_CAPTURE !== "true")
    return json({ error: "Signup is temporarily unavailable." }, 503);

  const appUrl = process.env.APP_URL;
  if (!appUrl) return json({ error: "Signup is temporarily unavailable." }, 503);

  const requestId = randomUUID();
  const messageId = randomUUID();
  const verificationToken = randomBytes(32).toString("base64url");
  const verificationTokenHash = createHash("sha256").update(verificationToken).digest("hex");
  const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const verificationUrl = new URL(`/verify?token=${verificationToken}`, appUrl).toString();

  try {
    const db = getDb();
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
        text: `Verify your contact email within 24 hours: ${verificationUrl}`,
      });
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505")
      return json({ error: "An active signup request already uses this contact email." }, 409);
    return json({ error: "Signup is temporarily unavailable. Please try again." }, 503);
  }

  return json(
    { message: "Your signup request was received. Check your contact email to verify it." },
    201,
  );
}
