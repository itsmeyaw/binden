import assert from "node:assert/strict";

import { createSignupHandler } from "../src/app/api/signup/route";
import { createResendHandler } from "../src/app/api/verify/resend/route";
import { createVerificationHandler } from "../src/app/api/verify/route";
import { getDb } from "../src/lib/db";
import { parseSignupInput } from "../src/lib/signup";
import { verifyTurnstile } from "../src/lib/turnstile";
import { parseResendInput } from "../src/lib/verification";

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
  assert.equal(await verifyTurnstile("token", new Request("http://localhost"), "resend"), true);
  globalThis.fetch = originalFetch;
}

function verificationDatabase(
  verified: ReadonlyArray<Record<string, unknown>>,
  existing: ReadonlyArray<Record<string, unknown>> = [],
) {
  return {
    update: () => ({
      set: () => ({
        where: () => ({ returning: async () => verified }),
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => existing }),
      }),
    }),
  } as unknown as ReturnType<typeof getDb>;
}

async function testVerificationEndpoint() {
  const request = new Request("http://localhost/api/verify?token=token");
  const successful = createVerificationHandler({
    getDb: () => verificationDatabase([{ id: "request" }]),
  });
  assert.equal((await successful(request)).status, 200);
  assert.deepEqual(await (await successful(request)).json(), { outcome: "verified" });

  for (const [outcome, existing] of [
    ["used", [{ status: "verified", verificationExpiresAt: new Date(Date.now() + 1_000) }]],
    ["used", [{ status: "under_review", verificationExpiresAt: new Date(Date.now() + 1_000) }]],
    ["expired", [{ status: "pending_verification", verificationExpiresAt: new Date(0) }]],
    ["invalid", []],
  ] as const) {
    const handler = createVerificationHandler({ getDb: () => verificationDatabase([], existing) });
    assert.deepEqual(await (await handler(request)).json(), { outcome });
  }
}

function resendDatabase(updated: Array<{ id: string; contactEmail: string }>) {
  const writes: Array<Record<string, unknown>> = [];
  const transaction = async (callback: (tx: typeof transactionDb) => Promise<void>) =>
    callback(transactionDb);
  const transactionDb = {
    update: () => ({
      set: (value: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            writes.push(value);
            return updated;
          },
        }),
      }),
    }),
    insert: () => ({
      values: async (value: Record<string, unknown>) => writes.push(value),
    }),
  };
  return { database: { transaction } as unknown as ReturnType<typeof getDb>, writes };
}

async function testResendEndpoint() {
  process.env.MAIL_CAPTURE = "true";
  process.env.APP_URL = "http://localhost:3000";
  assert.equal(
    parseResendInput({ contactEmail: " ADA@EXAMPLE.COM ", turnstileToken: "token" }).data
      ?.contactEmail,
    "ada@example.com",
  );

  const blocked = resendDatabase([{ id: "request", contactEmail: "ada@example.com" }]);
  const blockedHandler = createResendHandler({
    getDb: () => blocked.database,
    verifyTurnstile: async () => false,
  });
  assert.equal(
    (
      await blockedHandler(
        new Request("http://localhost/api/verify/resend", {
          method: "POST",
          body: JSON.stringify({ contactEmail: "ada@example.com", turnstileToken: "token" }),
        }),
      )
    ).status,
    403,
  );
  assert.equal(blocked.writes.length, 0);

  const accepted = resendDatabase([{ id: "request", contactEmail: "ada@example.com" }]);
  const acceptedHandler = createResendHandler({
    getDb: () => accepted.database,
    verifyTurnstile: async (_token, _request, action) => action === "resend",
  });
  assert.equal(
    (
      await acceptedHandler(
        new Request("http://localhost/api/verify/resend", {
          method: "POST",
          body: JSON.stringify({ contactEmail: "ada@example.com", turnstileToken: "token" }),
        }),
      )
    ).status,
    200,
  );
  assert.equal(accepted.writes.length, 2);
  assert.deepEqual(Object.keys(accepted.writes[0]), ["verificationTokenHash"]);
  assert.match(accepted.writes[1].text as string, /http:\/\/localhost:3000\/verify\?token=/);
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
  let deletions = 0;
  const transactionDb = {
    insert: () => ({
      values: async (value: Record<string, unknown>) => writes.at(-1)!.push({ value }),
    }),
  };
  const database = {
    delete: () => ({
      where: async () => {
        deletions += 1;
      },
    }),
    transaction: async (callback: (tx: typeof transactionDb) => Promise<void>) => {
      if (batchError) throw batchError;
      writes.push([]);
      await callback(transactionDb);
    },
  };
  return {
    database: database as unknown as ReturnType<typeof getDb>,
    deletions: () => deletions,
    writes,
  };
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
  assert.equal(accepted.deletions(), 1);
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
  .then(testVerificationEndpoint)
  .then(testResendEndpoint)
  .catch((error: unknown) => {
    throw error;
  });
