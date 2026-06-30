import { expect, test } from "@playwright/test";

test.describe("public experience", () => {
  test("moves from the landing page to the facility directory", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /Smart Space Management for Ashesi/i }),
    ).toBeVisible();

    await page
      .getByRole("link", { name: /Browse the facility directory/i })
      .click();

    await expect(page).toHaveURL(/\/rooms$/);
    await expect(
      page.getByRole("heading", { name: /Facility directory/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Sign in to reserve/i }).first(),
    ).toBeVisible();
  });

  test("keeps the mobile public drawer scrollable on short screens", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 420 });
    await page.goto("/");

    await page.getByRole("button", { name: /Open navigation/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: /AURA navigation/i }),
    ).toBeVisible();

    const scrollRegion = page.getByTestId("public-mobile-nav-scroll");
    await expect(scrollRegion).toBeVisible();

    const metrics = await scrollRegion.evaluate((element) => ({
      clientHeight: element.clientHeight,
      overflowY: getComputedStyle(element).overflowY,
      scrollHeight: element.scrollHeight,
    }));

    expect(metrics.overflowY).toMatch(/auto|scroll/);
    expect(metrics.clientHeight).toBeGreaterThan(0);
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

    await scrollRegion.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });

    await expect(
      page.getByText(/Smart Space Management for Ashesi/i).last(),
    ).toBeVisible();
  });
});
