import { z } from "zod";

import { getReviewAccess } from "@/lib/auth";
import { isWorkspaceEmailAvailable, listManageableGroups } from "@/lib/directory";
import {
  acceptSignupRequest,
  getProvisioningProgress,
  provisionAcceptedRequest,
} from "@/lib/provisioning";
import { getReviewableSignupRequest, getSignupPlan } from "@/lib/review";
import {
  deniedResponse,
  failure,
  json,
  workspaceEmailCollision as collision,
} from "@/lib/review-http";

export async function POST(
  request: Request,
  context: RouteContext<"/api/review/requests/[id]/acceptance">,
) {
  const access = await getReviewAccess(request.headers);
  const denied = deniedResponse(access.status);
  if (denied || access.status !== "available") return denied;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return json({ error: "Request not found." }, 404);

  try {
    // A repeated accept skips validation (its own address is "taken" by now) and just reports.
    if (!(await getProvisioningProgress(id))) {
      const signup = await getReviewableSignupRequest(id);
      if (!signup) return json({ error: "Request not found." }, 404);
      if (signup.status !== "verified")
        return json({ error: "This signup request is no longer available." }, 409);
      if (!signup.workspaceEmail)
        return json(
          { errors: { workspaceEmail: "Save a Workspace email before accepting." } },
          422,
        );

      // Directory answers are re-checked now; saved plans may be stale.
      const plan = await getSignupPlan(id);
      const manageable = new Set((await listManageableGroups()).map((group) => group.id));
      if (plan.groups.some((group) => !manageable.has(group.groupId)))
        return json(
          { errors: { groups: "Remove groups you can no longer manage before accepting." } },
          422,
        );
      if (!(await isWorkspaceEmailAvailable(signup.workspaceEmail)))
        return json({ errors: { workspaceEmail: collision } }, 409);

      // Losing a race is fine: the winner's outcome is reported below.
      await acceptSignupRequest(id, access.profile.id);
    }
    // No-op unless the request is still `accepted`, so a crash between the steps self-heals.
    await provisionAcceptedRequest(id);
    const progress = await getProvisioningProgress(id);
    if (!progress) return json({ error: "This signup request is no longer available." }, 409);
    return json({ progress });
  } catch (error) {
    return failure(error);
  }
}
