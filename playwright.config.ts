import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "review.spec.ts",
  use: { baseURL: process.env.E2E_BASE_URL },
});
