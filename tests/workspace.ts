import assert from "node:assert/strict";

import { hasReviewerRole, readWorkspaceProfile, WorkspaceUnavailable } from "../src/lib/workspace";

async function testWorkspaceFailures() {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const logs: unknown[][] = [];
  console.error = (...args: unknown[]) => logs.push(args);

  try {
    for (const status of [401, 403, 503]) {
      globalThis.fetch = async () =>
        Response.json(
          { error: { message: "private detail", errors: [{ reason: "insufficientPermissions" }] } },
          { status },
        );
      await assert.rejects(
        readWorkspaceProfile("secret-token", "subject", true),
        (error: unknown) =>
          error instanceof WorkspaceUnavailable && error.reconnect === (status === 401),
      );
      if (status === 403) {
        assert.equal(await hasReviewerRole("secret-token", "private-directory-id", "role"), false);
      } else {
        await assert.rejects(
          hasReviewerRole("secret-token", "private-directory-id", "role"),
          (error: unknown) =>
            error instanceof WorkspaceUnavailable && error.reconnect === (status === 401),
        );
      }
    }
    assert.equal(logs.length, 6);
    assert.deepEqual(logs[0][1], {
      endpoint: "/v1/userinfo",
      status: 401,
      reasons: ["insufficientPermissions"],
    });
    assert.doesNotMatch(JSON.stringify(logs), /secret-token|private detail|private-directory-id/);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
}

async function testReviewerRoleLookup() {
  const originalFetch = globalThis.fetch;
  const roleId = "9007199254740993";
  const pages = [
    { nextPageToken: "second" },
    { items: [{ roleId: "9007199254740992" }], nextPageToken: "third" },
    { items: [{ roleId }] },
  ];
  const pageTokens: Array<string | null> = [];
  try {
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.searchParams.has("roleId"), false);
      assert.equal(url.searchParams.get("userKey"), "directory-id");
      assert.equal(url.searchParams.get("includeIndirectRoleAssignments"), "true");
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-token");
      pageTokens.push(url.searchParams.get("pageToken"));
      return Response.json(pages[pageTokens.length - 1]);
    };
    assert.equal(await hasReviewerRole("test-token", "directory-id", roleId), true);
    assert.deepEqual(pageTokens, [null, "second", "third"]);

    globalThis.fetch = async () => Response.json({ items: [{ roleId: "9007199254740992" }] });
    assert.equal(await hasReviewerRole("test-token", "directory-id", roleId), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

testWorkspaceFailures()
  .then(testReviewerRoleLookup)
  .catch((error: unknown) => {
    throw error;
  });
