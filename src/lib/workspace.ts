import "server-only";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { workspaceIdentity } from "@/lib/schema";

const identitySchema = z.object({
  sub: z.string().min(1).max(255),
  hd: z.string().min(1),
  email: z.email(),
  email_verified: z.literal(true),
});

const profileSchema = z.object({
  id: z.string().min(1),
  primaryEmail: z.email(),
  name: z.object({ fullName: z.string() }).optional(),
});

const roleAssignmentsSchema = z.object({
  items: z.array(z.object({ roleId: z.string() })).optional(),
  nextPageToken: z.string().optional(),
});

export class WorkspaceUnavailable extends Error {
  constructor(public readonly reconnect = false) {
    super(reconnect ? "Reconnect your Google account" : "Workspace unavailable");
  }
}

export function validateIdentity(input: unknown) {
  const identity = identitySchema.parse(input);
  if (!process.env.GOOGLE_WORKSPACE_DOMAIN || identity.hd !== process.env.GOOGLE_WORKSPACE_DOMAIN)
    throw new WorkspaceUnavailable(true);
  return identity;
}

async function googleGet(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    await logGoogleFailure(url, response);
    throw new WorkspaceUnavailable(response.status === 401);
  }
  return response.json();
}

async function logGoogleFailure(url: string | URL, response: Response) {
  const parsed = z
    .object({
      error: z.object({
        errors: z
          .array(
            z.object({
              reason: z
                .string()
                .regex(/^[\w.]+$/)
                .max(100),
            }),
          )
          .optional(),
      }),
    })
    .safeParse(await response.json().catch(() => null));
  console.error("[workspace] Google API rejected request", {
    endpoint: new URL(url).pathname.replace(/\/users\/[^/]+/, "/users/{userKey}"),
    status: response.status,
    reasons: parsed.success ? parsed.data.error.errors?.map(({ reason }) => reason) : undefined,
  });
}

export async function readWorkspaceProfile(
  accessToken: string,
  subject: string,
  allowInitialBinding = false,
) {
  const identity = validateIdentity(
    await googleGet("https://openidconnect.googleapis.com/v1/userinfo", accessToken),
  );
  if (identity.sub !== subject) throw new WorkspaceUnavailable(true);

  const [binding] = await db
    .select()
    .from(workspaceIdentity)
    .where(eq(workspaceIdentity.googleSubject, subject));
  if (!binding && !allowInitialBinding) throw new WorkspaceUnavailable(true);

  const url = new URL(
    `https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(binding?.directoryId ?? identity.email)}`,
  );
  url.searchParams.set("viewType", "domain_public");
  url.searchParams.set("fields", "id,primaryEmail,name(fullName)");
  const profile = profileSchema.parse(await googleGet(url.toString(), accessToken));
  if (
    profile.primaryEmail.toLowerCase() !== identity.email.toLowerCase() ||
    (binding && profile.id !== binding.directoryId)
  )
    throw new WorkspaceUnavailable(true);

  if (!binding) {
    await db
      .insert(workspaceIdentity)
      .values({ googleSubject: subject, directoryId: profile.id })
      .onConflictDoNothing();
    const [saved] = await db
      .select()
      .from(workspaceIdentity)
      .where(eq(workspaceIdentity.googleSubject, subject));
    if (saved?.directoryId !== profile.id) throw new WorkspaceUnavailable(true);
  }
  return profile;
}

export async function hasReviewerRole(accessToken: string, directoryId: string, roleId: string) {
  const url = new URL(
    "https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roleassignments",
  );
  url.searchParams.set("userKey", directoryId);
  url.searchParams.set("roleId", roleId);
  url.searchParams.set("includeIndirectRoleAssignments", "true");
  let pageToken: string | undefined;
  do {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      await logGoogleFailure(url, response);
      if (response.status === 403) return false;
      throw new WorkspaceUnavailable(response.status === 401);
    }
    const assignments = roleAssignmentsSchema.parse(await response.json());
    if (assignments.items?.some((item) => item.roleId === roleId)) return true;
    pageToken = assignments.nextPageToken;
    if (pageToken) url.searchParams.set("pageToken", pageToken);
  } while (pageToken);
  return false;
}
