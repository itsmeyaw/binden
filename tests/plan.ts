import assert from "node:assert/strict";

import { isWorkspaceEmailAvailable, listManageableGroups } from "../src/lib/directory";
import { saveSignupPlan, suggestWorkspaceEmail } from "../src/lib/review";
import { parsePlanInput, parseReviewCorrectionInput } from "../src/lib/review-input";
import { getDb } from "../src/lib/db";
import { WorkspaceUnavailable } from "../src/lib/workspace";
import { actor, fakeDirectory } from "./fake-directory";

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
};
const planned = (workspaceEmail?: string) =>
  parseReviewCorrectionInput({ ...details, workspaceEmail }, "example.org");
assert.equal(planned().data?.workspaceEmail, undefined);
assert.equal(planned("  ").data?.workspaceEmail, null);
assert.equal(planned(" ADA.New@Example.org ").data?.workspaceEmail, email);
assert.equal(planned("ada@other.org").errors?.workspaceEmail, "Use an address at example.org.");

async function testDirectory() {
  const groupAt = (i: number) => ({ id: `g${i}`, email: `g${i}@example.org`, name: `Group ${i}` });
  const many = [5, 3, 1, 4, 2].map(groupAt);
  const inDirectory = async <T>(
    options: Parameters<typeof fakeDirectory>[0],
    run: () => Promise<T>,
  ) => {
    const directory = fakeDirectory(options);
    try {
      return await run();
    } finally {
      directory.restore();
    }
  };

  // Address collisions: users, aliases and groups all count; a missing resource is available.
  await inDirectory({ groups: many }, async () => {
    assert.equal(await isWorkspaceEmailAvailable(actor, "Taken.User@example.org"), false);
    assert.equal(await isWorkspaceEmailAvailable(actor, "g3@example.org"), false);
    assert.equal(await isWorkspaceEmailAvailable(actor, email), true);
  });

  // A super admin can write every group, across pages, in a stable order.
  const listed = await inDirectory({ groups: many }, () => listManageableGroups(actor));
  assert.deepEqual(
    listed.map((group) => group.id),
    ["g1", "g2", "g3", "g4", "g5"],
  );

  // Writes are gated by role privileges: GROUPS_ALL via any assigned role allows, otherwise none.
  const roles = (privileges: object) => ({
    "role-1": { rolePrivileges: [{ privilegeName: "USERS_ALL" }] },
    "role-2": privileges,
  });
  assert.equal(
    (
      await inDirectory(
        { groups: many, roles: roles({ rolePrivileges: [{ privilegeName: "GROUPS_ALL" }] }) },
        () => listManageableGroups(actor),
      )
    ).length,
    5,
  );
  assert.deepEqual(
    await inDirectory({ groups: many, roles: roles({ rolePrivileges: [] }) }, () =>
      listManageableGroups(actor),
    ),
    [],
  );
  assert.deepEqual(
    await inDirectory({ groups: many, roles: {}, assignments: [] }, () =>
      listManageableGroups(actor),
    ),
    [],
  );

  // Denied calls are reported (reconnect only for rejected credentials) and never retried.
  const original = console.error;
  console.error = () => {};
  try {
    for (const status of [401, 403, 503]) {
      const directory = fakeDirectory({ status });
      try {
        for (const call of [
          () => isWorkspaceEmailAvailable(actor, email),
          () => listManageableGroups(actor),
        ]) {
          await assert.rejects(
            call(),
            (error: unknown) =>
              error instanceof WorkspaceUnavailable && error.reconnect === (status === 401),
          );
        }
        assert.equal(directory.calls.length, 2);
      } finally {
        directory.restore();
      }
    }
  } finally {
    console.error = original;
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
