import { expect, test } from "@playwright/test";

// Real-auth mode (COBOL_EXPLORER_AUTH=jwt) driven from the front end: the server
// advertises that a login is required, so nothing of the estate is fetched before
// sign-in and the issued token rides on every later call. The server side of this
// contract is covered by server/tests/test_auth.py.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem("cobol-explorer-identity");
    localStorage.removeItem("cobol-explorer-token");
  });
  await page.route("**/api/auth/config", (route) =>
    route.fulfill({ json: { mode: "jwt", required: true, roles: ["guest", "dev"] } })
  );
});

const mockLogin = (page: any) =>
  page.route("**/api/login", async (route: any) => {
    const { username, password } = JSON.parse(route.request().postData() || "{}");
    if (username === "amine" && password === "demo")
      return route.fulfill({ json: { token: "signed.jwt.token", name: "Amine", role: "dev", expires_in: 28800 } });
    return route.fulfill({ status: 401, json: { detail: "identifiants invalides" } });
  });

test("authentification requise : le workspace reste fermé tant qu'on n'est pas connecté", async ({ page }) => {
  const estateCalls: string[] = [];
  await page.route("**/api/graph", (route) => { estateCalls.push(route.request().url()); return route.continue(); });
  await page.goto("/");
  await expect(page.getByTestId("login-submit")).toBeVisible();
  await expect(page.locator(".ov-stats")).toHaveCount(0);
  expect(estateCalls).toHaveLength(0);
});

test("mauvais identifiants : message d'erreur, pas de session", async ({ page }) => {
  await mockLogin(page);
  await page.goto("/");
  await page.getByTestId("login-user").fill("amine");
  await page.getByTestId("login-password").fill("wrong");
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("login-error")).toContainText(/invalide/i);
  expect(await page.evaluate(() => localStorage.getItem("cobol-explorer-token"))).toBeNull();
});

test("connexion : le jeton est stocké et accompagne les appels suivants", async ({ page }) => {
  await mockLogin(page);
  const authorized: (string | undefined)[] = [];
  await page.route("**/api/graph", (route) => {
    authorized.push(route.request().headers()["authorization"]);
    return route.continue();
  });
  await page.goto("/");
  await page.getByTestId("login-user").fill("amine");
  await page.getByTestId("login-password").fill("demo");
  await page.getByTestId("login-submit").click();

  await expect(page.locator(".ov-stats")).toContainText(/programs/i);
  await expect(page.getByTestId("identity")).toContainText("Amine");
  expect(await page.evaluate(() => localStorage.getItem("cobol-explorer-token"))).toBe("signed.jwt.token");
  expect(authorized[0]).toBe("Bearer signed.jwt.token");
});
