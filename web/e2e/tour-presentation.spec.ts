import { expect, test, type Page } from "@playwright/test";

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
test("/presentation sert la page d'arguments avec le retour vers l'atelier", async ({ page }) => {
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

test("l'atelier offre le lien vers la présentation", async ({ page }) => {
  await asDeveloper(page, true);
  await workshop(page);
  await page.getByTestId("open-presentation").click();
  await expect(page.getByTestId("presentation")).toBeVisible({ timeout: 20_000 });
  expect(new URL(page.url()).pathname).toBe("/presentation");
});

// The tour has to put the interface into the state each step describes, or it
// teaches the wrong thing. Step 5 is the agent, so the agent panel must be open.
test("le tour se joue au premier accès et ouvre ce qu'il décrit", async ({ page }) => {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(String(e)));

  await asDeveloper(page, false);
  await workshop(page);

  const pop = page.locator(".driver-popover");
  await expect(pop).toBeVisible({ timeout: 15_000 });
  await expect(pop).toContainText(/1 of \d+/);

  for (let i = 0; i < 4; i++) {
    await page.locator(".driver-popover-next-btn").click();
    await page.waitForTimeout(350);
  }
  await expect(pop).toContainText("5 of");
  // The agent tab is not merely outlined — it is open.
  await expect(page.getByTestId("rp-chat")).toHaveClass(/on/);

  expect(errs, errs.join(" | ")).toHaveLength(0);
});

test("le tour ne revient pas tout seul, mais le bouton le rejoue", async ({ page }) => {
  await asDeveloper(page, true);
  await workshop(page);
  await page.waitForTimeout(800);
  await expect(page.locator(".driver-popover")).toHaveCount(0);

  await page.getByTestId("open-tour").click();
  await expect(page.locator(".driver-popover")).toBeVisible({ timeout: 15_000 });
});
