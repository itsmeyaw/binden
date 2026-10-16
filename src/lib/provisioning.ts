import "server-only";

import { and, eq, inArray, isNotNull, ne, notExists, sql } from "drizzle-orm";

import {
  addGroupMember,
  createWorkspaceUser,
  type Actor,
  listManageableGroups,
  type ManageableGroup,
  resetWorkspacePassword,
} from "@/lib/directory";
import { getDb } from "@/lib/db";
import { sendMailAsActor } from "@/lib/gmail";
import { signupRequest, signupRequestGroup, signupRequestRevision } from "@/lib/schema";

const provisioningStatuses = [
  "accepted",
  "provisioning",
  "awaiting_handover",
  "handover_confirmed",
];

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
// ponytail: runs inline in the accept request; an uncertain create waits for reconciliation (#11).
export async function provisionAcceptedRequest(id: string, actor: Actor) {
  const db = getDb();
  const [claimed] = await db
    .update(signupRequest)
    .set({ status: "provisioning", accountCreateState: "attempting" })
    .where(and(eq(signupRequest.id, id), eq(signupRequest.status, "accepted")))
    .returning({
      workspaceEmail: signupRequest.workspaceEmail,
      givenName: signupRequest.givenName,
      familyName: signupRequest.familyName,
    });
  if (!claimed?.workspaceEmail) return;

  let userId: string;
  try {
    userId = (
      await createWorkspaceUser(actor, {
        email: claimed.workspaceEmail,
        givenName: claimed.givenName,
        familyName: claimed.familyName,
      })
    ).id;
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

  await addUnfinishedMemberships(id, userId);
  await completeIfAllAdded(id);
  await sendHandoverBestEffort(id, actor);
}

// Touches only `pending` and `failed` groups, so successful memberships are never re-sent.
// ponytail: overlapping retries can both try one unfinished group; the real Directory call (#11)
// must treat "already a member" as success.
async function addUnfinishedMemberships(id: string, userId: string) {
  const db = getDb();
  const groups = await db
    .select()
    .from(signupRequestGroup)
    .where(
      and(
        eq(signupRequestGroup.signupRequestId, id),
        inArray(signupRequestGroup.state, ["pending", "failed"]),
      ),
    );
  for (const group of groups) {
    let state = "added";
    try {
      await addGroupMember(group.groupId, userId, group.role);
    } catch {
      state = "failed";
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
}

// One conditional statement: handover is reached only when no selected membership is unfinished,
// even if a revision or another retry runs at the same time.
async function completeIfAllAdded(id: string) {
  await getDb()
    .update(signupRequest)
    .set({ status: "awaiting_handover" })
    .where(
      and(
        eq(signupRequest.id, id),
        eq(signupRequest.status, "provisioning"),
        eq(signupRequest.accountCreateState, "created"),
        notExists(
          getDb()
            .select({ one: sql`1` })
            .from(signupRequestGroup)
            .where(
              and(
                eq(signupRequestGroup.signupRequestId, id),
                ne(signupRequestGroup.state, "added"),
              ),
            ),
        ),
      ),
    );
}

// Retries only unfinished memberships. An unknown account outcome is never repeated here.
export async function retryProvisioning(
  id: string,
  actor: Actor,
): Promise<"retried" | "uncertain" | "unavailable"> {
  const [request] = await getDb()
    .select({
      status: signupRequest.status,
      state: signupRequest.accountCreateState,
      googleUserId: signupRequest.googleUserId,
    })
    .from(signupRequest)
    .where(eq(signupRequest.id, id));
  if (request?.status !== "provisioning") return "unavailable";
  if (request.state !== "created" || !request.googleUserId) return "uncertain";
  await addUnfinishedMemberships(id, request.googleUserId);
  await completeIfAllAdded(id);
  await sendHandoverBestEffort(id, actor);
  return "retried";
}

export type AssignmentRevision = {
  groupId: string;
  replacement?: { groupId: string; groupEmail: string; role: "member" | "manager" | "owner" };
};

// Removes or replaces one unfinished assignment and records why. Successful memberships are
// never touched. Returns false when the request or assignment is not revisable.
export async function reviseAssignment(
  id: string,
  revision: AssignmentRevision,
  adminDirectoryId: string,
) {
  return getDb().transaction(async (tx) => {
    const [request] = await tx
      .select({ status: signupRequest.status })
      .from(signupRequest)
      .where(eq(signupRequest.id, id))
      .for("update");
    if (request?.status !== "provisioning") return false;
    const [removed] = await tx
      .delete(signupRequestGroup)
      .where(
        and(
          eq(signupRequestGroup.signupRequestId, id),
          eq(signupRequestGroup.groupId, revision.groupId),
          ne(signupRequestGroup.state, "added"),
        ),
      )
      .returning();
    if (!removed) return false;
    const { replacement } = revision;
    if (replacement)
      await tx.insert(signupRequestGroup).values({ ...replacement, signupRequestId: id });
    await tx.insert(signupRequestRevision).values({
      signupRequestId: id,
      removedGroupId: removed.groupId,
      removedGroupEmail: removed.groupEmail,
      replacementGroupId: replacement?.groupId,
      replacementGroupEmail: replacement?.groupEmail,
      replacementRole: replacement?.role,
      revisedByDirectoryId: adminDirectoryId,
    });
    return true;
  });
}

// A failed reset or mail leaves the request awaiting handover, so an administrator can send again.
// ponytail: no retry queue; the administrator resends from the request page.
async function sendHandoverBestEffort(id: string, actor: Actor) {
  try {
    await sendHandover(id, actor);
  } catch {
    // The outcome is visible as awaiting_handover.
  }
}

// Resets the account to a fresh temporary password and mails it to the applicant as the acting
// administrator. Needs provisioning complete and every selected membership added. A throw rolls
// back, so the request stays awaiting_handover and can be sent again. The password is never stored
// or logged, and it is absent from mail_message (the reviewer notice carries no credentials).
// ponytail: the row lock is held across the two Google calls so concurrent sends cannot mail two
// different passwords; fine at this scale.
export async function sendHandover(
  id: string,
  actor: Actor,
): Promise<"sent" | "already" | "blocked" | "unavailable"> {
  const db = getDb();
  const sent = await db.transaction(async (tx) => {
    const [request] = await tx
      .select({
        givenName: signupRequest.givenName,
        contactEmail: signupRequest.contactEmail,
        workspaceEmail: signupRequest.workspaceEmail,
        googleUserId: signupRequest.googleUserId,
      })
      .from(signupRequest)
      .where(
        and(
          eq(signupRequest.id, id),
          eq(signupRequest.status, "awaiting_handover"),
          eq(signupRequest.accountCreateState, "created"),
          notExists(
            tx
              .select({ one: sql`1` })
              .from(signupRequestGroup)
              .where(
                and(
                  eq(signupRequestGroup.signupRequestId, id),
                  ne(signupRequestGroup.state, "added"),
                ),
              ),
          ),
        ),
      )
      .for("update");
    if (!request?.googleUserId || !request.workspaceEmail) return false;
    const password = await resetWorkspacePassword(actor, request.googleUserId);
    await sendMailAsActor(actor, {
      to: request.contactEmail,
      subject: "Your Workspace account is ready",
      text: [
        `Hello ${request.givenName},`,
        "",
        "Your Workspace account is ready. Use these details to sign in:",
        "",
        `Workspace email: ${request.workspaceEmail}`,
        `Temporary password: ${password}`,
        "",
        "Sign in at https://accounts.google.com with your Workspace email and the temporary password. Google will require you to choose a new password at your first sign-in.",
        "",
        "This temporary password stops working if a new one is sent to you.",
      ].join("\n"),
    });
    await tx
      .update(signupRequest)
      .set({
        status: "handover_confirmed",
        handoverConfirmedAt: new Date(),
        handoverConfirmedByDirectoryId: actor.profile.id,
      })
      .where(eq(signupRequest.id, id));
    return true;
  });
  if (sent) return "sent";
  const [request] = await db
    .select({ status: signupRequest.status })
    .from(signupRequest)
    .where(eq(signupRequest.id, id));
  if (request?.status === "handover_confirmed") return "already";
  return request && provisioningStatuses.includes(request.status) ? "blocked" : "unavailable";
}

// Undefined until the request has been accepted.
export async function getProvisioningProgress(id: string, actor: Actor) {
  const db = getDb();
  const [request] = await db
    .select({
      status: signupRequest.status,
      workspaceEmail: signupRequest.workspaceEmail,
      acceptedAt: signupRequest.acceptedAt,
      handoverConfirmedAt: signupRequest.handoverConfirmedAt,
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
  // Unfinished groups the acting administrator can no longer manage; null when the Directory is unreachable.
  let choices: ManageableGroup[] | null = null;
  if (groups.some((group) => group.state !== "added")) {
    try {
      choices = await listManageableGroups(actor);
    } catch {
      // Progress stays readable without the Directory.
    }
  }
  const manageable = choices && new Set(choices.map((group) => group.id));
  const selected = new Set(groups.map((group) => group.groupId));
  return {
    ...request,
    // Replacement options for an unfinished assignment: manageable and not already selected.
    choices: choices?.filter((group) => !selected.has(group.id)) ?? [],
    groups: groups.map((group) => ({
      ...group,
      manageable: manageable?.has(group.groupId) ?? null,
    })),
  };
}
