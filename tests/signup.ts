import assert from "node:assert/strict";

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

testTurnstile().catch((error: unknown) => {
  throw error;
});
