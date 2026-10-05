import { z } from "zod";

import { getReviewAccess } from "@/lib/auth";
import { correctVerifiedSignupRequest, getVerifiedSignupRequest } from "@/lib/review";
import { parseReviewCorrectionInput } from "@/lib/review-input";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function deniedResponse(status: Awaited<ReturnType<typeof getReviewAccess>>["status"]) {
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

export async function GET(request: Request, context: RouteContext<"/api/review/requests/[id]">) {
  const access = await getReviewAccess(request.headers);
  const denied = deniedResponse(access.status);
  if (denied) return denied;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return json({ error: "Request not found." }, 404);
  try {
    const signup = await getVerifiedSignupRequest(id);
    if (!signup) return json({ error: "Request not found." }, 404);
    return json({ request: signup });
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
  const parsed = parseReviewCorrectionInput(body);
  if (!parsed.data) return json({ errors: parsed.errors }, 422);

  try {
    const current = await getVerifiedSignupRequest(id);
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
    const signup = await correctVerifiedSignupRequest(id, parsed.data);
    if (!signup) return json({ error: "This signup request is no longer available." }, 409);
    return json({ request: signup });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      return json(
        { errors: { contactEmail: "An active signup request already uses this contact email." } },
        409,
      );
    }
    return json({ outcome: "unavailable" }, 503);
  }
}
