import { createHash, randomBytes } from "node:crypto";

import { z } from "zod";

const resendSchema = z.object({
  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Enter a valid contact email.")
    .email("Enter a valid contact email."),
  turnstileToken: z
    .string()
    .min(1, "Complete the verification challenge.")
    .max(2048, "Complete the verification challenge."),
});

export type ResendInput = z.output<typeof resendSchema>;
export type ResendErrors = Partial<Record<keyof ResendInput, string>>;

export function parseResendInput(
  value: unknown,
): { data: ResendInput; errors: undefined } | { data: undefined; errors: ResendErrors } {
  const result = resendSchema.safeParse(value);
  if (result.success) return { data: result.data, errors: undefined };

  const errors: ResendErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (
      typeof field === "string" &&
      field in resendSchema.shape &&
      !errors[field as keyof ResendInput]
    ) {
      errors[field as keyof ResendInput] = issue.message;
    }
  }
  return { data: undefined, errors };
}

export function hashVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createVerificationToken() {
  return randomBytes(32).toString("base64url");
}

export function verificationMessage(appUrl: string, token: string) {
  const verificationUrl = new URL(`/verify?token=${token}`, appUrl).toString();
  return `Verify your contact email within 24 hours: ${verificationUrl}`;
}
