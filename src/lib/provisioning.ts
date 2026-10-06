import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";

import { addGroupMember, createWorkspaceUser } from "@/lib/directory";
import { getDb } from "@/lib/db";
import { signupRequest, signupRequestGroup } from "@/lib/schema";

const provisioningStatuses = ["accepted", "provisioning", "awaiting_handover"];

// The decision is one conditional update, so repeated or concurrent accepts yield one winner.
export async function acceptSignupRequest(id: string, approverDirectoryId: string) {
  const [accepted] = await getDb()
    .update(signupRequest)
    .set({ status: "accepted", acceptedAt: new Date(), approvedByDirectoryId: approverDirectoryId })
    .where(
      and(
        eq(signupRequest.id, id),
        eq(signupRequest.status, "verified"),
        isNotNull(signupRequest.workspaceEmail),
      ),
    )
    .returning({ id: signupRequest.id });
  return Boolean(accepted);
}

// Only the caller that moves accepted -> provisioning creates the account, and `attempting`
// is persisted in that same statement, so an interrupted create is never silently repeated.
// ponytail: runs inline in the accept request; #8 adds recovery of uncertain/partial runs.
export async function provisionAcceptedRequest(id: string) {
  const db = getDb();
  const [claimed] = await db
    .update(signupRequest)
    .set({ status: "provisioning", accountCreateState: "attempting" })
    .where(and(eq(signupRequest.id, id), eq(signupRequest.status, "accepted")))
    .returning({ workspaceEmail: signupRequest.workspaceEmail });
  if (!claimed?.workspaceEmail) return;

  let userId: string;
  try {
    userId = (await createWorkspaceUser(claimed.workspaceEmail)).id;
  } catch {
    // Any failure may have reached Google: keep it for reconciliation, do not repeat it.
    await db
      .update(signupRequest)
      .set({ accountCreateState: "uncertain" })
      .where(eq(signupRequest.id, id));
    return;
  }
  await db
    .update(signupRequest)
    .set({ accountCreateState: "created", googleUserId: userId })
    .where(eq(signupRequest.id, id));

  const groups = await db
    .select()
    .from(signupRequestGroup)
    .where(eq(signupRequestGroup.signupRequestId, id));
  let complete = true;
  for (const group of groups) {
    let state = "added";
    try {
      await addGroupMember(group.groupId, userId, group.role);
    } catch {
      state = "failed";
      complete = false;
    }
    await db
      .update(signupRequestGroup)
      .set({ state })
      .where(
        and(
          eq(signupRequestGroup.signupRequestId, id),
          eq(signupRequestGroup.groupId, group.groupId),
        ),
      );
  }
  if (complete)
    await db
      .update(signupRequest)
      .set({ status: "awaiting_handover" })
      .where(and(eq(signupRequest.id, id), eq(signupRequest.status, "provisioning")));
}

// Undefined until the request has been accepted.
export async function getProvisioningProgress(id: string) {
  const db = getDb();
  const [request] = await db
    .select({
      status: signupRequest.status,
      workspaceEmail: signupRequest.workspaceEmail,
      acceptedAt: signupRequest.acceptedAt,
      accountCreateState: signupRequest.accountCreateState,
    })
    .from(signupRequest)
    .where(eq(signupRequest.id, id));
  if (!request || !provisioningStatuses.includes(request.status)) return undefined;
  const groups = await db
    .select({
      groupId: signupRequestGroup.groupId,
      groupEmail: signupRequestGroup.groupEmail,
      role: signupRequestGroup.role,
      state: signupRequestGroup.state,
    })
    .from(signupRequestGroup)
    .where(eq(signupRequestGroup.signupRequestId, id));
  return { ...request, groups };
}
