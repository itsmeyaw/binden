import { z } from "zod";

import { getReviewAccess } from "@/lib/auth";
import {
  isWorkspaceEmailAvailable,
  listManageableGroups,
  type ManageableGroup,
} from "@/lib/directory";
import {
  getReviewableSignupRequest,
  getSignupPlan,
  saveSignupPlan,
  suggestWorkspaceEmail,
} from "@/lib/review";
import { deniedResponse, isUniqueViolation, json } from "@/lib/review-http";
import { parsePlanInput } from "@/lib/review-input";
import { WorkspaceUnavailable } from "@/lib/workspace";

const collision = "That Workspace email is already in use. Choose a different address.";

async function planResponse(
  signup: { givenName: string; familyName: string },
  id: string,
  domain: string,
  groups: ManageableGroup[],
) {
  const plan = await getSignupPlan(id);
  const workspaceEmail =
    plan.workspaceEmail ?? suggestWorkspaceEmail(signup.givenName, signup.familyName, domain);
  const manageable = new Set(groups.map((group) => group.id));
  return {
    workspaceEmail,
    saved: plan.workspaceEmail !== null,
    unavailable: workspaceEmail !== "" && !(await isWorkspaceEmailAvailable(workspaceEmail)),
    groups,
    selected: plan.groups.map((group) => ({ ...group, manageable: manageable.has(group.groupId) })),
  };
}

function failure(error: unknown) {
  if (error instanceof WorkspaceUnavailable)
    return json(
      { outcome: error.reconnect ? "reconnect" : "unavailable" },
      error.reconnect ? 401 : 503,
    );
  return json({ outcome: "unavailable" }, 503);
}

async function load(request: Request, context: RouteContext<"/api/review/requests/[id]/plan">) {
  const access = await getReviewAccess(request.headers);
  const denied = deniedResponse(access.status);
  if (denied) return denied;
  const { id } = await context.params;
  const domain = process.env.GOOGLE_WORKSPACE_DOMAIN;
  if (!z.uuid().safeParse(id).success) return json({ error: "Request not found." }, 404);
  if (!domain) return json({ outcome: "unavailable" }, 503);
  const signup = await getReviewableSignupRequest(id);
  if (!signup) return json({ error: "Request not found." }, 404);
  if (signup.status !== "verified")
    return json({ error: "This signup request is no longer available." }, 409);
  return { id, domain, signup };
}

export async function GET(
  request: Request,
  context: RouteContext<"/api/review/requests/[id]/plan">,
) {
  try {
    const loaded = await load(request, context);
    if (loaded instanceof Response) return loaded;
    const { id, domain, signup } = loaded;
    return json(await planResponse(signup, id, domain, await listManageableGroups()));
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(
  request: Request,
  context: RouteContext<"/api/review/requests/[id]/plan">,
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Submit the plan again." }, 400);
  }
  try {
    const loaded = await load(request, context);
    if (loaded instanceof Response) return loaded;
    const { id, domain, signup } = loaded;
    const parsed = parsePlanInput(body, domain);
    if (!parsed.data) return json({ errors: parsed.errors }, 422);

    const choices = await listManageableGroups();
    const byId = new Map(choices.map((group) => [group.id, group]));
    const groups = parsed.data.groups.map((group) => ({
      group: byId.get(group.id),
      role: group.role,
    }));
    if (groups.some(({ group }) => !group))
      return json({ errors: { groups: "Choose only groups you can manage." } }, 422);
    // Directory is checked on every save, so a stale earlier answer is never trusted.
    if (!(await isWorkspaceEmailAvailable(parsed.data.workspaceEmail)))
      return json({ errors: { workspaceEmail: collision } }, 409);

    let saved: boolean;
    try {
      saved = await saveSignupPlan(id, {
        workspaceEmail: parsed.data.workspaceEmail,
        groups: groups.map(({ group, role }) => ({
          groupId: group!.id,
          groupEmail: group!.email,
          role,
        })),
      });
    } catch (error) {
      if (isUniqueViolation(error)) return json({ errors: { workspaceEmail: collision } }, 409);
      throw error;
    }
    if (!saved) return json({ error: "This signup request is no longer available." }, 409);
    return json(await planResponse(signup, id, domain, choices));
  } catch (error) {
    return failure(error);
  }
}
