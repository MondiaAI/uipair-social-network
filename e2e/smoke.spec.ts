import { test, expect, type ConsoleMessage } from "@playwright/test";

/**
 * Smoke test for the built SPA (Vercel / preview / any static host).
 *
 * Verifies:
 *  - the SPA shell loads
 *  - the client bundle boots without throwing
 *  - navigating to `/feed` either renders the feed OR redirects to `/login`
 *    (unauthenticated state) — both are valid "no crash" outcomes
 *  - no uncaught page errors and no unexpected console errors
 *
 * Run against any deployment by setting BASE_URL, e.g.
 *   BASE_URL=https://uipair-social-network.lovable.app bun run test:e2e -- smoke
 */

// Network / 3rd-party noise we don't want to fail the smoke test on.
const IGNORED_CONSOLE_PATTERNS = [
  /favicon/i,
  /manifest\.json/i,
  /Failed to load resource/i,
  /net::ERR_/i,
  /\b401\b/,
  /\b403\b/,
  /supabase\.co/i,
];

test.describe("SPA smoke", () => {
  test("home route loads without runtime errors", async ({ page }) => {
    const pageErrors: Error[] = [];
    const consoleErrors: string[] = [];

    page.on("pageerror", (err) => pageErrors.push(err));
    page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      if (IGNORED_CONSOLE_PATTERNS.some((re) => re.test(text))) return;
      consoleErrors.push(text);
    });

    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response, "navigation response").not.toBeNull();
    expect(response!.status(), "home status").toBeLessThan(500);

    // SPA root must mount
    await expect(page.locator("#root")).toBeAttached();
    await page.waitForFunction(
      () => !!document.querySelector("#root")?.firstElementChild,
      { timeout: 15_000 },
    );

    expect(pageErrors, `page errors: ${pageErrors.map((e) => e.message).join("\n")}`).toHaveLength(0);
    expect(consoleErrors, `console errors: ${consoleErrors.join("\n")}`).toHaveLength(0);
  });

  test("/feed renders or redirects to /login without crashing", async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    const response = await page.goto("/feed", { waitUntil: "domcontentloaded" });
    expect(response, "navigation response").not.toBeNull();
    expect(response!.status(), "/feed status").toBeLessThan(500);

    // Wait for either the feed heading or the login form / URL.
    await page.waitForFunction(
      () => {
        if (location.pathname.startsWith("/login")) return true;
        const text = document.body.innerText || "";
        return /Knowledge Feed|Loading/i.test(text);
      },
      { timeout: 20_000 },
    );

    const url = page.url();
    const onFeed = /\/feed(\?|$|#)/.test(url);
    const onLogin = /\/login(\?|$|#)/.test(url);
    expect(onFeed || onLogin, `unexpected url after /feed: ${url}`).toBe(true);

    expect(pageErrors, `page errors: ${pageErrors.map((e) => e.message).join("\n")}`).toHaveLength(0);
  });

  // Authenticated path — only runs if the CI seed step (scripts/seed-e2e.mjs)
  // populated these env vars. Locally, skip silently.
  test("authenticated /feed renders seeded post", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    test.skip(!email || !password, "E2E_TEST_EMAIL/PASSWORD not set; skipping authenticated smoke");

    const pageErrors: Error[] = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.locator("#email").fill(email!);
    await page.locator("#password").fill(password!);
    await page.getByRole("button", { name: /sign in|log in/i }).first().click();

    // After sign-in the app routes to /feed (or /onboarding/tenant if the
    // profile isn't ready). Seed script sets tenant+onboarding, so feed wins.
    await page.waitForURL(/\/feed(\?|$|#)/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /knowledge feed/i })).toBeVisible({
      timeout: 15_000,
    });

    // Seeded post is identifiable by its marker substring.
    await expect(page.getByText(/\[e2e-smoke-seed\]/)).toBeVisible({ timeout: 15_000 });

    expect(pageErrors, `page errors: ${pageErrors.map((e) => e.message).join("\n")}`).toHaveLength(0);
  });
});
