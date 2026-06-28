import { test, expect, type Page } from "@playwright/test";

// Collect console errors per page; ignore noisy/expected ones.
function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // DVLA/DVSA/Overpass may 4xx/5xx without keys or data — not app bugs.
    if (/api\/(vehicle|nearby|analyze)/i.test(text)) return;
    if (/favicon/i.test(text)) return;
    errors.push(text);
  });
  return errors;
}

test.describe("public (no auth)", () => {
  test("redirects to the auth page and renders the sign-in form", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/");
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.getByRole("tab", { name: "Sign In" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Create Account" })).toBeVisible();
    await expect(page.getByPlaceholder("name@example.com")).toBeVisible();
    expect(errors, `console errors: ${errors.join(" | ")}`).toHaveLength(0);
  });

  test("signup shows the account-type selector and toggles the business name field", async ({ page }) => {
    await page.goto("/auth");
    await page.getByRole("tab", { name: "Create Account" }).click();

    await expect(page.getByText("Account type")).toBeVisible();
    await expect(page.getByText("Personal", { exact: true })).toBeVisible();
    await expect(page.getByText("Business — our own fleet")).toBeVisible();
    await expect(page.getByText("Business — for clients")).toBeVisible();

    // Selecting a business type reveals the org-name field.
    await page.getByText("Business — our own fleet").click();
    await expect(page.getByText("Business name")).toBeVisible();

    await page.getByText("Business — for clients").click();
    await expect(page.getByText("Agency name")).toBeVisible();
  });

  test("sign-in validates empty input", async ({ page }) => {
    await page.goto("/auth");
    await page.getByTestId("btn-signin").click();
    await expect(page.getByText(/valid email address/i)).toBeVisible();
  });
});

// Authenticated walk — only runs when credentials are supplied:
//   E2E_EMAIL=... E2E_PASSWORD=... pnpm --filter @workspace/pcn-checker test:e2e
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.describe("authenticated", () => {
  test.skip(!EMAIL || !PASSWORD, "set E2E_EMAIL and E2E_PASSWORD to run the signed-in walk");

  test.beforeEach(async ({ page }) => {
    await page.goto("/auth");
    await page.getByTestId("input-email").fill(EMAIL!);
    await page.getByTestId("input-password").fill(PASSWORD!);
    await page.getByTestId("btn-signin").click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  });

  test("dashboard loads", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("core pages load without crashing", async ({ page }) => {
    for (const [path, heading] of [
      ["/pcns", "My PCNs"],
      ["/vehicles", /vehicles/i],
      ["/tolls", /tolls/i],
      ["/settings", "Settings"],
    ] as const) {
      const errors = trackConsoleErrors(page);
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading as any })).toBeVisible();
      expect(errors, `console errors on ${path}: ${errors.join(" | ")}`).toHaveLength(0);
    }
  });

  test("data lists render (vehicles + pcns are reachable)", async ({ page }) => {
    // Regression guard for the account-scoping change: the lists must still load.
    await page.goto("/vehicles");
    await expect(page.getByRole("heading", { name: /vehicles/i })).toBeVisible();
    await page.goto("/pcns");
    await expect(page.getByRole("heading", { name: "My PCNs" })).toBeVisible();
  });
});
