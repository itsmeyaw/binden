import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
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
      await expect(steps).toContainText("Awaiting handover");
      await expect(steps).toContainText("First-login instructions have not been sent yet.");
      await expect(page.getByRole("button", { name: "Accept request" })).toHaveCount(0);

      const saved = await row(id);
      expect(saved.status).toBe("awaiting_handover");
      expect(saved.account_create_state).toBe("created");
      expect(saved.approved_by_directory_id).toBeTruthy();
      const groups = await pool.query(
        "select group_id, role, state from signup_request_group where signup_request_id = $1",
        [id],
      );
      expect(groups.rows).toEqual([{ group_id: "sim-events", role: "member", state: "added" }]);
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
      expect((await again.json()).progress.status).toBe("awaiting_handover");
      const saved = await row(id);
      expect(saved.status).toBe("awaiting_handover");
      expect(saved.google_user_id).toBeTruthy();
    });

    test("records an uncertain account creation without repeating it", async ({ page }) => {
      const id = await seed("Uncertain", "User", `uncertain.user@${domain}`);
      await page.goto(`/review/${id}`);
      await page.getByRole("button", { name: "Accept request" }).click();
      await page.getByRole("button", { name: "Confirm acceptance" }).click();
      await expect(page.getByText("Account creation outcome unknown")).toBeVisible();
      await expect(page.locator("ol")).not.toContainText("Awaiting handover");

      const again = await page.request.post(`/api/review/requests/${id}/acceptance`);
      expect((await again.json()).progress.accountCreateState).toBe("uncertain");
      const saved = await row(id);
      expect(saved.status).toBe("provisioning");
      expect(saved.account_create_state).toBe("uncertain");
      expect(saved.google_user_id).toBeNull();
    });
  });
});
