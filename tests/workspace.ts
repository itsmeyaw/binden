import assert from "node:assert/strict";

import { sendMailAsActor } from "../src/lib/gmail";
import { hasReviewerRole, readWorkspaceProfile, WorkspaceUnavailable } from "../src/lib/workspace";
import { actor, fakeDirectory } from "./fake-directory";

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

async function testMailAsActor() {
  const env = process.env as Record<string, string | undefined>;
  const simulation = env.GOOGLE_SIMULATION;
  delete env.GOOGLE_SIMULATION;
  const directory = fakeDirectory();
  try {
    await sendMailAsActor(actor, {
      to: "ada@example.org",
      subject: "Welcome — Ada",
      text: "Hello\nWorld ".repeat(20),
    });
    assert.equal(directory.messages.length, 1);
    const [head, body] = directory.messages[0].split("\r\n\r\n");
    assert.ok(head.startsWith("To: ada@example.org\r\n"));
    assert.ok(
      head.includes(`Subject: =?UTF-8?B?${Buffer.from("Welcome — Ada").toString("base64")}?=`),
    );
    assert.ok(head.includes("MIME-Version: 1.0\r\n"));
    assert.ok(head.includes("Content-Type: text/plain; charset=UTF-8\r\n"));
    assert.ok(head.includes("Content-Transfer-Encoding: base64"));
    assert.ok(body.split("\r\n").every((line) => line.length <= 76));
    assert.equal(
      Buffer.from(body.replaceAll("\r\n", ""), "base64").toString("utf8"),
      "Hello\nWorld ".repeat(20),
    );

    // Header injection is refused before anything is sent.
    for (const [to, subject] of [
      ["ada@example.org\r\nBcc: x@example.org", "Hi"],
      ["ada@example.org", "Hi\nBcc: x@example.org"],
    ])
      await assert.rejects(
        sendMailAsActor(actor, { to, subject, text: "x" }),
        /Mail header rejected/,
      );
    assert.equal(directory.messages.length, 1);

    // Simulation sends nothing.
    env.GOOGLE_SIMULATION = "true";
    await sendMailAsActor(actor, { to: "ada@example.org", subject: "Hi", text: "x" });
    assert.equal(directory.messages.length, 1);
  } finally {
    directory.restore();
    if (simulation === undefined) delete env.GOOGLE_SIMULATION;
    else env.GOOGLE_SIMULATION = simulation;
  }

  const failing = fakeDirectory({ mailStatus: 503 });
  try {
    await assert.rejects(
      sendMailAsActor(actor, { to: "ada@example.org", subject: "Hi", text: "x" }),
      (error: unknown) => error instanceof WorkspaceUnavailable && error.reconnect === false,
    );
  } finally {
    failing.restore();
  }
}

testWorkspaceFailures()
  .then(testReviewerRoleLookup)
  .then(testMailAsActor)
  .catch((error: unknown) => {
    throw error;
  });
