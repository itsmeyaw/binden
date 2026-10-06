import { z } from "zod";

const optionalText = (maxLength: number, message: string) =>
  z
    .string()
    .trim()
    .max(maxLength, message)
    .optional()
    .transform((value) => value || null);

const workspaceEmailSchema = (domain: string) =>
  z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Enter a valid Workspace email.")
    .email("Enter a valid Workspace email.")
    .refine((email) => email.endsWith(`@${domain.toLowerCase()}`), `Use an address at ${domain}.`);

const correctionSchema = (domain?: string) =>
  z.object({
    givenName: z.string().trim().min(1, "Enter the given name.").max(100, "Enter the given name."),
    familyName: z
      .string()
      .trim()
      .min(1, "Enter the family name.")
      .max(100, "Enter the family name."),
    contactEmail: z
      .string()
      .trim()
      .toLowerCase()
      .max(254, "Enter a valid contact email.")
      .email("Enter a valid contact email."),
    phone: optionalText(50, "Enter a phone number of 50 characters or fewer."),
    connection: optionalText(1000, "Keep the connection explanation to 1,000 characters or fewer."),
    // Omitted leaves the planned address alone; blank clears it.
    workspaceEmail: z.preprocess(
      (value) => (typeof value === "string" && !value.trim() ? null : value),
      workspaceEmailSchema(domain ?? "")
        .nullable()
        .optional(),
    ),
  });

const rejectionSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Enter a reason for the applicant.")
    .max(1000, "Keep the rejection reason to 1,000 characters or fewer."),
});

export const groupRoles = ["member", "manager", "owner"] as const;

const planSchema = (domain: string) =>
  z.object({
    workspaceEmail: workspaceEmailSchema(domain),
    groups: z
      .array(
        z.object({
          id: z.string().min(1).max(255),
          role: z.enum(groupRoles).default("member"),
        }),
      )
      .max(100, "Select 100 groups or fewer.")
      .refine((groups) => new Set(groups.map((group) => group.id)).size === groups.length, {
        message: "Select each group only once.",
      })
      .default([]),
  });

const revisionSchema = z.object({
  groupId: z.string().min(1).max(255),
  replacement: z
    .object({ id: z.string().min(1).max(255), role: z.enum(groupRoles).default("member") })
    .optional(),
  confirmed: z.literal(true, "Confirm the revision."),
});

type Errors = Partial<Record<string, string>>;

function parse<T extends z.ZodType>(
  schema: T,
  value: unknown,
): { data: z.output<T>; errors: undefined } | { data: undefined; errors: Errors } {
  const result = schema.safeParse(value);
  if (result.success) return { data: result.data, errors: undefined };
  const errors: Errors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !errors[field]) errors[field] = issue.message;
  }
  return { data: undefined, errors };
}

export function parseReviewCorrectionInput(value: unknown, domain?: string) {
  return parse(correctionSchema(domain), value);
}

export function parseRejectionInput(value: unknown) {
  return parse(rejectionSchema, value);
}

export function parsePlanInput(value: unknown, domain: string) {
  return parse(planSchema(domain), value);
}

export function parseRevisionInput(value: unknown) {
  return parse(revisionSchema, value);
}
