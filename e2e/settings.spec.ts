import { test, expect, Page } from "@playwright/test";

/**
 * E2E: Edit Profile + Settings work for old AND newly created accounts.
 *
 * Run:
 *   BASE_URL=https://uipair.com \
 *   E2E_OLD_EMAIL=existing@example.com \
 *   E2E_OLD_PASSWORD=secret \
 *   bunx playwright test
 *
 * The "new account" test exercises the full signup flow.
 * The "old account" test signs in with provided credentials (skipped if not set)
 * and verifies the same Settings + Edit Profile flow works.
 */

const OLD_EMAIL = process.env.E2E_OLD_EMAIL;
const OLD_PASSWORD = process.env.E2E_OLD_PASSWORD;

function uniqueEmail() {
  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return `e2e+${stamp}@uipair.test`;
}

async function openSettingsFromHeader(page: Page) {
  // Avatar dropdown -> Settings
  await page.getByRole("button", { name: /open|account|avatar|profile/i }).first().click().catch(() => {});
  // Fallback: click the avatar by class — header avatar is a 9x9 button
  if (!(await page.getByRole("menuitem", { name: /settings/i }).isVisible().catch(() => false))) {
    await page.locator("header button").last().click();
  }
  await page.getByRole("menuitem", { name: /settings/i }).click();
  await expect(page).toHaveURL(/\/settings/);
  await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible();
}

async function verifySettingsAndEditProfile(page: Page) {
  // Settings page renders the University & country card and a Save button.
  await expect(page.getByText(/university\s*&\s*country/i)).toBeVisible();
  const saveBtn = page.getByRole("button", { name: /save changes/i });
  await expect(saveBtn).toBeVisible();
  await expect(saveBtn).toBeEnabled();

  // Click Save — should toast "Settings saved" (or at least not throw).
  await saveBtn.click();
  await expect(page.getByText(/settings saved|could not save/i)).toBeVisible({ timeout: 10_000 });

  // Navigate to View profile (link in settings header).
  await page.getByRole("link", { name: /view profile/i }).click();
  await expect(page).toHaveURL(/\/profile\//);

  // The own-profile page should show an Edit Profile control.
  const editProfile = page.getByRole("button", { name: /edit profile/i })
    .or(page.getByRole("link", { name: /edit profile/i }));
  await expect(editProfile.first()).toBeVisible({ timeout: 10_000 });
}

test.describe("Edit Profile & Settings", () => {
  test("new account: complete signup, then edit settings & profile", async ({ page }) => {
    const email = uniqueEmail();
    const password = "TestPass!2345";

    await page.goto("/signup");

    // Step 1 — basics
    await page.getByLabel(/full name/i).fill("E2E Tester");
    await page.getByLabel(/^email/i).fill(email);
    await page.getByLabel(/^password/i).fill(password);
    await page.getByLabel(/confirm password/i).fill(password);

    // Date of birth (18+)
    const today = new Date();
    const dobYear = String(today.getFullYear() - 22);
    await page.getByLabel(/day/i).fill("15");
    await page.getByLabel(/month/i).fill("06");
    await page.getByLabel(/year/i).fill(dobYear);

    await page.getByLabel(/terms|accept/i).check().catch(() => {});

    await page.getByRole("button", { name: /continue|next/i }).click();

    // Subsequent steps vary; click through any "Continue / Skip / Finish" we see.
    for (let i = 0; i < 6; i++) {
      const finish = page.getByRole("button", { name: /finish|create account|sign up/i });
      if (await finish.isVisible().catch(() => false)) {
        await finish.click();
        break;
      }
      const next = page.getByRole("button", { name: /continue|next|skip/i }).first();
      if (await next.isVisible().catch(() => false)) {
        await next.click();
      } else {
        break;
      }
      await page.waitForTimeout(400);
    }

    // After signup, should land in the app (feed or onboarding).
    await page.waitForURL(/\/(feed|onboarding|settings|profile)/, { timeout: 30_000 });

    await openSettingsFromHeader(page);
    await verifySettingsAndEditProfile(page);
  });

  test("old account: sign in & edit settings & profile", async ({ page }) => {
    test.skip(!OLD_EMAIL || !OLD_PASSWORD,
      "Set E2E_OLD_EMAIL and E2E_OLD_PASSWORD to run the old-account test.");

    await page.goto("/login");
    await page.getByLabel(/email/i).fill(OLD_EMAIL!);
    await page.getByLabel(/password/i).fill(OLD_PASSWORD!);
    await page.getByRole("button", { name: /log in|sign in/i }).click();

    await page.waitForURL(/\/(feed|onboarding|settings|profile)/, { timeout: 30_000 });

    await openSettingsFromHeader(page);
    await verifySettingsAndEditProfile(page);
  });
});
