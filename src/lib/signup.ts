import { z } from "zod";

const optionalText = (maxLength: number, message: string) =>
  z
    .string()
    .trim()
    .max(maxLength, message)
    .optional()
    .transform((value) => value || null);

const signupSchema = z.object({
  givenName: z.string().trim().min(1, "Enter your given name.").max(100, "Enter your given name."),
  familyName: z
    .string()
    .trim()
    .min(1, "Enter your family name.")
    .max(100, "Enter your family name."),
  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Enter a valid contact email.")
    .email("Enter a valid contact email."),
  phone: optionalText(50, "Enter a phone number of 50 characters or fewer."),
  connection: optionalText(1000, "Keep your connection explanation to 1,000 characters or fewer."),
  turnstileToken: z
    .string()
    .min(1, "Complete the verification challenge.")
    .max(2048, "Complete the verification challenge."),
});

export type SignupInput = z.output<typeof signupSchema>;
export type SignupErrors = Partial<Record<keyof SignupInput, string>>;

export function parseSignupInput(
  value: unknown,
): { data: SignupInput; errors: undefined } | { data: undefined; errors: SignupErrors } {
  const result = signupSchema.safeParse(value);
  if (result.success) return { data: result.data, errors: undefined };

  const errors: SignupErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (
      typeof field === "string" &&
      field in signupSchema.shape &&
      !errors[field as keyof SignupInput]
    ) {
      errors[field as keyof SignupInput] = issue.message;
    }
  }
  return { data: undefined, errors };
}
