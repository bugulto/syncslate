import { expect, test } from "@playwright/test";

const testEmail = `syncslate-e2e-${Date.now()}@example.com`;
const testPassword = "SyncSlate-e2e-password-1";
const testDisplayName = "E2E Interviewer";

test.describe.serial("interviewer authentication", () => {
  test("redirects an unauthenticated dashboard visitor to sign in", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/sign-in$/u);
    await expect(
      page.getByRole("heading", { name: "Sign in to SyncSlate" }),
    ).toBeVisible();
  });

  test("allows a local test interviewer to sign in", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("button", { name: "Create an account" }).click();
    await page.getByLabel("Display name").fill(testDisplayName);
    await page.getByLabel("Email").fill(testEmail);
    await page.getByLabel("Password", { exact: true }).fill(testPassword);
    await page.getByLabel("Confirm password").fill(testPassword);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/dashboard$/u);
    await expect(page.getByText(testDisplayName)).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/u);

    await page.getByLabel("Email").fill(testEmail);
    await page.getByLabel("Password").fill(testPassword);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/dashboard$/u);
    await expect(
      page.getByRole("heading", { level: 3, name: "No interviews yet" }),
    ).toBeVisible();
    await expect(page.getByText(testDisplayName)).toBeVisible();
  });

  test("prevents dashboard access after sign-out", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(testEmail);
    await page.getByLabel("Password").fill(testPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/u);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/u);

    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/sign-in$/u);
  });
});
