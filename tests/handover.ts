import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Environment may already be provided.
}
const env = process.env as Record<string, string | undefined>;
env.GOOGLE_WORKSPACE_DOMAIN = "example.org";
env.GOOGLE_SIMULATION = "true";
env.APP_URL = "http://localhost:3000";
env.REVIEWER_NOTIFICATION_GROUP = "reviewers@example.org";

async function main() {
  if (!env.DATABASE_URL) return console.log("Skipped handover test: DATABASE_URL is not set.");
  const { eq } = await import("drizzle-orm");
  const { db } = await import("../src/lib/db");
  const { mailMessage, signupRequest, signupRequestGroup } = await import("../src/lib/schema");
  const { sendReviewerNotification } = await import("../src/lib/review");
  const { acceptSignupRequest, confirmHandover, provisionAcceptedRequest } =
    await import("../src/lib/provisioning");

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

  try {
    // One minimal notice per verified request, however often or concurrently it is sent.
    const verified = await seed("verified");
    const outcomes = await Promise.all([
      sendReviewerNotification(verified),
      sendReviewerNotification(verified),
    ]);
    assert.deepEqual(outcomes.sort(), ["sent", "skipped"]);
    assert.equal(await sendReviewerNotification(verified), "skipped");
    const notices = await mail(verified);
    assert.equal(notices.length, 1);
    assert.equal(notices[0].to, "reviewers@example.org");
    assert.match(notices[0].text, /http:\/\/localhost:3000\/review/);
    for (const personal of ["Secret", "Applicant", "+49 1234", "@example.test"])
      assert.ok(!notices[0].subject.includes(personal) && !notices[0].text.includes(personal));
    assert.equal((await row(verified)).reviewerNotificationState, "sent");

    // A delivery failure leaves the request verified and retryable.
    const failing = await seed("verified");
    env.MAIL_CAPTURE = "false";
    assert.equal(await sendReviewerNotification(failing), "failed");
    assert.equal((await row(failing)).status, "verified");
    assert.equal((await row(failing)).reviewerNotificationState, "failed");
    assert.equal((await mail(failing)).length, 0);
    env.MAIL_CAPTURE = "true";
    assert.equal(await sendReviewerNotification(failing), "sent");
    assert.equal((await mail(failing)).length, 1);

    // Only verified requests are notified.
    assert.equal(await sendReviewerNotification(await seed("pending_verification")), "skipped");

    // Handover is blocked until provisioning has finished every selected membership.
    const partial = await seed("verified", ["sim-events", "sim-flaky"]);
    await acceptSignupRequest(partial, "admin-1");
    await provisionAcceptedRequest(partial);
    assert.equal((await row(partial)).status, "provisioning");
    assert.equal(await confirmHandover(partial, "admin-2"), "blocked");
    assert.equal((await row(partial)).handoverConfirmedAt, null);
    assert.equal(await confirmHandover(await seed("verified"), "admin-2"), "unavailable");

    // Confirmation is recorded once; concurrent and repeated confirmations do not duplicate it.
    const ok = await seed("verified", ["sim-events"]);
    await acceptSignupRequest(ok, "admin-1");
    await provisionAcceptedRequest(ok);
    assert.equal((await row(ok)).status, "awaiting_handover");
    const results = await Promise.all([
      confirmHandover(ok, "admin-2"),
      confirmHandover(ok, "admin-3"),
    ]);
    assert.deepEqual(results.sort(), ["already", "confirmed"]);
    assert.equal(await confirmHandover(ok, "admin-2"), "already");
    const saved = await row(ok);
    assert.equal(saved.status, "handover_confirmed");
    assert.ok(saved.handoverConfirmedAt);
    assert.match(saved.handoverConfirmedByDirectoryId ?? "", /^admin-[23]$/);
    assert.equal(saved.approvedByDirectoryId, "admin-1");

    // The confirmation notice goes to the reviewer group without applicant data or credentials.
    const confirmation = await mail(ok);
    assert.equal(confirmation.length, 1);
    assert.equal(confirmation[0].to, "reviewers@example.org");
    for (const personal of ["Secret", "Applicant", "password", saved.workspaceEmail ?? "?"])
      assert.ok(!confirmation[0].text.includes(personal));

    // A membership that is no longer added blocks a not-yet-confirmed handover.
    const regress = await seed("verified", ["sim-events"]);
    await acceptSignupRequest(regress, "admin-1");
    await provisionAcceptedRequest(regress);
    await db
      .update(signupRequestGroup)
      .set({ state: "failed" })
      .where(eq(signupRequestGroup.signupRequestId, regress));
    assert.equal(await confirmHandover(regress, "admin-2"), "blocked");
  } finally {
    for (const id of ids) await db.delete(signupRequest).where(eq(signupRequest.id, id));
    await db.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
