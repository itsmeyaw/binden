import { randomUUID } from "node:crypto";

import { expect, type Page, test } from "@playwright/test";
import { Pool } from "pg";

const databaseUrl = process.env.TEST_DATABASE_URL;
const storageState = process.env.E2E_GOOGLE_STORAGE_STATE;
const enabled = Boolean(process.env.E2E_BASE_URL && databaseUrl && storageState);

test.describe("verified signup request review", () => {
  test.skip(!enabled, "Set E2E_BASE_URL, TEST_DATABASE_URL, and E2E_GOOGLE_STORAGE_STATE.");
  test.use({ storageState });

  const ids: string[] = [];
  let pool: Pool;

  test.beforeAll(() => {
    pool = new Pool({ connectionString: databaseUrl });
  });

  test.afterAll(async () => {
    if (ids.length)
      await pool.query("delete from signup_request where id = any($1::uuid[])", [ids]);
    await pool.end();
  });

  test("shows only persisted verified requests and their applicant details", async ({ page }) => {
    const suffix = randomUUID();
    const verifiedId = randomUUID();
    const hiddenId = randomUUID();
    ids.push(verifiedId, hiddenId);
    await pool.query(
      `insert into signup_request
        (id, given_name, family_name, contact_email, phone, connection, status, verification_token_hash, verification_expires_at)
       values
        ($1, 'Verified', 'Applicant', $2, '+49 89 123', 'Community volunteer', 'verified', 'unused', now() + interval '1 day'),
        ($3, 'Hidden', 'Applicant', $4, null, null, 'pending_verification', 'unused', now() + interval '1 day')`,
      [verifiedId, `verified-${suffix}@example.test`, hiddenId, `hidden-${suffix}@example.test`],
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/review");
    await expect(page.getByRole("heading", { name: "Sign up requests" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Verified Applicant" })).toBeVisible();
    await expect(page.getByText("Hidden Applicant")).toHaveCount(0);

    await page.getByRole("link", { name: "Verified Applicant" }).click();
    await expect(page.getByText("Community volunteer")).toBeVisible();
    await expect(page.getByText("+49 89 123")).toBeVisible();
    await page.getByRole("link", { name: "Back to requests" }).click();
    await expect(page).toHaveURL(/\/review$/);
    await expect(page.getByRole("link", { name: "Verified Applicant" })).toBeVisible();
  });
  test("plans a Workspace email and initial group roles", async ({ page }) => {
    // Requires the server to run with GOOGLE_SIMULATION=true and GOOGLE_WORKSPACE_DOMAIN set.
    const domain = process.env.E2E_WORKSPACE_DOMAIN;
    test.skip(!domain, "Set E2E_WORKSPACE_DOMAIN to the server's GOOGLE_WORKSPACE_DOMAIN.");
    const id = randomUUID();
    ids.push(id);
    await pool.query(
      `insert into signup_request
        (id, given_name, family_name, contact_email, status, verification_token_hash, verification_expires_at)
       values ($1, 'Ada', 'Lovelace', $2, 'verified', 'unused', now() + interval '1 day')`,
      [id, `plan-${id}@example.test`],
    );

    await page.goto(`/review/${id}`);
    const email = page.getByLabel("Workspace email");
    // The simulated Directory reports ada.lovelace as already taken.
    await expect(email).toHaveValue("ada.lovelace");
    await expect(page.getByText("Choose a different address.")).toBeVisible();

    const clash = page.getByText("Choose a different address.");

    // Saving the form with the clashing proposal is refused.
    await page.getByRole("button", { name: "Correct details" }).click();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(clash).toBeVisible();

    // Editing to another taken address is refused and nothing is saved.
    await email.fill("taken.user");
    await expect(clash).toBeHidden();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(clash).toBeVisible();
    const [{ workspace_email: refused }] = (
      await pool.query("select workspace_email from signup_request where id = $1", [id])
    ).rows;
    expect(refused).toBeNull();

    await email.fill("ada.l");
    await page.getByRole("button", { name: "Done" }).click();
    await expect(clash).toBeHidden();
    const [{ workspace_email: saved }] = (
      await pool.query("select workspace_email from signup_request where id = $1", [id])
    ).rows;
    expect(saved).toBe(`ada.l@${domain}`);

    await page.getByRole("button", { name: "Correct details" }).click();
    await page.getByRole("checkbox", { name: /Events team/ }).click();
    await page.getByRole("checkbox", { name: /Board/ }).click();
    await page.getByRole("combobox", { name: "Role in Board" }).click();
    await page.getByRole("option", { name: "Owner" }).click();
    await page.getByRole("button", { name: "Done" }).click();

    await page.reload();
    await expect(email).toHaveValue(`ada.l@${domain}`);
    await expect(page.getByRole("checkbox", { name: /Events team/ })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: /Board/ })).toBeChecked();
    await expect(page.getByRole("combobox", { name: "Role in Board" })).toHaveText("Owner");
  });
  test.describe("acceptance", () => {
    // Requires the server to run with GOOGLE_SIMULATION=true and GOOGLE_WORKSPACE_DOMAIN set.
    const domain = process.env.E2E_WORKSPACE_DOMAIN;
    test.skip(!domain, "Set E2E_WORKSPACE_DOMAIN to the server's GOOGLE_WORKSPACE_DOMAIN.");

    async function seed(given: string, family: string, workspaceEmail: string | null) {
      const id = randomUUID();
      ids.push(id);
      await pool.query(
        `insert into signup_request
          (id, given_name, family_name, contact_email, status, workspace_email, verification_token_hash, verification_expires_at)
         values ($1, $2, $3, $4, 'verified', $5, 'unused', now() + interval '1 day')`,
        [id, given, family, `accept-${id}@example.test`, workspaceEmail],
      );
      return id;
    }
    const row = async (id: string) =>
      (
        await pool.query(
          "select status, account_create_state, google_user_id, approved_by_directory_id from signup_request where id = $1",
          [id],
        )
      ).rows[0];

    test("accepts the reviewed plan and keeps provisioning distinct from handover", async ({
      page,
    }) => {
      const id = await seed("Grace", "Hopper", null);
      await page.goto(`/review/${id}`);
      await expect(page.getByLabel("Workspace email")).toHaveValue("grace.hopper");
      await page.getByRole("button", { name: "Correct details" }).click();
      await page.getByRole("checkbox", { name: /Events team/ }).click();
      await page.getByRole("button", { name: "Done" }).click();

      await page.getByRole("button", { name: "Accept request" }).click();
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toContainText(`grace.hopper@${domain}`);
      await expect(dialog).toContainText("Events team · Member");
      await dialog.getByRole("button", { name: "Confirm acceptance" }).click();

      const steps = page.locator("ol");
      await expect(steps).toContainText("Accepted");
      await expect(steps).toContainText("Provisioning");
      await expect(steps).toContainText("Complete");
      await expect(steps).toContainText("First-login email sent");
      await expect(page.getByRole("button", { name: "Accept request" })).toHaveCount(0);

      const saved = await row(id);
      expect(saved.status).toBe("handover_confirmed");
      expect(saved.account_create_state).toBe("created");
      expect(saved.approved_by_directory_id).toBeTruthy();
      const groups = await pool.query(
        "select group_id, role, state from signup_request_group where signup_request_id = $1",
        [id],
      );
      expect(groups.rows).toEqual([{ group_id: "sim-events", role: "member", state: "added" }]);
      expect(await mailTo(id)).toHaveLength(1);
    });

    test("repeated and concurrent acceptance yields one accepted outcome", async ({ page }) => {
      const id = await seed(
        "Concurrent",
        "Person",
        `concurrent.${randomUUID().slice(0, 8)}@${domain}`,
      );
      const accept = () => page.request.post(`/api/review/requests/${id}/acceptance`);
      const responses = await Promise.all([accept(), accept(), accept()]);
      for (const response of responses) expect(response.ok()).toBe(true);
      const again = await accept();
      expect((await again.json()).progress.status).toBe("handover_confirmed");
      const saved = await row(id);
      expect(saved.status).toBe("handover_confirmed");
      expect(saved.google_user_id).toBeTruthy();
    });

    test("records an uncertain account creation without repeating it", async ({ page }) => {
      const id = await seed("Uncertain", "User", `uncertain.user@${domain}`);
      await page.goto(`/review/${id}`);
      await page.getByRole("button", { name: "Accept request" }).click();
      await page.getByRole("button", { name: "Confirm acceptance" }).click();
      await expect(page.getByText("Account creation outcome unknown")).toBeVisible();
      await expect(page.locator("ol")).not.toContainText("First-login email sent");

      const again = await page.request.post(`/api/review/requests/${id}/acceptance`);
      expect((await again.json()).progress.accountCreateState).toBe("uncertain");
      const saved = await row(id);
      expect(saved.status).toBe("provisioning");
      expect(saved.account_create_state).toBe("uncertain");
      expect(saved.google_user_id).toBeNull();
    });

    async function acceptWithGroups(page: Page, local: string, groupIds: string[]) {
      const id = await seed("Recover", "Person", `${local}.${randomUUID().slice(0, 8)}@${domain}`);
      await pool.query(
        "insert into signup_request_group (signup_request_id, group_id, group_email) select $1, g, g || '@' || $3 from unnest($2::text[]) g",
        [id, groupIds, domain],
      );
      await page.request.post(`/api/review/requests/${id}/acceptance`);
      return id;
    }
    const groupStates = async (id: string) =>
      Object.fromEntries(
        (
          await pool.query(
            "select group_id, state from signup_request_group where signup_request_id = $1",
            [id],
          )
        ).rows.map((group) => [group.group_id, group.state]),
      );

    test("retries only unfinished memberships until handover", async ({ page }) => {
      const id = await acceptWithGroups(page, "retry", ["sim-events", "sim-recovering"]);
      expect(await groupStates(id)).toEqual({ "sim-events": "added", "sim-recovering": "failed" });

      await page.goto(`/review/${id}`);
      await expect(page.getByText("Needs attention")).toBeVisible();
      await expect(page.locator("ol")).not.toContainText("First-login email sent");
      await page.getByRole("button", { name: "Retry unfinished memberships" }).click();

      await expect(page.locator("ol")).toContainText("First-login email sent");
      expect(await groupStates(id)).toEqual({ "sim-events": "added", "sim-recovering": "added" });
      expect((await row(id)).status).toBe("handover_confirmed");
    });

    test("replaces an unmanageable group with a recorded, confirmed revision", async ({ page }) => {
      const id = await acceptWithGroups(page, "revise", ["sim-events", "sim-gone"]);
      await page.goto(`/review/${id}`);
      await expect(page.getByText("No longer manageable")).toBeVisible();
      // Only the unfinished group can be revised.
      await expect(page.getByRole("button", { name: "Remove or replace" })).toHaveCount(1);
      await page.getByRole("button", { name: "Remove or replace" }).click();

      const dialog = page.getByRole("alertdialog");
      await dialog.getByLabel("Replacement group").click();
      await page.getByRole("option", { name: /Board/ }).click();
      await dialog.getByRole("button", { name: "Confirm revision" }).click();

      await expect(page.locator("ol")).toContainText("First-login email sent");
      expect(await groupStates(id)).toEqual({ "sim-events": "added", "sim-board": "added" });
      const revisions = await pool.query(
        "select removed_group_id, replacement_group_id, replacement_role from signup_request_revision where signup_request_id = $1",
        [id],
      );
      expect(revisions.rows).toEqual([
        {
          removed_group_id: "sim-gone",
          replacement_group_id: "sim-board",
          replacement_role: "member",
        },
      ]);
    });

    test("removing the last unfinished group needs confirmation and reaches handover", async ({
      page,
    }) => {
      const id = await acceptWithGroups(page, "remove", ["sim-flaky"]);
      const url = `/api/review/requests/${id}/provisioning/revisions`;
      const unconfirmed = await page.request.post(url, { data: { groupId: "sim-flaky" } });
      expect(unconfirmed.status()).toBe(422);
      expect(await groupStates(id)).toEqual({ "sim-flaky": "failed" });

      await page.goto(`/review/${id}`);
      await page.getByRole("button", { name: "Remove or replace" }).click();
      await page.getByRole("button", { name: "Confirm revision" }).click();
      await expect(page.locator("ol")).toContainText("First-login email sent");
      expect(await groupStates(id)).toEqual({});
    });

    test("does not retry an uncertain account creation", async ({ page }) => {
      const id = await seed("Uncertain", "Retry", `uncertain.user.retry@${domain}`);
      await page.request.post(`/api/review/requests/${id}/acceptance`);
      await page.goto(`/review/${id}`);
      await expect(page.getByRole("button", { name: "Retry unfinished memberships" })).toHaveCount(
        0,
      );
      const retry = await page.request.post(`/api/review/requests/${id}/provisioning`);
      expect(retry.status()).toBe(409);
      expect((await row(id)).account_create_state).toBe("uncertain");
    });

    const mailTo = async (id: string) =>
      (
        await pool.query(
          'select "to", subject, text from mail_message where signup_request_id = $1',
          [id],
        )
      ).rows;

    test("resends the first-login email from a request awaiting it, recording only that it was sent", async ({
      page,
    }) => {
      const id = await seed("Hand", "Over", `handover.${randomUUID().slice(0, 8)}@${domain}`);
      // A request whose first-login email failed on accept: the account exists, nothing was sent.
      await pool.query(
        "update signup_request set status = 'awaiting_handover', account_create_state = 'created', google_user_id = 'sim-user-' || workspace_email where id = $1",
        [id],
      );
      await page.goto(`/review/${id}`);
      const steps = page.locator("ol");
      await expect(steps).toContainText("Email not sent");
      await expect(steps).toContainText("could not be sent to the applicant's contact email");

      await page.getByRole("button", { name: "Send first-login email" }).click();
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toContainText("does not show that the message was delivered");
      await dialog.getByRole("button", { name: "Send email" }).click();

      await expect(steps).toContainText("First-login email sent");
      await expect(steps).toContainText("with a temporary password was sent");
      await expect(page.getByRole("button", { name: "Send first-login email" })).toHaveCount(0);
      const saved = (
        await pool.query(
          "select status, handover_confirmed_at, handover_confirmed_by_directory_id from signup_request where id = $1",
          [id],
        )
      ).rows[0];
      expect(saved.status).toBe("handover_confirmed");
      expect(saved.handover_confirmed_at).toBeTruthy();
      expect(saved.handover_confirmed_by_directory_id).toBeTruthy();

      // Repeating is safe and sends nothing further.
      const again = await page.request.post(`/api/review/requests/${id}/handover`);
      expect((await again.json()).progress.status).toBe("handover_confirmed");
      expect(await mailTo(id)).toHaveLength(0);

      await page.goto("/review");
      await expect(page.getByRole("link", { name: /Hand Over/ })).toContainText(
        "First-login email sent",
      );
    });

    test("blocks the first-login email until memberships have succeeded", async ({ page }) => {
      const id = await acceptWithGroups(page, "blocked", ["sim-events", "sim-flaky"]);
      const response = await page.request.post(`/api/review/requests/${id}/handover`);
      expect(response.status()).toBe(409);
      expect((await row(id)).status).toBe("provisioning");
      await page.goto(`/review/${id}`);
      await expect(page.getByRole("button", { name: "Send first-login email" })).toHaveCount(0);
    });

    test("a request that is not awaiting the first-login email cannot be sent", async ({
      page,
    }) => {
      const id = await seed("Not", "Ready", null);
      const response = await page.request.post(`/api/review/requests/${id}/handover`);
      expect(response.status()).toBe(409);
      expect((await row(id)).status).toBe("verified");
    });
  });

  test("the handover route refuses signed-out callers", async ({ playwright }) => {
    const anonymous = await playwright.request.newContext({ baseURL: process.env.E2E_BASE_URL });
    const id = randomUUID();
    const handover = await anonymous.post(`/api/review/requests/${id}/handover`);
    expect(handover.status()).toBe(401);
    await anonymous.dispose();
  });

  test("recovery routes refuse signed-out callers", async ({ playwright }) => {
    const anonymous = await playwright.request.newContext({ baseURL: process.env.E2E_BASE_URL });
    const id = randomUUID();
    const retry = await anonymous.post(`/api/review/requests/${id}/provisioning`);
    const revise = await anonymous.post(`/api/review/requests/${id}/provisioning/revisions`, {
      data: { groupId: "x", confirmed: true },
    });
    expect([retry.status(), revise.status()]).toEqual([401, 401]);
    await anonymous.dispose();
  });
});
