import { z } from "zod";

import { getReviewAccess } from "@/lib/auth";
import { isWorkspaceEmailAvailable } from "@/lib/directory";
import {
  deniedResponse,
  isUniqueViolation,
  json,
  withWorkspaceEmail,
  workspaceEmailCollision as collision,
} from "@/lib/review-http";
import { correctVerifiedSignupRequest, getReviewableSignupRequest } from "@/lib/review";
import { parseReviewCorrectionInput } from "@/lib/review-input";

export async function GET(request: Request, context: RouteContext<"/api/review/requests/[id]">) {
  const access = await getReviewAccess(request.headers);
  const denied = deniedResponse(access.status);
  if (denied) return denied;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return json({ error: "Request not found." }, 404);
  try {
    const signup = await getReviewableSignupRequest(id);
    if (!signup) return json({ error: "Request not found." }, 404);
    return json({ request: await withWorkspaceEmail(signup) });
  } catch {
    return json({ outcome: "unavailable" }, 503);
  }
}

export async function PATCH(request: Request, context: RouteContext<"/api/review/requests/[id]">) {
  const access = await getReviewAccess(request.headers);
  const denied = deniedResponse(access.status);
  if (denied) return denied;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return json({ error: "Request not found." }, 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Submit the correction again." }, 400);
  }
  const parsed = parseReviewCorrectionInput(body, process.env.GOOGLE_WORKSPACE_DOMAIN);
  if (!parsed.data) return json({ errors: parsed.errors }, 422);

  try {
    const current = await getReviewableSignupRequest(id);
    if (!current || current.status !== "verified")
      return json({ error: "This signup request is no longer available." }, 409);
    if (
      current.contactEmail !== parsed.data.contactEmail &&
      !parsed.data.contactEmailConfirmedByAdmin
    ) {
      return json(
        { errors: { contactEmail: "Confirm the replacement contact email before saving it." } },
        422,
      );
    }
    const { workspaceEmail } = parsed.data;
    // A clash is checked on every change, so a stale earlier answer is never trusted.
    if (workspaceEmail && workspaceEmail !== current.workspaceEmail) {
      if (!(await isWorkspaceEmailAvailable(workspaceEmail)))
        return json({ errors: { workspaceEmail: collision } }, 409);
    }
    const signup = await correctVerifiedSignupRequest(id, parsed.data);
    if (!signup) return json({ error: "This signup request is no longer available." }, 409);
    return json({ request: await withWorkspaceEmail(signup) });
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Either active-request unique index may have fired.
      const constraint = (error as { cause?: { constraint?: string } }).cause?.constraint;
      return json(
        {
          errors:
            constraint === "active_signup_request_workspace_email_idx"
              ? { workspaceEmail: collision }
              : { contactEmail: "An active signup request already uses this contact email." },
        },
        409,
      );
    }
    return json({ outcome: "unavailable" }, 503);
  }
}
