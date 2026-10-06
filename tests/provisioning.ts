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

async function main() {
  if (!env.DATABASE_URL) return console.log("Skipped provisioning test: DATABASE_URL is not set.");
  const { eq } = await import("drizzle-orm");
  const { db } = await import("../src/lib/db");
  const { signupRequest, signupRequestGroup } = await import("../src/lib/schema");
  const { acceptSignupRequest, getProvisioningProgress, provisionAcceptedRequest } =
    await import("../src/lib/provisioning");

  const ids: string[] = [];
  async function seed(local: string, groups: string[], status = "verified") {
    const id = randomUUID();
    ids.push(id);
    await db.insert(signupRequest).values({
      id,
      givenName: "Test",
      familyName: "Person",
      contactEmail: `${id}@example.test`,
      status,
      workspaceEmail: `${local}-${id.slice(0, 8)}@example.org`,
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
  // Mirrors the route: accept, then provision; both are safe to repeat and to race.
  const accept = async (id: string) => {
    await acceptSignupRequest(id, "admin-1");
    await provisionAcceptedRequest(id);
  };

  try {
    // Repeated and concurrent accepts: one coherent outcome, one account.
    const ok = await seed("ok", ["sim-events", "sim-board"]);
    await Promise.all([accept(ok), accept(ok), accept(ok)]);
    await accept(ok);
    let progress = await getProvisioningProgress(ok);
    assert.equal(progress?.status, "awaiting_handover");
    assert.equal(progress?.accountCreateState, "created");
    assert.ok(progress?.groups.every((group) => group.state === "added"));
    const [row] = await db.select().from(signupRequest).where(eq(signupRequest.id, ok));
    assert.equal(row.googleUserId, `sim-user-${row.workspaceEmail}`);
    assert.equal(row.approvedByDirectoryId, "admin-1");

    // A request that was never verified cannot be accepted.
    const pending = await seed("pending", [], "pending_verification");
    assert.equal(await acceptSignupRequest(pending, "admin-1"), false);
    assert.equal(await getProvisioningProgress(pending), undefined);

    // A failed membership keeps the account and the successful memberships; no handover yet.
    const partial = await seed("partial", ["sim-events", "sim-flaky"]);
    await accept(partial);
    progress = await getProvisioningProgress(partial);
    assert.equal(progress?.status, "provisioning");
    assert.equal(progress?.accountCreateState, "created");
    assert.deepEqual(
      Object.fromEntries(progress!.groups.map((group) => [group.groupId, group.state])),
      { "sim-events": "added", "sim-flaky": "failed" },
    );

    // An uncertain create is recorded and never repeated.
    const uncertain = await seed("uncertain.user", ["sim-events"]);
    await Promise.all([accept(uncertain), accept(uncertain)]);
    await accept(uncertain);
    progress = await getProvisioningProgress(uncertain);
    assert.equal(progress?.status, "provisioning");
    assert.equal(progress?.accountCreateState, "uncertain");
    assert.equal(progress?.groups[0].state, "pending");
  } finally {
    for (const id of ids) await db.delete(signupRequest).where(eq(signupRequest.id, id));
    await db.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
