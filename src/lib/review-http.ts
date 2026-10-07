import type { getReviewAccess } from "@/lib/auth";
import { type Actor, isWorkspaceEmailAvailable } from "@/lib/directory";
import { suggestWorkspaceEmail } from "@/lib/review";
import { WorkspaceUnavailable } from "@/lib/workspace";

export const workspaceEmailCollision =
  "That Workspace email is already in use. Choose a different address.";

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function deniedResponse(status: Awaited<ReturnType<typeof getReviewAccess>>["status"]) {
  switch (status) {
    case "signed-out":
    case "reconnect":
      return json({ outcome: status }, 401);
    case "denied":
      return json({ outcome: status }, 403);
    case "unavailable":
      return json({ outcome: status }, 503);
    default:
      return undefined;
  }
}

// Maps a failed Google/Directory call to its reconnect or unavailable outcome.
export function failure(error: unknown) {
  if (error instanceof WorkspaceUnavailable)
    return json(
      { outcome: error.reconnect ? "reconnect" : "unavailable" },
      error.reconnect ? 401 : 503,
    );
  return json({ outcome: "unavailable" }, 503);
}

// Drizzle wraps driver errors, so the Postgres code may be on `cause`.
export function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || !error) return false;
  if ("code" in error && error.code === "23505") return true;
  return "cause" in error && isUniqueViolation(error.cause);
}

// Adds the address to show in the review fields (saved, else suggested) and whether it clashes.
// `workspaceEmailTaken` is null when the Directory cannot answer.
export async function withWorkspaceEmail<
  T extends { givenName: string; familyName: string; workspaceEmail: string | null },
>(actor: Actor, signup: T) {
  const domain = process.env.GOOGLE_WORKSPACE_DOMAIN;
  const proposed =
    signup.workspaceEmail ??
    (domain ? suggestWorkspaceEmail(signup.givenName, signup.familyName, domain) : "");
  let taken: boolean | null = null;
  if (proposed) {
    try {
      taken = !(await isWorkspaceEmailAvailable(actor, proposed));
    } catch {
      // Unknown clash state; saving still re-checks.
    }
  }
  return {
    ...signup,
    workspaceEmail: proposed,
    workspaceEmailSaved: signup.workspaceEmail !== null,
    workspaceEmailTaken: taken,
    workspaceDomain: domain?.toLowerCase() ?? null,
  };
}
