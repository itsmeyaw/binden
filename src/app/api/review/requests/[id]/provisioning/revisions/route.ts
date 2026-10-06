import { z } from "zod";

import { getReviewAccess } from "@/lib/auth";
import { listManageableGroups } from "@/lib/directory";
import { getProvisioningProgress, retryProvisioning, reviseAssignment } from "@/lib/provisioning";
import { deniedResponse, failure, isUniqueViolation, json } from "@/lib/review-http";
import { parseRevisionInput } from "@/lib/review-input";

// Removes or replaces one unfinished group. Requires explicit confirmation.
export async function POST(
  request: Request,
  context: RouteContext<"/api/review/requests/[id]/provisioning/revisions">,
) {
  const access = await getReviewAccess(request.headers);
  const denied = deniedResponse(access.status);
  if (denied || access.status !== "available") return denied;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return json({ error: "Request not found." }, 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Submit the revision again." }, 400);
  }
  const parsed = parseRevisionInput(body);
  if (!parsed.data) return json({ errors: parsed.errors }, 422);

  try {
    const { groupId, replacement } = parsed.data;
    let resolved;
    if (replacement) {
      const group = (await listManageableGroups()).find((item) => item.id === replacement.id);
      if (!group) return json({ errors: { replacement: "Choose a group you can manage." } }, 422);
      resolved = { groupId: group.id, groupEmail: group.email, role: replacement.role };
    }
    try {
      if (!(await reviseAssignment(id, { groupId, replacement: resolved }, access.profile.id)))
        return json({ error: "That assignment can no longer be revised." }, 409);
    } catch (error) {
      // Replacing with a group that is already selected.
      if (isUniqueViolation(error))
        return json({ errors: { replacement: "That group is already selected." } }, 422);
      throw error;
    }
    // The replacement is attempted now, and a removal may have left nothing unfinished.
    await retryProvisioning(id);
    const progress = await getProvisioningProgress(id);
    if (!progress) return json({ error: "This signup request is no longer available." }, 409);
    return json({ progress });
  } catch (error) {
    return failure(error);
  }
}
