import assert from "node:assert/strict";

import { isWorkspaceEmailAvailable, listManageableGroups } from "../src/lib/directory";
import { saveSignupPlan, suggestWorkspaceEmail } from "../src/lib/review";
import { parsePlanInput, parseReviewCorrectionInput } from "../src/lib/review-input";
import { getDb } from "../src/lib/db";
import { WorkspaceUnavailable } from "../src/lib/workspace";

assert.equal(
  suggestWorkspaceEmail(" José ", "O'Brien-Smith", "Example.ORG"),
  "jose.obrien-smith@example.org",
);
assert.equal(
  suggestWorkspaceEmail("Yudhistira Arief", "Wibuwu", "example.org"),
  "yudhistira.wibuwu@example.org",
);
assert.equal(suggestWorkspaceEmail("李", "Ada", "example.org"), "");

const email = "ada.new@example.org";
assert.deepEqual(
  parsePlanInput({ workspaceEmail: ` ${email.toUpperCase()} ` }, "example.org").data,
  {
    workspaceEmail: email,
    groups: [],
  },
);
assert.equal(
  parsePlanInput({ workspaceEmail: "ada@other.org" }, "example.org").errors?.workspaceEmail,
  "Use an address at example.org.",
);
assert.equal(
  parsePlanInput(
    { workspaceEmail: email, groups: [{ id: "g", role: "owner" }, { id: "g" }] },
    "example.org",
  ).errors?.groups,
  "Select each group only once.",
);
assert.equal(
  parsePlanInput({ workspaceEmail: email, groups: [{ id: "g" }] }, "example.org").data?.groups[0]
    .role,
  "member",
);
assert.ok(
  parsePlanInput({ workspaceEmail: email, groups: [{ id: "g", role: "admin" }] }, "example.org")
    .errors?.groups,
);

const details = {
  givenName: "Ada",
  familyName: "Lovelace",
  contactEmail: "ada@example.com",
  contactEmailConfirmedByAdmin: false,
};
const planned = (workspaceEmail?: string) =>
  parseReviewCorrectionInput({ ...details, workspaceEmail }, "example.org");
assert.equal(planned().data?.workspaceEmail, undefined);
assert.equal(planned("  ").data?.workspaceEmail, null);
assert.equal(planned(" ADA.New@Example.org ").data?.workspaceEmail, email);
assert.equal(planned("ada@other.org").errors?.workspaceEmail, "Use an address at example.org.");

async function testDirectory() {
  const env = process.env as Record<string, string | undefined>;
  const saved = { ...env };
  try {
    env.GOOGLE_WORKSPACE_DOMAIN = "example.org";
    delete env.GOOGLE_SIMULATION;
    await assert.rejects(listManageableGroups(), WorkspaceUnavailable);
    env.GOOGLE_SIMULATION = "true";
    env.NODE_ENV = "production";
    await assert.rejects(isWorkspaceEmailAvailable(email), WorkspaceUnavailable);
    env.NODE_ENV = "test";
    assert.equal(await isWorkspaceEmailAvailable("Taken.User@example.org"), false);
    assert.equal(await isWorkspaceEmailAvailable(email), true);
    assert.ok(
      (await listManageableGroups()).every((group) => group.email.endsWith("@example.org")),
    );
  } finally {
    env.GOOGLE_SIMULATION = saved.GOOGLE_SIMULATION;
    env.NODE_ENV = saved.NODE_ENV;
    env.GOOGLE_WORKSPACE_DOMAIN = saved.GOOGLE_WORKSPACE_DOMAIN;
  }
}

async function testSave() {
  const writes: string[] = [];
  let verified = true;
  const tx = {
    update: () => ({
      set: () => ({ where: () => ({ returning: async () => (verified ? [{ id: "r" }] : []) }) }),
    }),
    delete: () => ({ where: async () => writes.push("delete") }),
    insert: () => ({ values: async (rows: unknown[]) => writes.push(`insert ${rows.length}`) }),
  };
  const database = {
    transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(tx),
  } as unknown as ReturnType<typeof getDb>;
  const group = { groupId: "g", groupEmail: "g@example.org", role: "manager" as const };

  assert.equal(
    await saveSignupPlan("r", { workspaceEmail: email, groups: [group] }, () => database),
    true,
  );
  assert.deepEqual(writes, ["delete", "insert 1"]);
  writes.length = 0;
  await saveSignupPlan("r", { workspaceEmail: email, groups: [] }, () => database);
  assert.deepEqual(writes, ["delete"]);
  verified = false;
  assert.equal(
    await saveSignupPlan("r", { workspaceEmail: email, groups: [group] }, () => database),
    false,
  );
}

testDirectory()
  .then(testSave)
  .catch((error: unknown) => {
    throw error;
  });
