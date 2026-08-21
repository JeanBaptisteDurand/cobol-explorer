import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Regenerates the five product plates the public page carries.
 *
 *   make shots
 *
 * Run it after any change to the workshop's appearance. The plates were taken by
 * hand until now, so a retint silently turned them into pictures of a product
 * that no longer exists — a juror comparing the page to the live app would have
 * found the mismatch before we did.
 *
 * Excluded from the ordinary suite (see playwright.config.ts) so a normal run
 * neither rewrites the PNGs nor reports five extra tests.
 */
// The project is ESM, so there is no __dirname here.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/shots");

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

// Same seeding as explorer.spec.ts: the workshop renders straight from a stored
// identity, with no sign-in step. Keep the two in step.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "cobol-explorer-identity",
      JSON.stringify({ name: "test", role: "Developer" }),
    ),
  );
});

/** Waits for the estate AND the version list, not merely for the shell to be
 *  mounted. Without the second wait the sidebar is captured mid-fetch and the
 *  plate shows "No version." under an estate that has three. */
async function workshop(page: Page) {
  await page.goto("/");
  await expect(page.locator(".ov-stats")).toContainText(/programs/i, { timeout: 30_000 });
  await expect(page.getByTestId("version-row").first()).toBeVisible({ timeout: 30_000 });
}

test("plate: the workshop", async ({ page }) => {
  await workshop(page);
  await expect(page.getByTestId("fanin-row").first()).toBeVisible();
  await page.screenshot({ path: `${OUT}/sc-apercu.png` });
});

test("plate: impact radius", async ({ page }) => {
  await workshop(page);
  // The Overview hero CTA fires the deterministic ripple on the estate's most
  // critical copybook. Focus mode then reduces the graph to that closure and
  // re-frames onto it — without it the whole estate stays in view and the
  // impacted nodes are specks, which proves nothing.
  await page.getByTestId("impact-hero-cta").click();
  await expect(page.locator(".rf-node").first()).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("graph-focus").click();
  await page.waitForTimeout(1500); // fitView animates over --slow, once
  await page.screenshot({ path: `${OUT}/sc-impact.png` });
});

test("plate: the diff and the merge gate", async ({ page }) => {
  await workshop(page);
  await page.locator('[data-ab="branch"]').click();
  await expect(page.getByTestId("rp-changes-panel")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("changes-impact")).toBeVisible();
  await page.screenshot({ path: `${OUT}/sc-merge.png` });
});

// The only plate that needs a model behind it. It asks for real and waits for the
// trace, so a run without an LLM FAILS rather than quietly writing a picture of an
// empty panel captioned "a grounded answer, its trace and its citations".
// Skip it deliberately with PWTEST_SKIP_LLM=1; the existing PNG is then left alone.
test("plate: a grounded answer and its trace", async ({ page }) => {
  test.skip(!!process.env.PWTEST_SKIP_LLM, "no LLM configured — sc-agent.png left untouched");
  test.setTimeout(180_000);
  await workshop(page);
  await page.getByTestId("rp-chat").click();
  await page.getByTestId("chat-input").fill("What breaks if I change LGPOLICY?");
  await page.getByTestId("chat-send").click();
  await expect(page.getByTestId("trace")).toContainText("graph_lookup", { timeout: 150_000 });
  await expect(page.getByTestId("grounded")).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: `${OUT}/sc-agent.png` });
});

test("plate: the audit trail", async ({ page }) => {
  await workshop(page);
  await page.getByTestId("rp-audit").click();
  await expect(page.getByTestId("audit-list")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("audit-chain")).toBeVisible();
  await page.screenshot({ path: `${OUT}/sc-audit.png` });
});
