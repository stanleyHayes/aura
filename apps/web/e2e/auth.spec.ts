import { expect, test } from "@playwright/test";

const e2eEmail = process.env.E2E_USER_EMAIL;
const e2ePassword = process.env.E2E_USER_PASSWORD;

test.describe("authentication", () => {
  test("redirects protected routes to sign in with the next parameter", async ({
    page,
  }) => {
    await page.goto("/app");

    await expect(page).toHaveURL(/\/login\?next=%2Fapp$/);
    await expect(
      page.getByRole("heading", { name: /Sign in to AURA/i }),
    ).toBeVisible();
  });

  test("validates the login form in the browser", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("button", { name: /^Sign in$/i }).click();

    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page.getByText("Enter your password.")).toBeVisible();
  });

  test("signs in with a real seeded account when credentials are provided", async ({
    page,
  }) => {
    test.skip(
      !e2eEmail || !e2ePassword,
      "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run the real login flow.",
    );

    await page.goto("/login");
    await page.getByLabel(/^Email/i).fill(e2eEmail!);
    await page.getByLabel(/^Password/i).fill(e2ePassword!);
    await page.getByRole("button", { name: /^Sign in$/i }).click();

    await expect(page).toHaveURL(/\/(app|admin)(?:$|[/?#])/);
    await expect(page.getByRole("button", { name: /Account menu/i })).toBeVisible();
  });
});
