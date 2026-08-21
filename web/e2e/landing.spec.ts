import { expect, test } from "@playwright/test";

// Structural guarantees of the public page. The visual language is not testable
// here, but the four things that made the old page fail a reader are: hijacked
// scroll, a numbering that drifted, product facts typed by hand, and a fold with
// seven competing blocks in it.
//
// Same setup as auth.spec.ts: the landing only renders when the server reports
// real-auth mode, so the config call is mocked and the session cleared.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem("cobol-explorer-identity");
    localStorage.removeItem("cobol-explorer-token");
  });
  await page.route("**/api/auth/config", (route) =>
    route.fulfill({
      json: { mode: "jwt", required: true, roles: ["dev", "risk", "auditor"], email_verification: false, ibm_sign_in: false },
    }),
  );
});

// Scroll hijacked into a div breaks anchor restoration, sticky positioning, the
// browser's own scroll indicator and full-page capture.
test("la page publique scrolle dans le document", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("landing")).toBeVisible();

  const docHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(docHeight).toBeGreaterThan(5000);

  const hijacked = await page.evaluate(() => {
    const el = document.querySelector(".ce-landing");
    if (!el) return false;
    return ["auto", "scroll"].includes(getComputedStyle(el).overflowY);
  });
  expect(hijacked).toBe(false);
});

// The number came from a string typed into the kicker prop, and had drifted to
// 00 01 02 03 04 05 06 10 07 08 09 11. Derived from position, it cannot drift.
test("les numéros de section se suivent sans trou", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("landing")).toBeVisible();

  const kickers = await page.locator(".ce-kicker").allInnerTexts();
  const parsed = kickers.map((t) => parseInt(t.trim().slice(0, 2), 10));
  expect(parsed.length).toBeGreaterThan(10);
  expect(parsed).toEqual(parsed.map((_, i) => i));
});

// A hand-written citation is a claim nobody re-checks. Every product fact on the
// page must come from one source.
test("le fold ne porte aucune donnée produit écrite à la main", async ({ page }) => {
  await page.goto("/");
  const hero = page.getByTestId("hero-section");
  await expect(hero).toBeVisible();
  await expect(hero).not.toContainText("lgacdb01.cbl:88");
  await expect(hero.locator(".ce-answer")).toHaveCount(0);
});

// Resend's restraint: the fold carries the argument, the measured numbers come
// after it. If they creep back above the fold, the fold has seven things again.
test("les chiffres sont sous le pli, pas dedans", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByTestId("landing")).toBeVisible();

  const metrics = page.locator(".ce-metrics");
  await expect(metrics).toBeVisible();
  const box = await metrics.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThan(820);
});
