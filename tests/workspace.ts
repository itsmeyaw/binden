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

testWorkspaceFailures().catch((error: unknown) => {
  throw error;
});
