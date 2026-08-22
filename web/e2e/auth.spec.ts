import { expect, test } from "@playwright/test";

// Public front door + real-auth mode (COBOL_EXPLORER_AUTH=jwt), driven from the
// browser: a visitor sees the landing page, nothing of the estate is fetched before
// sign-in, and the token issued at sign-in rides on every later call. The server
// side of this contract is covered by server/tests/test_auth.py.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem("cobol-explorer-identity");
    localStorage.removeItem("cobol-explorer-token");
  });
  await page.route("**/api/auth/config", (route) =>
    route.fulfill({ json: { mode: "jwt", required: true, roles: ["dev", "risk", "auditor"], email_verification: false, ibm_sign_in: false } })
  );
});

const mockAuth = (page: any) => {
  page.route("**/api/login", async (route: any) => {
    const { username, password } = JSON.parse(route.request().postData() || "{}");
    if (username === "amine" && password === "demo")
      return route.fulfill({ json: { token: "signed.jwt.token", name: "Amine", role: "dev", expires_in: 28800 } });
    return route.fulfill({ status: 401, json: { detail: "identifiants invalides" } });
  });
  return page.route("**/api/signup", async (route: any) => {
    const { username, password, display, role } = JSON.parse(route.request().postData() || "{}");
    if ((password || "").length < 8)
      return route.fulfill({ status: 400, json: { detail: "password too short: 8 characters minimum" } });
    return route.fulfill({ json: { token: "new.jwt.token", name: display || username, role, expires_in: 28800 } });
  });
};

test("the public home page pitches the product without exposing any of the estate", async ({ page }) => {
  const estateCalls: string[] = [];
  await page.route("**/api/graph", (route) => { estateCalls.push(route.request().url()); return route.continue(); });

  await page.goto("/");
  await expect(page.getByTestId("landing")).toBeVisible();
  await expect(page.getByTestId("hero-section").locator("h1")).toContainText(/estate|proof/i);
  await expect(page.getByTestId("ibm-section")).toContainText("IBM Granite");
  await expect(page.getByTestId("bob-section")).toContainText("graph_lookup");
  await expect(page.getByTestId("hero-section")).toBeVisible();
  expect(estateCalls).toHaveLength(0);
});

test("the landing opens the auth panel on the right tab", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("hero-signup").click();
  await expect(page.getByTestId("auth-submit")).toContainText(/create account/i);
  await expect(page.getByTestId("auth-display")).toBeVisible();

  await page.getByTestId("tab-login").click();
  await expect(page.getByTestId("auth-submit")).toContainText(/sign in/i);
  await expect(page.getByTestId("auth-display")).toHaveCount(0);
});

test("wrong credentials: an error message, and no session", async ({ page }) => {
  await mockAuth(page);
  await page.goto("/");
  await page.getByTestId("nav-signin").click();
  await page.getByTestId("auth-user").fill("amine");
  await page.getByTestId("auth-password").fill("wrong");
  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("auth-error")).toContainText(/invalide/i);
  expect(await page.evaluate(() => localStorage.getItem("cobol-explorer-token"))).toBeNull();
});

test("sign-in: the token is stored and rides along on later calls", async ({ page }) => {
  await mockAuth(page);
  const authorized: (string | undefined)[] = [];
  await page.route("**/api/graph", (route) => {
    authorized.push(route.request().headers()["authorization"]);
    return route.continue();
  });

  await page.goto("/");
  await page.getByTestId("nav-signin").click();
  await page.getByTestId("auth-user").fill("amine");
  await page.getByTestId("auth-password").fill("demo");
  await page.getByTestId("auth-submit").click();

  await expect(page.locator(".ov-stats")).toContainText(/programs/i);
  await expect(page.getByTestId("identity")).toContainText("Amine");
  expect(await page.evaluate(() => localStorage.getItem("cobol-explorer-token"))).toBe("signed.jwt.token");
  expect(authorized[0]).toBe("Bearer signed.jwt.token");
});

test("sign-up: the server rejects the password and the reason is shown", async ({ page }) => {
  await mockAuth(page);
  await page.goto("/");
  await page.getByTestId("nav-signup").click();
  await page.getByTestId("auth-user").fill("nadia");
  await page.getByTestId("auth-password").fill("short");
  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("auth-error")).toContainText(/8 characters/i);
  await expect(page.getByTestId("landing")).toBeVisible();
});

test("sign-up: the chosen role reaches the server and opens the workshop", async ({ page }) => {
  await mockAuth(page);
  let sent: any = null;
  await page.route("**/api/signup", async (route) => {
    sent = JSON.parse(route.request().postData() || "{}");
    return route.fulfill({ json: { token: "new.jwt.token", name: "Nadia", role: sent.role, expires_in: 28800 } });
  });

  await page.goto("/");
  await page.getByTestId("foot-signup").click();
  await page.getByTestId("auth-user").fill("nadia");
  await page.getByTestId("auth-display").fill("Nadia");
  await page.getByTestId("auth-password").fill("correct-horse");
  await page.getByTestId("role-risk").click();
  await page.getByTestId("auth-submit").click();

  await expect(page.locator(".ov-stats")).toBeVisible();
  expect(sent).toMatchObject({ username: "nadia", display: "Nadia", role: "risk" });
  await expect(page.getByTestId("identity")).toContainText("Nadia");
});


test("sign-up with verification: the email is asked for and the session is held back", async ({ page }) => {
  await page.route("**/api/auth/config", (route) =>
    route.fulfill({ json: { mode: "jwt", required: true, roles: ["dev"], email_verification: true } })
  );
  let sent: any = null;
  await page.route("**/api/signup", async (route) => {
    sent = JSON.parse(route.request().postData() || "{}");
    return route.fulfill({ json: { verification_required: true, email: sent.email, name: "Nadia", role: "dev" } });
  });

  await page.goto("/");
  await page.getByTestId("nav-signup").click();
  await expect(page.getByTestId("auth-email")).toBeVisible();
  await page.getByTestId("auth-user").fill("nadia");
  await page.getByTestId("auth-email").fill("nadia@example.com");
  await page.getByTestId("auth-display").fill("Nadia");
  await page.getByTestId("auth-password").fill("correct-horse");
  await page.getByTestId("auth-submit").click();

  await expect(page.getByTestId("auth-sent")).toContainText("nadia@example.com");
  expect(sent.email).toBe("nadia@example.com");
  // No session until the address is confirmed.
  expect(await page.evaluate(() => localStorage.getItem("cobol-explorer-token"))).toBeNull();
  await expect(page.getByTestId("landing")).toBeVisible();
});

test("returning from the confirmation link: the banner states the outcome", async ({ page }) => {
  await page.goto("/?verified=1");
  await expect(page.getByTestId("verified-banner")).toContainText("confirmed");
  await page.goto("/?verified=expired");
  await expect(page.getByTestId("verified-banner")).toContainText(/invalid|expired/i);
});


test("“Continue with IBM” only appears when the deployment is wired for it", async ({ page }) => {
  await page.route("**/api/auth/config", (r) =>
    r.fulfill({ json: { mode: "jwt", required: true, roles: ["dev"], email_verification: false, ibm_sign_in: true } }));
  await page.goto("/");
  await page.getByTestId("nav-signin").click();
  const ibm = page.getByTestId("auth-ibm");
  await expect(ibm).toBeVisible();
  await expect(ibm).toHaveAttribute("href", "/api/auth/ibm");
});

test("federated return: the session arrives in the fragment and the URL is cleaned", async ({ page }) => {
  await page.route("**/api/auth/config", (r) =>
    r.fulfill({ json: { mode: "jwt", required: true, roles: ["dev"], email_verification: false, ibm_sign_in: true } }));
  await page.goto("/#token=fragment.jwt.token&name=Jean-Baptiste&role=risk");

  await expect(page.locator(".ov-stats")).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId("identity")).toContainText("Jean-Baptiste");
  expect(await page.evaluate(() => localStorage.getItem("cobol-explorer-token"))).toBe("fragment.jwt.token");
  // The token must not linger in the address bar.
  expect(await page.evaluate(() => window.location.hash)).toBe("");
});
