import { expect, test } from "@playwright/test";

// A refusal must be shown, never fatal. Reading the audit log is reserved to the
// compliance and auditor roles, and a federated sign-in lands on `risk` - so this
// 403 is a path a real visitor takes, not an edge case.
//
// It used to take the whole application down: fetch does not reject on an HTTP
// error, the shared GET helper returned the error body as if it were data, and
// the panel reached into .entries of an object that had none.
test("a refused audit read is shown and does not take the app down", async ({ page }) => {
  const crashes: string[] = [];
  page.on("pageerror", (e) => crashes.push(String(e)));

  await page.addInitScript(() => {
    localStorage.setItem("cobol-explorer-identity", JSON.stringify({ name: "jb", role: "Risk" }));
    localStorage.setItem("cobol-explorer-tour-seen", "1");   // the tour's overlay would eat the clicks
  });
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
test("a refusal on another endpoint does not take the app down either", async ({ page }) => {
  const crashes: string[] = [];
  page.on("pageerror", (e) => crashes.push(String(e)));

  await page.addInitScript(() => {
    localStorage.setItem("cobol-explorer-identity", JSON.stringify({ name: "jb", role: "Risk" }));
    localStorage.setItem("cobol-explorer-tour-seen", "1");   // the tour's overlay would eat the clicks
  });
  await page.route("**/api/quality**", (r) =>
    r.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ detail: "forbidden" }) }));

  await page.goto("/");
  await expect(page.locator(".ov-stats")).toContainText(/programs/i, { timeout: 30_000 });
  await expect(page.locator(".app")).toBeVisible();
  expect(crashes, crashes.join(" | ")).toHaveLength(0);
});

// An expired token makes every gated call 401 at once. That must end the session
// cleanly - back to the front door, with a reason - rather than reject into the
// console and leave the workshop sitting on data it can no longer refresh.
test("an expired token ends the session instead of rejecting in silence", async ({ page }) => {
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

// ── One-click role switching ─────────────────────────────────────────────────
// The profile dialog under the badge: with a signed session the role picker is
// gone (it changed a label, never a right), and switching means a REAL login as
// a published demo account - new token, server re-arbitrates.
test("the profile dialog switches role through a real login, not a label", async ({ page }) => {
  // Init scripts re-run on every navigation - the switch ends in a reload, so
  // seeding unconditionally would overwrite the very session the test asserts.
  await page.addInitScript(() => {
    if (!localStorage.getItem("cobol-explorer-token")) {
      localStorage.setItem("cobol-explorer-identity", JSON.stringify({ name: "Jean-Baptiste Durand", role: "risk" }));
      localStorage.setItem("cobol-explorer-token", "x." + btoa(JSON.stringify({ exp: 9999999999 })) + ".y");
    }
    localStorage.setItem("cobol-explorer-tour-seen", "1");
  });
  await page.unrouteAll();
  await page.route("**/api/auth/config", (route) =>
    route.fulfill({ json: { mode: "jwt", required: true, roles: ["dev"], email_verification: false, ibm_sign_in: false,
      demo_accounts: [
        { user: "amine", display: "Amine", role: "dev" },
        { user: "marc", display: "Marc", role: "auditor" },
      ] } }));
  const logins: any[] = [];
  await page.route("**/api/login", (route) => {
    logins.push(JSON.parse(route.request().postData() || "{}"));
    return route.fulfill({ json: { token: "marc.jwt.token", name: "Marc", role: "auditor", expires_in: 28800 } });
  });

  await page.goto("/");
  await expect(page.locator(".ov-stats")).toContainText(/programs/i, { timeout: 30_000 });
  await page.getByTestId("identity").click();

  // No self-served role picker under a signed session - the facts, and accounts.
  await expect(page.getByTestId("onb-locked-note")).toBeVisible();
  await expect(page.getByTestId("onb-name")).toHaveCount(0);

  await page.getByTestId("onb-switch-auditor").click();
  // The click fires an async login, THEN a reload - poll the stored session
  // rather than racing the navigation.
  // The reload destroys the evaluation context mid-poll - swallow that and retry.
  await expect.poll(async () => {
    try { return await page.evaluate(() => localStorage.getItem("cobol-explorer-token")); }
    catch { return null; }
  }).toBe("marc.jwt.token");
  expect(logins).toEqual([{ username: "marc", password: "demo" }]);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("cobol-explorer-identity") || "{}"));
  expect(stored).toEqual({ name: "Marc", role: "auditor" });

  // And the road back: the REAL session was stashed before the switch, the
  // dialog offers it, one click restores it - trying roles is a round trip.
  await page.getByTestId("identity").click();
  await expect(page.getByTestId("onb-return-home")).toContainText("Jean-Baptiste Durand");
  await page.getByTestId("onb-return-home").click();
  await expect.poll(async () => {
    try { return (await page.evaluate(() => JSON.parse(localStorage.getItem("cobol-explorer-identity") || "{}"))).name; }
    catch { return null; }
  }).toBe("Jean-Baptiste Durand");
  expect(await page.evaluate(() => localStorage.getItem("cobol-explorer-home"))).toBeNull();
});
