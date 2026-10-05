import { z } from "zod";

import { getReviewAccess } from "@/lib/auth";
import { beginSignupRejection, captureRejectionNotification } from "@/lib/review";
import { parseRejectionInput } from "@/lib/review-input";

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

export async function POST(
  request: Request,
  context: RouteContext<"/api/review/requests/[id]/rejection">,
) {
  const access = await getReviewAccess(request.headers);
  const denied = deniedResponse(access.status);
  if (denied) return denied;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return json({ error: "Request not found." }, 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Submit the rejection again." }, 400);
  }

  const isRetry =
    typeof body === "object" && body !== null && "retry" in body && body.retry === true;
  if (!isRetry) {
    const parsed = parseRejectionInput(body);
    if (!parsed.data) return json({ errors: parsed.errors }, 422);
    try {
      if (!(await beginSignupRejection(id, parsed.data.reason)))
        return json({ error: "This signup request is no longer available." }, 409);
    } catch {
      return json({ outcome: "unavailable" }, 503);
    }
  }

  try {
    if (!(await captureRejectionNotification(id)))
      return json({ error: "This rejection notification is no longer pending." }, 409);
    return json({ outcome: "rejected" });
  } catch {
    return json({ outcome: "rejection-notification-pending" }, 503);
  }
}
