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
        ($3, 'Hidden', 'Applicant', $4, null, null, 'provisioning', 'unused', now() + interval '1 day')`,
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
    await expect(email).toHaveValue(`ada.lovelace@${domain}`);
    await expect(page.getByText("Choose a different address.")).toBeVisible();

    await page.getByRole("button", { name: "Save plan" }).click();
    await expect(page.getByText("Choose a different address.")).toBeVisible();
    await expect(page.getByText("Save the plan to review")).toBeVisible();

    await email.fill(`ada.l@${domain}`);
    await page.getByRole("button", { name: "Save plan" }).click();
    await expect(page.getByText("No initial groups selected.")).toBeVisible();

    await page.getByRole("checkbox", { name: /Events team/ }).click();
    await page.getByRole("checkbox", { name: /Board/ }).click();
    await page.getByRole("combobox", { name: "Role in Board" }).click();
    await page.getByRole("option", { name: "Owner" }).click();
    await page.getByRole("button", { name: "Save plan" }).click();

    const review = page.getByRole("region", { name: "Final review" });
    await expect(review.getByText(`ada.l@${domain}`)).toBeVisible();
    await expect(review.getByRole("listitem").filter({ hasText: "events@" })).toContainText(
      "Member",
    );
    await expect(review.getByRole("listitem").filter({ hasText: "board@" })).toContainText("Owner");
    await expect(review.getByText("do not grant administrative authority")).toBeVisible();

    await page.reload();
    await expect(email).toHaveValue(`ada.l@${domain}`);
  });
});
