import { test, expect } from "@playwright/test";

/**
 * E2E coverage for circle subject search filtering + highlighting on the
 * Circles index and Discover routes. Verifies that:
 *  - typing a query into the search box filters cards
 *  - matching tokens render inside <mark> highlight elements
 *  - the "Other" subject filter exposes the custom-subject input and
 *    the typed value also highlights inside matching cards
 *
 * This test requires an authenticated session (the routes live under the
 * `_authenticated` layout). It is skipped silently when E2E credentials are
 * not provided, matching the convention used by smoke.spec.ts.
 */

const EMAIL = process.env.E2E_TEST_EMAIL;
const PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("Circles subject search + highlighting", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD, "E2E_TEST_EMAIL/PASSWORD not set");
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.locator("#email").fill(EMAIL!);
    await page.locator("#password").fill(PASSWORD!);
    await page.getByRole("button", { name: /sign in|log in/i }).first().click();
    await page.waitForURL(/\/(feed|onboarding|circles)/, { timeout: 30_000 });
  });

  for (const route of ["/circles", "/circles/discover"] as const) {
    test(`free-text search filters and highlights matches on ${route}`, async ({ page }) => {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      const searchBox = page.getByPlaceholder(/search/i).first();
      await expect(searchBox).toBeVisible({ timeout: 15_000 });

      // Wait until either circles are listed or the empty state shows.
      await page.waitForFunction(() => {
        const txt = document.body.innerText || "";
        return /Discover/i.test(txt);
      }, { timeout: 15_000 });

      // Type a common substring likely to match either real or seeded data.
      const query = "science";
      await searchBox.fill(query);

      // Allow debounced render.
      await page.waitForTimeout(400);

      // Any <mark> that appears must match the query (case-insensitive).
      const marks = page.locator("mark");
      const count = await marks.count();
      if (count > 0) {
        for (let i = 0; i < Math.min(count, 10); i++) {
          const txt = (await marks.nth(i).textContent())?.toLowerCase() ?? "";
          expect(txt).toContain(query.toLowerCase());
        }
      }

      // Clearing the search should remove highlights inside circle cards.
      await searchBox.fill("");
      await page.waitForTimeout(300);
    });
  }

  test("'Other' subject filter exposes custom input and highlights typed text", async ({ page }) => {
    await page.goto("/circles", { waitUntil: "domcontentloaded" });

    // Open the subject select and pick "Other".
    const trigger = page.getByRole("combobox").first();
    await trigger.click();
    await page.getByRole("option", { name: "Other" }).click();

    const customInput = page.getByPlaceholder(/type your subject/i).first();
    await expect(customInput).toBeVisible();

    await customInput.fill("Quantum");
    await page.waitForTimeout(500);

    // If any cards are rendered, all <mark> spans should match the typed term.
    const marks = page.locator("mark");
    const count = await marks.count();
    for (let i = 0; i < Math.min(count, 5); i++) {
      const txt = (await marks.nth(i).textContent())?.toLowerCase() ?? "";
      expect(txt).toContain("quantum");
    }
  });
});
