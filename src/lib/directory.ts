import "server-only";

import { WorkspaceUnavailable } from "@/lib/workspace";

export type ManageableGroup = { id: string; email: string; name: string };

// ponytail: development-only simulation. #11 replaces this with Directory calls made with the
// acting administrator's token; without GOOGLE_SIMULATION the Directory is reported unavailable.
function simulatedDomain() {
  const domain = process.env.GOOGLE_WORKSPACE_DOMAIN;
  if (process.env.GOOGLE_SIMULATION !== "true" || process.env.NODE_ENV === "production" || !domain)
    throw new WorkspaceUnavailable();
  return domain;
}

const takenLocalParts = ["taken.user", "ada.lovelace"];

export async function isWorkspaceEmailAvailable(email: string) {
  const domain = simulatedDomain();
  return !takenLocalParts.some((local) => `${local}@${domain}` === email.toLowerCase());
}

export async function listManageableGroups(): Promise<ManageableGroup[]> {
  const domain = simulatedDomain();
  return [
    { id: "sim-events", email: `events@${domain}`, name: "Events team" },
    { id: "sim-volunteers", email: `volunteers@${domain}`, name: "Volunteers" },
    { id: "sim-board", email: `board@${domain}`, name: "Board" },
    // Manageable, but adding members always fails: exercises partial provisioning.
    { id: "sim-flaky", email: `flaky@${domain}`, name: "Flaky group" },
    // Fails on the first add per user, then works: exercises retrying unfinished memberships.
    { id: "sim-recovering", email: `recovering@${domain}`, name: "Recovering group" },
  ];
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
