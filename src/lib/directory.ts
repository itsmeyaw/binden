import "server-only";

import { z } from "zod";

import { googleGet, WorkspaceUnavailable } from "@/lib/workspace";

export type ManageableGroup = { id: string; email: string; name: string };

// The acting administrator whose OAuth grant makes every Directory call. There is no fallback
// credential: a denied call is reported, never retried with anything stronger.
export type Actor = { accessToken: string; profile: { id: string } };

const directory = "https://admin.googleapis.com/admin/directory/v1";

const assignmentsSchema = z.object({
  items: z.array(z.object({ roleId: z.string() })).optional(),
  nextPageToken: z.string().optional(),
});
const roleSchema = z.object({
  isSuperAdminRole: z.boolean().optional(),
  rolePrivileges: z.array(z.object({ privilegeName: z.string() })).optional(),
});
const groupsSchema = z.object({
  groups: z.array(z.object({ id: z.string(), email: z.string(), name: z.string() })).optional(),
  nextPageToken: z.string().optional(),
});

async function* pages<T extends { nextPageToken?: string }>(
  url: URL,
  accessToken: string,
  schema: z.ZodType<T>,
) {
  let pageToken: string | undefined;
  do {
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const page = schema.parse(await googleGet(url, accessToken));
    yield page;
    pageToken = page.nextPageToken;
  } while (pageToken);
}

// An address is taken by any user or group (aliases resolve to their owner).
export async function isWorkspaceEmailAvailable(actor: Actor, email: string) {
  const key = encodeURIComponent(email.toLowerCase());
  for (const kind of ["users", "groups"]) {
    if (await googleGet(`${directory}/${kind}/${key}?fields=id`, actor.accessToken, true))
      return false;
  }
  return true;
}

// Google has no "can I write this group" probe, and group writes are gated by admin role
// privileges across the customer, not per group. So the administrator either can write every
// group (super admin, or a held role with GROUPS_ALL) or none.
// ponytail: narrower Groups privileges (e.g. Groups Editor) count as "none"; widen if needed.
async function canWriteGroups({ accessToken, profile }: Actor) {
  const url = new URL(`${directory}/customer/my_customer/roleassignments`);
  url.searchParams.set("userKey", profile.id);
  url.searchParams.set("includeIndirectRoleAssignments", "true");
  const roleIds = new Set<string>();
  for await (const page of pages(url, accessToken, assignmentsSchema))
    for (const item of page.items ?? []) roleIds.add(item.roleId);
  for (const roleId of roleIds) {
    const role = roleSchema.parse(
      await googleGet(
        `${directory}/customer/my_customer/roles/${encodeURIComponent(roleId)}`,
        accessToken,
      ),
    );
    if (role.isSuperAdminRole || role.rolePrivileges?.some((p) => p.privilegeName === "GROUPS_ALL"))
      return true;
  }
  return false;
}

export async function listManageableGroups(actor: Actor): Promise<ManageableGroup[]> {
  if (!(await canWriteGroups(actor))) return [];
  const url = new URL(`${directory}/groups`);
  url.searchParams.set("customer", "my_customer");
  url.searchParams.set("maxResults", "200");
  url.searchParams.set("fields", "nextPageToken,groups(id,email,name)");
  const groups: ManageableGroup[] = [];
  for await (const page of pages(url, actor.accessToken, groupsSchema))
    groups.push(...(page.groups ?? []));
  return groups.sort((a, b) => a.name.localeCompare(b.name));
}

// ponytail: development-only simulation of provisioning writes until #12 replaces them;
// without GOOGLE_SIMULATION they report the Workspace unavailable.
function simulatedDomain() {
  const domain = process.env.GOOGLE_WORKSPACE_DOMAIN;
  if (process.env.GOOGLE_SIMULATION !== "true" || process.env.NODE_ENV === "production" || !domain)
    throw new WorkspaceUnavailable();
  return domain;
}

// The create call may have reached Google even though no answer came back.
export class AccountCreateUncertain extends Error {
  constructor() {
    super("Account creation outcome unknown");
  }
}

// `uncertain.user*` simulates a timeout after the request was sent.
export async function createWorkspaceUser(email: string): Promise<{ id: string }> {
  simulatedDomain();
  if (email.toLowerCase().startsWith("uncertain.user")) throw new AccountCreateUncertain();
  return { id: `sim-user-${email.toLowerCase()}` };
}

const attempted = new Set<string>();

// `sim-gone` is not listed as manageable (deleted or no longer manageable) and always fails.
export async function addGroupMember(groupId: string, userId: string, _role: string) {
  simulatedDomain();
  if (groupId === "sim-flaky" || groupId === "sim-gone")
    throw new Error("Group membership rejected");
  if (groupId === "sim-recovering" && !attempted.has(`${userId}:${groupId}`)) {
    attempted.add(`${userId}:${groupId}`);
    throw new Error("Group membership rejected");
  }
}
