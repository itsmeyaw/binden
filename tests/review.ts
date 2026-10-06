import assert from "node:assert/strict";

import {
  beginSignupRejection,
  captureRejectionNotification,
  rejectionMessage,
} from "../src/lib/review";
import { parseRejectionInput, parseReviewCorrectionInput } from "../src/lib/review-input";
import { getDb } from "../src/lib/db";

assert.deepEqual(
  parseReviewCorrectionInput({
    givenName: " Ada ",
    familyName: " Lovelace ",
    contactEmail: " ADA@EXAMPLE.COM ",
    phone: "",
    connection: " Volunteer ",
  }).data,
  {
    givenName: "Ada",
    familyName: "Lovelace",
    contactEmail: "ada@example.com",
    phone: null,
    connection: "Volunteer",
  },
);
assert.equal(
  parseRejectionInput({ reason: "" }).errors?.reason,
  "Enter a reason for the applicant.",
);
assert.equal(
  rejectionMessage("Not eligible."),
  "Your Workspace signup request was not approved. Reason: Not eligible.",
);

async function testRejectionLifecycle() {
  const writes: Array<Record<string, unknown>> = [];
  const results = [
    [{ id: "request" }],
    [{ id: "request", contactEmail: "ada@example.com", rejectionReason: "Not eligible." }],
    [{ id: "request", status: "rejected" }],
  ];
  const transactionDb = {
    update: () => ({
      set: (value: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            writes.push(value);
            return results.shift()!;
          },
        }),
      }),
    }),
    insert: () => ({ values: async (value: Record<string, unknown>) => writes.push(value) }),
  };
  const database = {
    ...transactionDb,
    transaction: async (callback: (tx: typeof transactionDb) => Promise<unknown>) =>
      callback(transactionDb),
  } as unknown as ReturnType<typeof getDb>;

  await beginSignupRejection("request", "Not eligible.", () => database);
  const rejected = await captureRejectionNotification("request", () => database);
  assert.equal(rejected?.status, "rejected");
  assert.equal(writes[0].status, "rejection_pending_notification");
  assert.equal(writes[2].to, "ada@example.com");
  assert.equal(writes[2].text, rejectionMessage("Not eligible."));
  assert.equal(writes[3].status, "rejected");
}

testRejectionLifecycle().catch((error: unknown) => {
  throw error;
});
