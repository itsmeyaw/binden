import assert from "node:assert/strict";

import { createSignupHandler } from "../src/app/api/signup/route";
import { getDb } from "../src/lib/db";
import { parseSignupInput } from "../src/lib/signup";
import { verifyTurnstile } from "../src/lib/turnstile";

const validInput = {
  givenName: " Ada ",
  familyName: " Lovelace ",
  contactEmail: " ADA@EXAMPLE.COM ",
  phone: "",
  connection: "Volunteer",
  turnstileToken: "token",
};

const parsed = parseSignupInput(validInput);
assert.deepEqual(parsed.data, {
  givenName: "Ada",
  familyName: "Lovelace",
  contactEmail: "ada@example.com",
  phone: null,
  connection: "Volunteer",
  turnstileToken: "token",
});
assert.equal(
  parseSignupInput({ ...validInput, contactEmail: "nope" }).errors?.contactEmail,
  "Enter a valid contact email.",
);
assert.equal(
  parseSignupInput({ ...validInput, turnstileToken: "" }).errors?.turnstileToken,
  "Complete the verification challenge.",
);

async function testTurnstile() {
  process.env.TURNSTILE_SECRET_KEY = "test-secret";
  process.env.TURNSTILE_HOSTNAME = "localhost";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ success: true, hostname: "localhost", action: "signup" }));
  assert.equal(await verifyTurnstile("token", new Request("http://localhost")), true);

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ success: true, hostname: "localhost", action: "resend" }));
  assert.equal(await verifyTurnstile("token", new Request("http://localhost")), false);
  globalThis.fetch = originalFetch;
}

function request(body = validInput) {
  return new Request("http://localhost/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function testDatabase(batchError?: unknown) {
  const writes: Array<Array<{ value: Record<string, unknown> }>> = [];
  const database = {
    insert: () => ({ values: (value: Record<string, unknown>) => ({ value }) }),
    batch: async (queries: Array<{ value: Record<string, unknown> }>) => {
      if (batchError) throw batchError;
      writes.push(queries);
    },
  };
  return { database: database as unknown as ReturnType<typeof getDb>, writes };
}

async function testSignupEndpoint() {
  process.env.MAIL_CAPTURE = "true";
  process.env.APP_URL = "http://localhost:3000";

  const blocked = testDatabase();
  const blockedHandler = createSignupHandler({
    getDb: () => blocked.database,
    verifyTurnstile: async () => false,
  });
  assert.equal((await blockedHandler(request())).status, 403);
  assert.equal(blocked.writes.length, 0);

  const accepted = testDatabase();
  const acceptedHandler = createSignupHandler({
    getDb: () => accepted.database,
    verifyTurnstile: async () => true,
  });
  assert.equal((await acceptedHandler(request())).status, 201);
  assert.equal(accepted.writes.length, 1);
  assert.equal(accepted.writes[0][0].value.contactEmail, "ada@example.com");
  assert.equal(accepted.writes[0][1].value.to, "ada@example.com");
  assert.match(
    accepted.writes[0][1].value.text as string,
    /http:\/\/localhost:3000\/verify\?token=/,
  );

  const duplicate = testDatabase(Object.assign(new Error("duplicate"), { code: "23505" }));
  const duplicateHandler = createSignupHandler({
    getDb: () => duplicate.database,
    verifyTurnstile: async () => true,
  });
  assert.equal((await duplicateHandler(request())).status, 409);
  assert.equal(duplicate.writes.length, 0);
}

testTurnstile()
  .then(testSignupEndpoint)
  .catch((error: unknown) => {
    throw error;
  });
