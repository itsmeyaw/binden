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
  ];
}
