/**
 * tests/e2e/public.spec.ts
 *
 * Tests that run WITHOUT authentication (project: chromium-public).
 * Verifies that the Next.js Middleware (proxy.ts) correctly redirects
 * unauthenticated users away from protected routes.
 */

import { test, expect } from "@playwright/test";

test.describe("Protected routes — unauthenticated access", () => {
  test("visiting / shows the landing page with a GitHub sign-in button", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Interview AI" })
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("button", { name: /Sign in with GitHub/i })
    ).toBeVisible();
  });

  test("visiting /interview without a session redirects to the sign-in page", async ({
    page,
  }) => {
    await page.goto("/interview");
    // Auth.js redirects to the signIn page defined in authConfig.pages.signIn = "/"
    await expect(page).toHaveURL(/\/$|\/\?|callbackUrl/, { timeout: 15_000 });

    // The sign-in button must be on the page after redirect
    await expect(
      page.getByRole("button", { name: /Sign in with GitHub/i })
    ).toBeVisible();
  });

  test("the home page title is 'Interview AI'", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Interview AI/, { timeout: 15_000 });
  });
});
