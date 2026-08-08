import { expect, test } from "@playwright/test";

test("landing page connects to the API", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "SyncSlate" }),
  ).toBeVisible();
  await expect(
    page.getByRole("status", { name: "API connected" }),
  ).toBeVisible();
});
