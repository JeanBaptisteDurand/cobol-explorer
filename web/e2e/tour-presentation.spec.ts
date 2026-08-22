import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The project is ESM, so there is no __dirname here.
const HERE = path.dirname(fileURLToPath(import.meta.url));

const asDeveloper = (page: Page, tourSeen: boolean) =>
  page.addInitScript((seen) => {
    localStorage.setItem("cobol-explorer-identity", JSON.stringify({ name: "JB", role: "Developer" }));
    if (seen) localStorage.setItem("cobol-explorer-tour-seen", "1");
    else localStorage.removeItem("cobol-explorer-tour-seen");
  }, tourSeen);

const workshop = async (page: Page) => {
  await page.goto("/");
  await expect(page.locator(".ov-stats")).toContainText(/programs/i, { timeout: 30_000 });
};

// The argument page and the public home page are the same component, so they
// cannot drift. Only the calls to action differ.
test("/presentation serves the argument page with a way back to the workshop", async ({ page }) => {
  await asDeveloper(page, true);
  await page.goto("/presentation");

  await expect(page.getByTestId("presentation")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".ce-hero h1")).toContainText(/estate|proof/i);
  // Same twelve sections as the public page.
  expect(await page.locator(".ce-sec > .ce-inner > .ce-kicker").count()).toBeGreaterThan(10);
  // And no door: the reader is already inside.
  await expect(page.getByTestId("nav-signup")).toHaveCount(0);
  await expect(page.getByTestId("back-to-workshop")).toBeVisible();

  await page.getByTestId("back-to-workshop").click();
  await expect(page.locator(".ov-stats")).toContainText(/programs/i, { timeout: 30_000 });
  expect(new URL(page.url()).pathname).toBe("/");
});

test("the workshop offers the link to the presentation", async ({ page }) => {
  await asDeveloper(page, true);
  await workshop(page);
  await page.getByTestId("open-presentation").click();
  await expect(page.getByTestId("presentation")).toBeVisible({ timeout: 20_000 });
  expect(new URL(page.url()).pathname).toBe("/presentation");
});

// The tour has to put the interface into the state each step describes, or it
// teaches the wrong thing. Step 5 is the agent, so the agent panel must be open.
test("the tour plays on a first visit and opens what it describes", async ({ page }) => {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(String(e)));

  await asDeveloper(page, false);
  await workshop(page);

  const pop = page.locator(".driver-popover");
  await expect(pop).toBeVisible({ timeout: 15_000 });
  await expect(pop).toContainText(/1 of \d+/);

  // Every declared step must play. Two of them were being dropped silently
  // because their target only exists once an entity is selected, and the filter
  // ran before React had painted — the count is what caught it.
  const total = Number((await pop.locator(".driver-popover-progress-text").innerText()).match(/of (\d+)/)?.[1]);
  expect(total).toBe(15);

  const titles: string[] = [];
  for (let i = 0; i < total; i++) {
    titles.push(await page.locator(".driver-popover-title").innerText());
    if (i === 5) await expect(page.getByTestId("rp-chat")).toHaveClass(/on/);   // the agent step opened it
    if (i === 6) await expect(page.locator(".panel")).toContainText("LGPOLICY"); // the inspector step filled it
    if (i === 11) await expect(page.getByTestId("bob-panel")).toBeVisible();     // the MCP step opened it
    if (i < total - 1) { await page.locator(".driver-popover-next-btn").click(); await page.waitForTimeout(300); }
  }
  expect(new Set(titles).size).toBe(total);   // no step shown twice

  // The tour never writes into the reader's search box, and hands the sidebar
  // back the way it found it.
  expect(await page.getByTestId("search").inputValue()).toBe("");
  await page.locator(".driver-popover-next-btn").click().catch(() => {});
  await page.waitForTimeout(300);
  await expect(page.getByTestId("bob-panel")).toHaveCount(0);
  expect(errs, errs.join(" | ")).toHaveLength(0);
});

test("the tour does not come back on its own, but the button replays it", async ({ page }) => {
  await asDeveloper(page, true);
  await workshop(page);
  await page.waitForTimeout(800);
  await expect(page.locator(".driver-popover")).toHaveCount(0);

  await page.getByTestId("open-tour").click();
  await expect(page.locator(".driver-popover")).toBeVisible({ timeout: 15_000 });
});

// The sidebar panel is the answer to "how do I point my own Bob at this?", which
// the product asserted in three places and answered in none.
test("the MCP panel hands over the real configuration, ready to copy", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    localStorage.setItem("cobol-explorer-identity", JSON.stringify({ name: "JB", role: "Developer" }));
    localStorage.setItem("cobol-explorer-tour-seen", "1");
  });
  await page.goto("/");
  await expect(page.locator(".ov-stats")).toContainText(/programs/i, { timeout: 30_000 });

  await page.locator('[data-ab="plug"]').click();
  const panel = page.getByTestId("bob-panel");
  await expect(panel).toBeVisible();
  // The three tools, named as the server actually declares them.
  for (const t of ["graph_lookup", "search_code", "read_source_lines"]) await expect(panel).toContainText(t);
  // And the constraint stated rather than glossed over.
  await expect(panel).toContainText(/stdio/i);

  await page.getByTestId("bob-copy-config").click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  // Compared against .bob/mcp.json itself, not against a couple of substrings a
  // broken config also contains. The published snippet had silently dropped the
  // `env` block, and without PYTHONPATH `python -m mcp_server.server` exits with
  // ModuleNotFoundError — so what the panel handed a reader could not start.
  const real = JSON.parse(readFileSync(path.resolve(HERE, "../../.bob/mcp.json"), "utf8"));
  expect(JSON.parse(clip)).toEqual(real);

  await page.locator('[data-ab="plug"]').click();
  await expect(panel).toHaveCount(0);
});
