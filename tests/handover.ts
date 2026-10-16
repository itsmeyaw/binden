import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { actor, fakeDirectory } from "./fake-directory";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Environment may already be provided.
}
const env = process.env as Record<string, string | undefined>;
env.GOOGLE_WORKSPACE_DOMAIN = "example.org";
env.GOOGLE_SIMULATION = "true";
env.APP_URL = "http://localhost:3000";

async function main() {
  if (!env.DATABASE_URL) return console.log("Skipped handover test: DATABASE_URL is not set.");
  const { eq } = await import("drizzle-orm");
  const { db } = await import("../src/lib/db");
  const { mailMessage, signupRequest, signupRequestGroup } = await import("../src/lib/schema");
  const { acceptSignupRequest, provisionAcceptedRequest, sendHandover } =
    await import("../src/lib/provisioning");

  const fake = fakeDirectory();
  const ids: string[] = [];
  async function seed(status: string, groups: string[] = []) {
    const id = randomUUID();
    ids.push(id);
    await db.insert(signupRequest).values({
      id,
      givenName: "Secret",
      familyName: "Applicant",
      contactEmail: `${id}@example.test`,
      phone: "+49 1234",
      status,
      workspaceEmail: `handover-${id.slice(0, 8)}@example.org`,
      verificationTokenHash: "unused",
      verificationExpiresAt: new Date(Date.now() + 86_400_000),
    });
    if (groups.length)
      await db.insert(signupRequestGroup).values(
        groups.map((groupId) => ({
          signupRequestId: id,
          groupId,
          groupEmail: `${groupId}@example.org`,
        })),
      );
    return id;
  }
  const mail = (id: string) =>
    db.select().from(mailMessage).where(eq(mailMessage.signupRequestId, id));
  const row = async (id: string) =>
    (await db.select().from(signupRequest).where(eq(signupRequest.id, id)))[0];
  // Temporary passwords sent to a user through the Directory, in order.
  const resets = (userId: string | null) =>
    fake.writes
      .filter((write) => write.method === "PATCH" && write.path === `users/${userId}`)
      .map((write) => String(write.body.password));
  // Splits a Gmail message into its headers and decoded plain-text body.
  const decode = (raw: string) => {
    const [headers, body] = raw.split("\r\n\r\n");
    return {
      headers,
      body: Buffer.from(body.replace(/\r\n/g, ""), "base64").toString("utf8"),
    };
  };

  try {
    // The first-login email is blocked until provisioning has finished every selected membership.
    const partial = await seed("verified", ["sim-events", "sim-flaky"]);
    await acceptSignupRequest(partial, "admin-1");
    await provisionAcceptedRequest(partial, actor);
    assert.equal((await row(partial)).status, "provisioning");
    assert.equal(await sendHandover(partial, actor), "blocked");
    assert.equal((await row(partial)).handoverConfirmedAt, null);
    assert.equal(await sendHandover(await seed("verified"), actor), "unavailable");

    // Accepting with every membership added sends the email at once; repeats do not resend it.
    const ok = await seed("verified", ["sim-events"]);
    await acceptSignupRequest(ok, "admin-1");
    await provisionAcceptedRequest(ok, actor);
    const saved = await row(ok);
    assert.equal(saved.status, "handover_confirmed");
    assert.ok(saved.handoverConfirmedAt);
    assert.equal(saved.handoverConfirmedByDirectoryId, "admin-1");
    assert.equal(saved.approvedByDirectoryId, "admin-1");
    assert.doesNotMatch(JSON.stringify(saved), /password/i);
    assert.equal(await sendHandover(ok, actor), "already");
    await provisionAcceptedRequest(ok, actor);

    // A membership that is no longer added blocks a request still awaiting the email.
    const regress = await seed("verified", ["sim-events"]);
    await db
      .update(signupRequest)
      .set({
        status: "awaiting_handover",
        accountCreateState: "created",
        googleUserId: `sim-user-${(await row(regress)).workspaceEmail}`,
      })
      .where(eq(signupRequest.id, regress));
    await db
      .update(signupRequestGroup)
      .set({ state: "failed" })
      .where(eq(signupRequestGroup.signupRequestId, regress));
    assert.equal(await sendHandover(regress, actor), "blocked");
    assert.equal((await row(regress)).status, "awaiting_handover");

    // Without simulation the account is created, reset, and mailed through the Directory and Gmail.
    delete env.GOOGLE_SIMULATION;
    try {
      const real = await seed("verified");
      await acceptSignupRequest(real, "admin-1");
      await provisionAcceptedRequest(real, actor);
      const created = await row(real);
      assert.equal(created.status, "handover_confirmed");
      const [password] = resets(created.googleUserId);
      assert.ok(password);
      assert.equal(fake.messages.length, 1);
      const sent = decode(fake.messages[0]);
      assert.match(sent.headers, new RegExp(`To: ${created.contactEmail}`));
      assert.ok(sent.body.includes(password));
      assert.ok(sent.body.includes(created.workspaceEmail ?? "?"));
      assert.ok(sent.body.includes("https://accounts.google.com"));
      assert.ok(!JSON.stringify(created).includes(password));
      assert.equal((await mail(real)).length, 0);

      // A failed mail rolls back: acceptance still succeeds and the request stays awaiting the email.
      const flaky = await seed("verified");
      fake.failMail(500);
      await acceptSignupRequest(flaky, "admin-1");
      await provisionAcceptedRequest(flaky, actor);
      const stalled = await row(flaky);
      assert.equal(stalled.status, "awaiting_handover");
      assert.equal(stalled.handoverConfirmedAt, null);
      assert.equal(fake.messages.length, 1);
      assert.equal((await mail(flaky)).length, 0);

      // Sending again with Gmail healthy resets the password, so the earlier one stops working.
      fake.failMail();
      assert.equal(await sendHandover(flaky, actor), "sent");
      const [first, second] = resets(stalled.googleUserId);
      assert.notEqual(first, second);
      assert.equal(fake.messages.length, 2);
      const resent = decode(fake.messages[1]);
      assert.ok(resent.body.includes(second));
      assert.ok(!resent.body.includes(first));
      assert.equal((await row(flaky)).status, "handover_confirmed");

      // Concurrent sends: one resets and mails, the other reports that it was already sent.
      const racing = await seed("verified");
      fake.failMail(500);
      await acceptSignupRequest(racing, "admin-1");
      await provisionAcceptedRequest(racing, actor);
      fake.failMail();
      const raced = await Promise.all([sendHandover(racing, actor), sendHandover(racing, actor)]);
      assert.deepEqual(raced.sort(), ["already", "sent"]);
      assert.equal(resets((await row(racing)).googleUserId).length, 2);
      assert.equal(fake.messages.length, 3);
    } finally {
      env.GOOGLE_SIMULATION = "true";
    }
  } finally {
    fake.restore();
    for (const id of ids) await db.delete(signupRequest).where(eq(signupRequest.id, id));
    await db.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
