import { expect, test, type Page } from "@playwright/test";

/**
 * Multi-account governance scenario, played end to end in a real browser against a
 * server running with real authentication (COBOL_EXPLORER_AUTH=jwt):
 *
 *   1. Sofia (risk)     signs up, edits a copybook in an isolated version, sees the
 *                       blast radius, submits it for review — and is REFUSED the merge.
 *   2. Amine (dev)      signs in, finds Sofia's version, comments, and merges it.
 *   3. Marc (auditor)   signs in, is REFUSED the right to propose, and reads the
 *                       tamper-evident trail where all three actors appear.
 *
 * Each actor gets a fresh browser context, so nobody inherits anyone's token.
 * Run with:  make serve-sandbox   then   make e2e-governance
 * The sandbox matters: step 3 merges into main, and merging writes the result back
 * into the corpus — against the repo's own corpora/ this scenario edits your sources.
 */

const RUN = Date.now().toString().slice(-6);
const ACTORS = {
  sofia: { user: `sofia${RUN}`, display: "Sofia", role: "risk", password: "correct-horse-risk" },
  amine: { user: `amine${RUN}`, display: "Amine", role: "dev", password: "correct-horse-dev" },
  marc: { user: `marc${RUN}`, display: "Marc", role: "auditor", password: "correct-horse-audit" },
};
const VERSION_TITLE = `Premium field widened ${RUN}`;

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  const cfg = await page.request.get("/api/auth/config").then((r) => r.json()).catch(() => ({}));
  test.skip(!cfg?.required, "server is in open mode — start it with COBOL_EXPLORER_AUTH=jwt");
});

/** These three sign in for real, so they land on a genuine first visit and the
 *  guided tour would open over the workshop and swallow every click. The scenario
 *  under test is the collaboration, not the tour. */
async function skipTour(page: Page) {
  await page.addInitScript(() => localStorage.setItem("cobol-explorer-tour-seen", "1"));
}

async function signUp(page: Page, a: typeof ACTORS.sofia) {
  await skipTour(page);
  await page.goto("/");
  await page.getByTestId("nav-signup").click();
  await page.getByTestId("auth-user").fill(a.user);
  await page.getByTestId("auth-display").fill(a.display);
  await page.getByTestId("auth-password").fill(a.password);
  await page.getByTestId(`role-${a.role}`).click();
  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("identity")).toContainText(a.display, { timeout: 30000 });
}

async function signIn(page: Page, a: typeof ACTORS.sofia) {
  await skipTour(page);
  await page.goto("/");
  await page.getByTestId("nav-signin").click();
  await page.getByTestId("auth-user").fill(a.user);
  await page.getByTestId("auth-password").fill(a.password);
  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("identity")).toContainText(a.display, { timeout: 30000 });
}

test("1. Sofia (risk) proposes an isolated change and sees its impact", async ({ browser }) => {
  const page = await browser.newPage();
  await signUp(page, ACTORS.sofia);

  // Open a copybook. Outside a version the editor is read-only: it is the
  // "new version" gesture that opens the right to write.
  await page.getByTestId("search").fill("LGPOLICY");
  await page.getByTestId("search").press("Enter");
  await expect(page.locator(".cm-editor")).toContainText("POLICY");

  await page.keyboard.press("Meta+p");
  await page.keyboard.type("New version");
  await page.keyboard.press("Enter");

  await expect(page.getByTestId("nv-title")).toBeVisible({ timeout: 15000 });
  await page.getByTestId("nv-title").fill(VERSION_TITLE);
  await page.getByTestId("nv-create").click();
  await expect(page.getByTestId("statusbar-version")).toContainText(VERSION_TITLE.slice(0, 12), { timeout: 15000 });

  // The source corpus is never mutated: the change lives inside the version.
  await page.locator(".cm-content").click();
  await page.keyboard.press("End");
  await page.keyboard.type("      *> widened by risk review");
  await page.getByTestId("save-file").click();

  await page.getByTestId("rp-changes").click();
  await expect(page.getByTestId("chg-file")).toContainText(/lgpolicy/i, { timeout: 15000 });
  // Le compteur d'impact : la modification de Sofia met en jeu N programmes.
  await expect(page.getByTestId("changes-impact")).toHaveText(/^[1-9]\d*$/, { timeout: 20000 });
  await page.close();
});

test("2. Sofia (risk) may propose, but is REFUSED the merge", async ({ browser }) => {
  const page = await browser.newPage();
  await signIn(page, ACTORS.sofia);
  await page.getByTestId("rp-changes").click();

  await page.getByRole("button", { name: "Propose", exact: true }).click();
  await expect(page.getByTestId("rp-changes-panel")).toContainText("proposed", { timeout: 15000 });

  // RBAC: 'merge' is open to dev and architect only. The server decides, not the UI.
  const merge = page.getByTestId("merge-btn");
  if (await merge.count()) {
    await merge.click();
    if (await page.getByTestId("merge-gate").isVisible().catch(() => false)) await merge.click();
    await expect(page.getByTestId("cs-error")).toContainText(/not allowed|role/i, { timeout: 15000 });
  }
  await page.close();
});

test("3. Amine (dev) reviews, comments and merges Sofia's version", async ({ browser }) => {
  const page = await browser.newPage();
  await signUp(page, ACTORS.amine);
  await page.getByTestId("rp-changes").click();
  await expect(page.locator(".panel")).toContainText(VERSION_TITLE.slice(0, 12), { timeout: 20000 });

  await page.getByPlaceholder("comment on the version…").fill("Impact reviewed — proceeding.");
  await page.getByTestId("comment-send").click();
  await expect(page.locator(".comment").last()).toContainText("Impact reviewed", { timeout: 15000 });

  const merge = page.getByTestId("merge-btn");
  await expect(merge).toBeVisible();
  await merge.click();
  if (await page.getByTestId("merge-gate").isVisible().catch(() => false)) {
    await expect(page.getByTestId("merge-gate")).toContainText(/program|impact/i);
    await merge.click();
  }
  await expect(page.getByTestId("rp-changes-panel")).toContainText("merged", { timeout: 40000 });
  await page.close();
});

test("4. Marc (auditor) can propose nothing, and reads the whole audit trail", async ({ browser }) => {
  const page = await browser.newPage();
  await signUp(page, ACTORS.marc);

  // Refused server-side: an auditor does not create versions.
  const refused = await page.request.post("/api/changesets", {
    data: { title: "audit attempt", author: "Marc" },
    headers: { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("cobol-explorer-token"))}` },
  });
  expect(refused.status()).toBe(403);

  await page.getByTestId("rp-audit").click();
  const list = page.getByTestId("audit-list");
  await expect(list).toContainText("Sofia", { timeout: 20000 });
  await expect(list).toContainText("Amine");
  await expect(list).toContainText("Marc");
  // The chained log declares itself intact: no line altered or truncated.
  await expect(page.getByTestId("audit-chain")).toContainText(/intact|ok|verified/i);
  await page.close();
});
