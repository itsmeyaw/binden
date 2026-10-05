import { z } from "zod";

const optionalText = (maxLength: number, message: string) =>
  z
    .string()
    .trim()
    .max(maxLength, message)
    .optional()
    .transform((value) => value || null);

const correctionSchema = z.object({
  givenName: z.string().trim().min(1, "Enter the given name.").max(100, "Enter the given name."),
  familyName: z.string().trim().min(1, "Enter the family name.").max(100, "Enter the family name."),
  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Enter a valid contact email.")
    .email("Enter a valid contact email."),
  contactEmailConfirmedByAdmin: z.boolean(),
  phone: optionalText(50, "Enter a phone number of 50 characters or fewer."),
  connection: optionalText(1000, "Keep the connection explanation to 1,000 characters or fewer."),
});

const rejectionSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Enter a reason for the applicant.")
    .max(1000, "Keep the rejection reason to 1,000 characters or fewer."),
});

type Errors = Partial<Record<keyof z.output<typeof correctionSchema> | "reason", string>>;

function parse<T extends z.ZodType>(
  schema: T,
  value: unknown,
): { data: z.output<T>; errors: undefined } | { data: undefined; errors: Errors } {
  const result = schema.safeParse(value);
  if (result.success) return { data: result.data, errors: undefined };
  const errors: Errors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !errors[field as keyof Errors])
      errors[field as keyof Errors] = issue.message;
  }
  return { data: undefined, errors };
}

export function parseReviewCorrectionInput(value: unknown) {
  return parse(correctionSchema, value);
}

export function parseRejectionInput(value: unknown) {
  return parse(rejectionSchema, value);
}
