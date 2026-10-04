export type SignupInput = {
  givenName: string;
  familyName: string;
  contactEmail: string;
  phone: string | null;
  connection: string | null;
  turnstileToken: string;
};

export type SignupErrors = Partial<Record<keyof SignupInput, string>>;

function optionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length <= maxLength ? trimmed || null : undefined;
}

export function parseSignupInput(value: unknown):
  | { data: SignupInput; errors: undefined }
  | { data: undefined; errors: SignupErrors } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { data: undefined, errors: { givenName: "Enter your given name." } };
  }

  const input = value as Record<string, unknown>;
  const givenName = typeof input.givenName === "string" ? input.givenName.trim() : "";
  const familyName = typeof input.familyName === "string" ? input.familyName.trim() : "";
  const contactEmail = typeof input.contactEmail === "string" ? input.contactEmail.trim().toLowerCase() : "";
  const phone = optionalText(input.phone, 50);
  const connection = optionalText(input.connection, 1000);
  const turnstileToken = typeof input.turnstileToken === "string" ? input.turnstileToken : "";
  const errors: SignupErrors = {};

  if (!givenName || givenName.length > 100) errors.givenName = "Enter your given name.";
  if (!familyName || familyName.length > 100) errors.familyName = "Enter your family name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) || contactEmail.length > 254)
    errors.contactEmail = "Enter a valid contact email.";
  if (phone === undefined) errors.phone = "Enter a phone number of 50 characters or fewer.";
  if (connection === undefined)
    errors.connection = "Keep your connection explanation to 1,000 characters or fewer.";
  if (!turnstileToken || turnstileToken.length > 2048)
    errors.turnstileToken = "Complete the verification challenge.";

  if (Object.keys(errors).length) return { data: undefined, errors };
  return {
    data: {
      givenName,
      familyName,
      contactEmail,
      phone: phone ?? null,
      connection: connection ?? null,
      turnstileToken,
    },
    errors: undefined,
  };
}
