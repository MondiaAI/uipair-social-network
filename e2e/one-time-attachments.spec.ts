import { test, expect, Page, BrowserContext } from "@playwright/test";

/**
 * E2E: one-time view (OTT) attachments — images & documents.
 *
 * Verifies:
 *  1. A sender can attach an image or document with the "One-time" toggle on.
 *  2. The recipient sees a "Tap to view once" / "Open once" affordance.
 *  3. After the recipient opens it once, the UI flips to a locked
 *     "Photo viewed" / "Document viewed" state.
 *  4. Reloading the recipient's page still shows the locked state
 *     (durable per-recipient tracking, not just client memory).
 *  5. The sender sees a "Viewed" badge instead of "One-time" once opened.
 *
 * Required env vars (skipped otherwise):
 *   BASE_URL                – preview / local app url
 *   E2E_SENDER_EMAIL        – existing user A
 *   E2E_SENDER_PASSWORD
 *   E2E_RECIPIENT_EMAIL     – existing user B (already friends with A)
 *   E2E_RECIPIENT_PASSWORD
 *   E2E_RECIPIENT_NAME      – display name or username substring used to
 *                             find the conversation in the chat list
 */

const SENDER_EMAIL = process.env.E2E_SENDER_EMAIL;
const SENDER_PASSWORD = process.env.E2E_SENDER_PASSWORD;
const RECIPIENT_EMAIL = process.env.E2E_RECIPIENT_EMAIL;
const RECIPIENT_PASSWORD = process.env.E2E_RECIPIENT_PASSWORD;
const RECIPIENT_NAME = process.env.E2E_RECIPIENT_NAME ?? "";
const SENDER_NAME = process.env.E2E_SENDER_NAME ?? "";

const skipReason =
  "Set E2E_SENDER_EMAIL/PASSWORD, E2E_RECIPIENT_EMAIL/PASSWORD, " +
  "E2E_RECIPIENT_NAME, and E2E_SENDER_NAME to run one-time view tests.";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await page.waitForURL(/\/(feed|onboarding|messages|profile)/, { timeout: 30_000 });
}

async function openConversationWith(page: Page, name: string) {
  await page.goto("/messages");
  await expect(page.getByRole("heading", { name: /messages/i }).first()).toBeVisible();
  // Find a conversation row containing the counterpart's name.
  const row = page.getByRole("button").filter({ hasText: new RegExp(name, "i") }).first();
  await row.click();
  // Wait for composer to appear.
  await expect(page.getByPlaceholder(/message|type a message/i)).toBeVisible({ timeout: 15_000 });
}

async function attachOneTimeFile(
  page: Page,
  filename: string,
  mime: string,
  body: Buffer,
) {
  // Set the file on the hidden <input type=file>.
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles({ name: filename, mimeType: mime, buffer: body });

  // Toggle the "One-time" button in the attachment preview area.
  const oneTimeBtn = page.getByRole("button", { name: /one-?time/i }).first();
  await expect(oneTimeBtn).toBeVisible({ timeout: 10_000 });
  await oneTimeBtn.click();

  // Send.
  await page.getByRole("button", { name: /send/i }).click();
}

async function waitForLockedState(page: Page, label: RegExp) {
  await expect(page.getByText(label).first()).toBeVisible({ timeout: 15_000 });
}

test.describe("One-time view attachments", () => {
  test.skip(
    !SENDER_EMAIL || !SENDER_PASSWORD || !RECIPIENT_EMAIL || !RECIPIENT_PASSWORD || !RECIPIENT_NAME || !SENDER_NAME,
    skipReason,
  );

  let senderCtx: BrowserContext;
  let recipientCtx: BrowserContext;
  let senderPage: Page;
  let recipientPage: Page;

  test.beforeEach(async ({ browser }) => {
    senderCtx = await browser.newContext();
    recipientCtx = await browser.newContext();
    senderPage = await senderCtx.newPage();
    recipientPage = await recipientCtx.newPage();
    await Promise.all([
      login(senderPage, SENDER_EMAIL!, SENDER_PASSWORD!),
      login(recipientPage, RECIPIENT_EMAIL!, RECIPIENT_PASSWORD!),
    ]);
  });

  test.afterEach(async () => {
    await senderCtx.close();
    await recipientCtx.close();
  });

  test("one-time image can be opened only once by the recipient", async () => {
    await openConversationWith(senderPage, RECIPIENT_NAME);
    await openConversationWith(recipientPage, SENDER_NAME);

    // 1x1 transparent PNG.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABXvMqOgAAAABJRU5ErkJggg==",
      "base64",
    );
    await attachOneTimeFile(senderPage, `ott-${Date.now()}.png`, "image/png", png);

    // Recipient sees the "Tap to view once" pill.
    const viewOnce = recipientPage.getByRole("button", { name: /tap to view once/i }).last();
    await expect(viewOnce).toBeVisible({ timeout: 20_000 });
    await viewOnce.click();

    // Close the lightbox (Escape) and verify locked state.
    await recipientPage.keyboard.press("Escape");
    await waitForLockedState(recipientPage, /photo viewed/i);

    // Reload — locked state must persist (DB-backed, not just memory).
    await recipientPage.reload();
    await openConversationWith(recipientPage, SENDER_NAME);
    await waitForLockedState(recipientPage, /photo viewed/i);

    // The "Tap to view once" button is gone for the recipient.
    await expect(recipientPage.getByRole("button", { name: /tap to view once/i })).toHaveCount(0);

    // Sender side: the badge flips from "One-time" to "Viewed".
    await waitForLockedState(senderPage, /viewed/i);
  });

  test("one-time document can be opened only once by the recipient", async () => {
    await openConversationWith(senderPage, RECIPIENT_NAME);
    await openConversationWith(recipientPage, SENDER_NAME);

    const pdfBytes = Buffer.from(
      "%PDF-1.1\n%\xE2\xE3\xCF\xD3\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\nxref\n0 3\n0000000000 65535 f \n0000000017 00000 n \n0000000060 00000 n \ntrailer<</Size 3/Root 1 0 R>>\nstartxref\n105\n%%EOF\n",
      "binary",
    );
    await attachOneTimeFile(senderPage, `ott-${Date.now()}.pdf`, "application/pdf", pdfBytes);

    // Recipient sees "Open once".
    const openOnce = recipientPage.getByRole("button", { name: /open once/i }).last();
    await expect(openOnce).toBeVisible({ timeout: 20_000 });

    // Intercept window.open so the test doesn't try to launch the file.
    await recipientPage.evaluate(() => {
      // @ts-expect-error – test shim
      window.__openCalls = [];
      // @ts-expect-error – test shim
      window.open = (url: string) => {
        // @ts-expect-error – test shim
        window.__openCalls.push(url);
        return null;
      };
    });

    await openOnce.click();
    await waitForLockedState(recipientPage, /document viewed/i);

    const openCalls = await recipientPage.evaluate(() => {
      // @ts-expect-error – test shim
      return (window.__openCalls as string[]) ?? [];
    });
    expect(openCalls.length).toBe(1);

    // Reload — still locked.
    await recipientPage.reload();
    await openConversationWith(recipientPage, SENDER_NAME);
    await waitForLockedState(recipientPage, /document viewed/i);
    await expect(recipientPage.getByRole("button", { name: /open once/i })).toHaveCount(0);

    // Sender sees "Viewed".
    await waitForLockedState(senderPage, /viewed/i);
  });
});
