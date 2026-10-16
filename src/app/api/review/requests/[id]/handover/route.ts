import { z } from "zod";

import { getReviewAccess } from "@/lib/auth";
import { getProvisioningProgress, sendHandover } from "@/lib/provisioning";
import { deniedResponse, failure, json } from "@/lib/review-http";

// Sends the first-login email for a request still awaiting it, e.g. after a failed send on accept.
export async function POST(
  request: Request,
  context: RouteContext<"/api/review/requests/[id]/handover">,
) {
  const access = await getReviewAccess(request.headers);
  const denied = deniedResponse(access.status);
  if (denied || access.status !== "available") return denied;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return json({ error: "Request not found." }, 404);

  try {
    const outcome = await sendHandover(id, access);
    if (outcome === "unavailable")
      return json({ error: "This signup request is no longer available." }, 409);
    if (outcome === "blocked")
      return json(
        {
          error: "The first-login email can be sent once every selected membership has succeeded.",
        },
        409,
      );
    const progress = await getProvisioningProgress(id, access);
    if (!progress) return json({ error: "This signup request is no longer available." }, 409);
    return json({ progress });
  } catch (error) {
    return failure(error);
  }
}
