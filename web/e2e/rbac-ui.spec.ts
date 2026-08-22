import { expect, test } from "@playwright/test";

// A refusal must be shown, never fatal. Reading the audit log is reserved to the
// compliance and auditor roles, and a federated sign-in lands on `risk` — so this
// 403 is a path a real visitor takes, not an edge case.
//
// It used to take the whole application down: fetch does not reject on an HTTP
// error, the shared GET helper returned the error body as if it were data, and
// the panel reached into .entries of an object that had none.
test("un refus d'audit s'affiche et ne fait pas tomber l'application", async ({ page }) => {
  const crashes: string[] = [];
  page.on("pageerror", (e) => crashes.push(String(e)));

  await page.addInitScript(() =>
    localStorage.setItem("cobol-explorer-identity", JSON.stringify({ name: "jb", role: "Risk" })));
  await page.route("**/api/audit**", (r) =>
    r.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ detail: "forbidden" }) }));

  await page.goto("/");
  await expect(page.locator(".ov-stats")).toContainText(/programs/i, { timeout: 30_000 });
  await page.getByTestId("rp-audit").click();

  await expect(page.getByTestId("audit-denied")).toBeVisible();
  await expect(page.getByTestId("audit-chain")).toContainText(/not your role/i);
  // The shell is still mounted: no black page.
  await expect(page.locator(".app")).toBeVisible();
  expect(crashes, crashes.join(" | ")).toHaveLength(0);
});

// The same helper serves twelve endpoints, so the fix has to hold for any of them.
test("un refus sur un autre endpoint ne fait pas tomber l'application non plus", async ({ page }) => {
  const crashes: string[] = [];
  page.on("pageerror", (e) => crashes.push(String(e)));

  await page.addInitScript(() =>
    localStorage.setItem("cobol-explorer-identity", JSON.stringify({ name: "jb", role: "Risk" })));
  await page.route("**/api/quality**", (r) =>
    r.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ detail: "forbidden" }) }));

  await page.goto("/");
  await expect(page.locator(".ov-stats")).toContainText(/programs/i, { timeout: 30_000 });
  await expect(page.locator(".app")).toBeVisible();
  expect(crashes, crashes.join(" | ")).toHaveLength(0);
});

// An expired token makes every gated call 401 at once. That must end the session
// cleanly — back to the front door, with a reason — rather than reject into the
// console and leave the workshop sitting on data it can no longer refresh.
test("un jeton expiré termine la session au lieu de rejeter en silence", async ({ page }) => {
  const rejections: string[] = [];
  page.on("pageerror", (e) => rejections.push(String(e)));

  await page.addInitScript(() => {
    localStorage.setItem("cobol-explorer-token", "expired.jwt.token");
    localStorage.setItem("cobol-explorer-identity", JSON.stringify({ name: "jb", role: "Developer" }));
  });
  await page.route("**/api/auth/config", (r) =>
    r.fulfill({ json: { mode: "jwt", required: true, roles: ["dev"], email_verification: false, ibm_sign_in: false } }));
  for (const ep of ["graph", "changesets", "systems"]) {
    await page.route(`**/api/${ep}**`, (r) =>
      r.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ detail: "token expired" }) }));
  }

  await page.goto("/");

  // Back at the front door, told why, and the dead token is gone.
  await expect(page.getByTestId("landing")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("verified-banner")).toContainText(/session expired/i);
  expect(await page.evaluate(() => localStorage.getItem("cobol-explorer-token"))).toBeNull();
  expect(rejections, rejections.join(" | ")).toHaveLength(0);
});
