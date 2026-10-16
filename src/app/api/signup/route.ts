import { getDb } from "@/lib/db";
import { signupRequest } from "@/lib/schema";
import { parseSignupInput } from "@/lib/signup";
import { verifyTurnstile } from "@/lib/turnstile";

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

    try {
      // ponytail: contact email verification is deferred, so every request starts verified.
      // The token columns are still NOT NULL; they hold an unusable placeholder until it returns.
      await database()
        .insert(signupRequest)
        .values({
          ...requestData,
          status: "verified",
          verificationTokenHash: "unverified",
          verificationExpiresAt: new Date(),
        });
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === "23505") {
        return json({ error: "An active signup request already uses this contact email." }, 409);
      }
      return json({ error: "Signup is temporarily unavailable. Please try again." }, 503);
    }

    return json({ message: "Your signup request was received and is waiting for review." }, 201);
  };
}

export const POST = createSignupHandler();
