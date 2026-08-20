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
      return route.fulfill({ status: 400, json: { detail: "mot de passe trop court : 8 caractères minimum" } });
    return route.fulfill({ json: { token: "new.jwt.token", name: display || username, role, expires_in: 28800 } });
  });
};

test("la page d'accueil publique présente le produit sans rien exposer du patrimoine", async ({ page }) => {
  const estateCalls: string[] = [];
  await page.route("**/api/graph", (route) => { estateCalls.push(route.request().url()); return route.continue(); });

  await page.goto("/");
  await expect(page.getByTestId("landing")).toBeVisible();
  await expect(page.locator(".lp-hero h1")).toContainText(/code/i);
  await expect(page.getByTestId("ibm-section")).toContainText("IBM Granite");
  await expect(page.getByTestId("bob-section")).toContainText("graph_lookup");
  await expect(page.locator(".lp-num").first()).toBeVisible();
  expect(estateCalls).toHaveLength(0);
});

test("la landing ouvre le panneau d'authentification sur le bon onglet", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("hero-signup").click();
  await expect(page.getByTestId("auth-submit")).toContainText(/create account/i);
  await expect(page.getByTestId("auth-display")).toBeVisible();

  await page.getByTestId("tab-login").click();
  await expect(page.getByTestId("auth-submit")).toContainText(/sign in/i);
  await expect(page.getByTestId("auth-display")).toHaveCount(0);
});

test("mauvais identifiants : message d'erreur, pas de session", async ({ page }) => {
  await mockAuth(page);
  await page.goto("/");
  await page.getByTestId("nav-signin").click();
  await page.getByTestId("auth-user").fill("amine");
  await page.getByTestId("auth-password").fill("wrong");
  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("auth-error")).toContainText(/invalide/i);
  expect(await page.evaluate(() => localStorage.getItem("cobol-explorer-token"))).toBeNull();
});

test("connexion : le jeton est stocké et accompagne les appels suivants", async ({ page }) => {
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

test("inscription : mot de passe refusé par le serveur, le motif est affiché", async ({ page }) => {
  await mockAuth(page);
  await page.goto("/");
  await page.getByTestId("nav-signup").click();
  await page.getByTestId("auth-user").fill("nadia");
  await page.getByTestId("auth-password").fill("short");
  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("auth-error")).toContainText(/8 caractères/i);
  await expect(page.getByTestId("landing")).toBeVisible();
});

test("inscription : le rôle choisi part au serveur et ouvre l'atelier", async ({ page }) => {
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


test("inscription avec vérification : l'e-mail est demandé et la session est retenue", async ({ page }) => {
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
  // Aucune session tant que l'adresse n'est pas confirmée.
  expect(await page.evaluate(() => localStorage.getItem("cobol-explorer-token"))).toBeNull();
  await expect(page.getByTestId("landing")).toBeVisible();
});

test("retour du lien de confirmation : la bannière annonce le résultat", async ({ page }) => {
  await page.goto("/?verified=1");
  await expect(page.getByTestId("verified-banner")).toContainText("confirmed");
  await page.goto("/?verified=expired");
  await expect(page.getByTestId("verified-banner")).toContainText(/invalid|expired/i);
});


test("« Continue with IBM » n'apparaît que si le déploiement est câblé", async ({ page }) => {
  await page.route("**/api/auth/config", (r) =>
    r.fulfill({ json: { mode: "jwt", required: true, roles: ["dev"], email_verification: false, ibm_sign_in: true } }));
  await page.goto("/");
  await page.getByTestId("nav-signin").click();
  const ibm = page.getByTestId("auth-ibm");
  await expect(ibm).toBeVisible();
  await expect(ibm).toHaveAttribute("href", "/api/auth/ibm");
});

test("retour fédéré : la session arrive par le fragment et l'URL est nettoyée", async ({ page }) => {
  await page.route("**/api/auth/config", (r) =>
    r.fulfill({ json: { mode: "jwt", required: true, roles: ["dev"], email_verification: false, ibm_sign_in: true } }));
  await page.goto("/#token=fragment.jwt.token&name=Jean-Baptiste&role=risk");

  await expect(page.locator(".ov-stats")).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId("identity")).toContainText("Jean-Baptiste");
  expect(await page.evaluate(() => localStorage.getItem("cobol-explorer-token"))).toBe("fragment.jwt.token");
  // Le jeton ne doit pas rester dans la barre d'adresse.
  expect(await page.evaluate(() => window.location.hash)).toBe("");
});
