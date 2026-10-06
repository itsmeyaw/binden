import { z } from "zod";

import { getReviewAccess } from "@/lib/auth";
import { deniedResponse, json } from "@/lib/review-http";
import { sendReviewerNotification } from "@/lib/review";

// Retries the reviewer notification of a verified request that is still waiting for review.
export async function POST(
  request: Request,
  context: RouteContext<"/api/review/requests/[id]/notification">,
) {
  const access = await getReviewAccess(request.headers);
  const denied = deniedResponse(access.status);
  if (denied) return denied;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return json({ error: "Request not found." }, 404);

  const outcome = await sendReviewerNotification(id);
  if (outcome === "skipped") return json({ error: "This notification is no longer pending." }, 409);
  if (outcome === "failed") return json({ outcome: "notification-failed" }, 503);
  return json({ outcome: "sent" });
}
