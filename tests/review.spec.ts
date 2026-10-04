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

    await page.goto("/review");
    await expect(page.getByRole("heading", { name: "Verified signup requests" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Verified Applicant" })).toBeVisible();
    await expect(page.getByText("Hidden Applicant")).toHaveCount(0);

    await page.getByRole("link", { name: "Verified Applicant" }).click();
    await expect(page.getByText("Community volunteer")).toBeVisible();
    await expect(page.getByText("+49 89 123")).toBeVisible();
  });
});
