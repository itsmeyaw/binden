import { z } from "zod";

import { getReviewAccess } from "@/lib/auth";
import { getProvisioningProgress, retryProvisioning } from "@/lib/provisioning";
import { deniedResponse, failure, json } from "@/lib/review-http";

// Retries only the unfinished memberships of an already created account.
export async function POST(
  request: Request,
  context: RouteContext<"/api/review/requests/[id]/provisioning">,
) {
  const access = await getReviewAccess(request.headers);
  const denied = deniedResponse(access.status);
  if (denied || access.status !== "available") return denied;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return json({ error: "Request not found." }, 404);

  try {
    const outcome = await retryProvisioning(id);
    if (outcome === "unavailable")
      return json({ error: "This signup request has nothing to retry." }, 409);
    if (outcome === "uncertain")
      return json({ error: "The account creation outcome must be reconciled first." }, 409);
    const progress = await getProvisioningProgress(id);
    if (!progress) return json({ error: "This signup request is no longer available." }, 409);
    return json({ progress });
  } catch (error) {
    return failure(error);
  }
}
