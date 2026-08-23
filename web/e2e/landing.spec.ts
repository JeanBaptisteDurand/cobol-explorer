import { expect, test } from "@playwright/test";
import { SECTIONS } from "../src/components/SectionIndex";

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
test("the public page scrolls in the document", async ({ page }) => {
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
test("the section numbers run in order with no gap", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("landing")).toBeVisible();

  // Scoped to .ce-sec: the same kicker style also labels the hero badge, the
  // figure captions and a couple of asides, and those carry no number.
  const kickers = await page.locator(".ce-sec > .ce-inner > .ce-kicker").allInnerTexts();
  const parsed = kickers.map((t) => parseInt(t.trim().slice(0, 2), 10));

  // Counted against the declaration rather than a literal: adding a section must
  // not need this file edited, but a section the header knows and the page does
  // not - or the reverse - has to fail.
  expect(parsed.length).toBe(SECTIONS.length);
  expect(parsed).toEqual(parsed.map((_, i) => i));

  // And every header link must resolve to a section that is actually rendered.
  const missing = await page.evaluate(
    (ids) => ids.filter((id) => !document.getElementById(id)),
    SECTIONS.map((s) => s.id),
  );
  expect(missing).toEqual([]);
});

// A hand-written citation is a claim nobody re-checks. Every product fact on the
// page must come from one source.
test("the fold carries no hand-written product data", async ({ page }) => {
  await page.goto("/");
  const hero = page.getByTestId("hero-section");
  await expect(hero).toBeVisible();
  await expect(hero).not.toContainText("lgacdb01.cbl:88");
  await expect(hero.locator(".ce-answer")).toHaveCount(0);
});

// Resend's restraint: the fold carries the argument and nothing else, and the
// measured numbers come after it. Asserted structurally rather than against a
// pixel, so the guarantee survives a change of viewport or of hero height: the
// metrics must begin at or below the bottom edge of the hero.
test("the metrics start after the argument block", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByTestId("landing")).toBeVisible();

  const hero = await page.getByTestId("hero-section").boundingBox();
  const metrics = await page.locator(".ce-metrics").boundingBox();
  expect(hero).not.toBeNull();
  expect(metrics).not.toBeNull();
  expect(metrics!.y).toBeGreaterThanOrEqual(hero!.y + hero!.height);
});

// The fold holds four things: badge, headline, one lead, two actions. Anything
// more and it stops being an argument and becomes a summary of the whole page.
test("the fold holds only the four intended elements", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const hero = page.getByTestId("hero-section");
  await expect(hero.locator(".ce-kicker")).toHaveCount(1);
  await expect(hero.locator("h1")).toHaveCount(1);
  await expect(hero.locator(".ce-hero-lead")).toHaveCount(1);
  await expect(hero.locator(".ce-hero-actions > *")).toHaveCount(2);
  await expect(hero.locator(".ce-metrics")).toHaveCount(0);
});

