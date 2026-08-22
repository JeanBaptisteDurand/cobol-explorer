import { expect, test } from "@playwright/test";

// Seed an identity so the onboarding modal doesn't block the workspace.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("cobol-explorer-identity", JSON.stringify({ name: "test", role: "Developer" }));
    // The guided tour runs on a first visit and its overlay swallows clicks.
    // These tests are about the workshop, not the first run, so they arrive as
    // someone who has already seen it. tour-presentation.spec.ts covers the tour.
    localStorage.setItem("cobol-explorer-tour-seen", "1");
  });
});

test("l'aperçu oriente : stats + copybooks critiques (fan-in)", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ov-stats")).toContainText(/programs/i);
  await expect(page.locator('[data-testid="fanin-row"]').first()).toBeVisible();
});

test("ouvrir un copybook : code affiché + inspecteur 'utilisé par'", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("search").fill("LGPOLICY");
  await page.getByTestId("search").press("Enter");
  await expect(page.locator(".cm-editor")).toContainText("POLICY");
  await expect(page.locator(".panel")).toContainText(/Used by/i);
});

test("l'inspecteur analyse l'impact (groundé + cité)", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("search").fill("LGPOLICY");
  await page.getByTestId("search").press("Enter");
  await page.getByRole("button", { name: /See impact/ }).click();
  await expect(page.locator(".panel")).toContainText(/program/);
  await expect(page.locator(".panel")).toContainText(/COPY LGPOLICY/i);
});

test("version active -> panneau Modifs (cowork)", async ({ page }) => {
  await page.goto("/");
  const v = page.locator('[data-testid="version-row"]').first();
  if ((await v.count()) > 0) {
    await v.click();
    await expect(page.getByTestId("changes-impact")).toBeVisible();
    await expect(page.locator('[data-testid="chg-file"]').first()).toBeVisible();
  }
});

test("gap : transactions CICS + fichiers VSAM dans l'arbre", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".sidebar")).toContainText("CICS Transactions");
  await expect(page.locator(".sidebar")).toContainText("VSAM Files");
});

test("graphe : clic node -> inspecteur, 'ouvrir le code' -> onglet code au centre", async ({ page }) => {
  await page.goto("/");
  await page.locator('.tab:has-text("Graph")').click();
  // Single click selects the node (inspector populates, graph tab stays open).
  await page.locator('.rf-node:has-text("LGPOLICY")').first().click();
  await expect(page.locator(".panel")).toContainText(/Used by/i);
  // Opening the source spawns a code tab in the center editor.
  await page.getByTestId("graph-open-code").click();
  await expect(page.locator(".editor .tabbar")).toContainText("LGPOLICY");
  await expect(page.locator(".cm-editor")).toContainText("POLICY");
});

test("barre d'activité : un seul bouton actif à la fois (jamais collé)", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".abtn.on")).toHaveCount(1); // Explorateur
  await page.locator('[data-ab="graph"]').click();
  await expect(page.locator(".abtn.on")).toHaveCount(1); // Graphe seul
  await expect(page.locator('[data-ab="graph"]')).toHaveClass(/on/);
  await page.locator('[data-ab="spark"]').click(); // ouvre l'agent, n'ajoute pas d'état actif
  await expect(page.locator(".abtn.on")).toHaveCount(1);
});

test("bouton branche : ouvre les Modifs avec la version (pas un panneau vide)", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-ab="branch"]').click();
  await expect(page.getByTestId("rp-changes")).toHaveClass(/on/);
  await expect(page.getByTestId("changes-impact")).toBeVisible();
});

test("agent : la conversation survit au changement de panneau (pas de re-seed)", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("rp-chat").click();
  await page.getByTestId("chat-input").fill("brouillon en cours de saisie");
  await page.getByTestId("rp-inspector").click(); // on quitte l'agent
  await page.getByTestId("rp-chat").click(); // on revient
  // Si ChatPanel était démonté/remonté, la saisie serait perdue.
  await expect(page.getByTestId("chat-input")).toHaveValue("brouillon en cours de saisie");
});

test("split view : deux fichiers côte à côte (programme + copybook)", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("search").fill("LGIPOL01");
  await page.getByTestId("search").press("Enter");
  await expect(page.locator(".editorwrap .editor")).toHaveCount(1);
  await page.getByTestId("split-editor").click();
  await expect(page.locator(".editorwrap .editor")).toHaveCount(2);
  // The new (active) pane opens the copybook; the first pane keeps the program.
  await page.getByTestId("search").fill("LGPOLICY");
  await page.getByTestId("search").press("Enter");
  const panes = page.locator(".editorwrap .editor");
  await expect(panes.nth(0).locator(".tabbar")).toContainText("LGIPOL01");
  await expect(panes.nth(1)).toContainText("LGPOLICY");
});

test("graphe : le mode focus réduit au voisinage du nœud", async ({ page }) => {
  await page.goto("/");
  // Select through the search box rather than by clicking the canvas: node positions
  // depend on the layout, so a click target can end up under the floating panel.
  await page.getByTestId("search").fill("LGIPOL01");
  await page.getByTestId("search").press("Enter");
  await page.locator('.tab:has-text("Graph")').click();
  const before = await page.locator(".rf-node").count();
  await page.getByTestId("graph-focus").click();
  await expect(page.locator(".rf-node")).not.toHaveCount(before);
  const after = await page.locator(".rf-node").count();
  expect(after).toBeLessThan(before);
});

test("graphe : 'voir l'impact' d'un copybook surligne le rayon d'impact", async ({ page }) => {
  await page.goto("/");
  await page.locator('.tab:has-text("Graph")').click();
  await page.locator('.rf-node:has-text("LGPOLICY")').first().click();
  await page.getByTestId("graph-impact").click();
  await expect(page.getByTestId("graph-impact")).toContainText(/impacted — clear/);
});

test("palette ⌘P : recherche floue -> ouvre l'entité", async ({ page }) => {
  await page.goto("/");
  await page.locator(".kbd").click();
  await page.getByTestId("palette-input").fill("LGPOLIC");
  await expect(page.getByTestId("palette-row").first()).toContainText("LGPOLICY");
  await page.getByTestId("palette-row").first().click();
  await expect(page.locator(".editorwrap .tabbar")).toContainText("LGPOLICY");
});

test("réponse de l'agent en Markdown avec citation cliquable (mock SSE)", async ({ page }) => {
  // Stub the SSE stream so this stays fast and deterministic (no LLM).
  await page.route("**/api/ask", async (route) => {
    const body = [
      "event: trace",
      'data: {"tool":"read_source_lines","input":{"file":"lgipol01.cbl"},"output_summary":"1 ligne","sources":["lgipol01.cbl:55"]}',
      "",
      "event: answer",
      'data: {"text":"Le programme lit **LGPOLICY**.\\n- copie: lgpolicy.cpy\\n- preuve: lgipol01.cbl:55"}',
      "",
    ].join("\r\n");
    await route.fulfill({ status: 200, headers: { "Content-Type": "text/event-stream" }, body });
  });
  await page.goto("/");
  await page.getByTestId("rp-chat").click();
  await page.getByTestId("chat-input").fill("Que fait LGIPOL01 ?");
  await page.getByTestId("chat-send").click();
  // Markdown list rendered + a clickable citation.
  await expect(page.locator(".md-ul")).toBeVisible();
  const cite = page.locator(".md-cite", { hasText: "lgipol01.cbl:55" });
  await expect(cite).toBeVisible();
  await cite.click();
  await expect(page.locator(".editorwrap .tabbar")).toContainText("LGIPOL01");
});

test("aperçu : carte qualité (détection de code mort)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("quality-card")).toContainText(/unreferenced copybooks/i);
});

test("inspecteur : impact au niveau champ d'un copybook", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("search").fill("LGPOLICY");
  await page.getByTestId("search").press("Enter");
  await expect(page.getByTestId("field-impact")).toContainText(/field-level/i);
  await expect(page.getByTestId("field-impact")).toContainText("WS-CUSTOMER-LEN");
});

test("palette : recherche sémantique Granite (mock)", async ({ page }) => {
  await page.route("**/api/search**", (route) =>
    route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ query: "x", results: [{ id: "pgm:LGSTSQ", label: "LGSTSQ", file: "lgstsq.cbl", score: 0.63 }], engine: "granite" }),
    })
  );
  await page.goto("/");
  await page.locator(".kbd").click();
  await page.getByTestId("palette-input").fill("logging");
  await expect(page.getByTestId("palette-sem").first()).toContainText("LGSTSQ");
});

test("panneau audit : journal immuable + badge d'intégrité", async ({ page }) => {
  await page.route("**/api/audit**", (route) =>
    route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ chain_intact: true, entries: [{ ts: "2026-07-08T01:00:00Z", actor: "Alice", role: "dev", action: "ask", target: "LGPOLICY", result: "granted" }] }),
    })
  );
  await page.goto("/");
  await page.getByTestId("rp-audit").click();
  await expect(page.getByTestId("audit-chain")).toContainText(/verified/);
  await expect(page.getByTestId("audit-list")).toContainText("Alice");
});

test("merge-gate : confirmation d'impact avant fusion", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-ab="branch"]').click(); // ouvre Modifs avec la version brouillon
  const btn = page.getByTestId("merge-btn");
  if ((await btn.count()) > 0) {
    await expect(btn).toContainText("Merge");
    if (await btn.isEnabled()) {
      // branche à jour -> le merge-gate demande confirmation
      await btn.click();
      await expect(page.getByTestId("merge-gate")).toBeVisible();
      await expect(btn).toContainText("Confirm");
    } else {
      // branche en retard -> la fusion est bloquée avec l'explication
      await expect(btn).toContainText("import main");
      await expect(page.getByTestId("sync-btn")).toBeVisible();
    }
  }
});

test("onboarding au premier lancement -> identité", async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem("cobol-explorer-identity"));
  await page.goto("/");
  await page.getByTestId("onb-name").fill("Alice");
  await page.getByTestId("onb-start").click();
  await expect(page.getByTestId("identity")).toContainText("Alice");
});

test("l'agent répond avec une trace @slow", async ({ page }) => {
  test.skip(!!process.env.PWTEST_SKIP_LLM, "LLM skipped");
  test.setTimeout(150_000);
  await page.goto("/");
  await page.getByTestId("rp-chat").click();
  await page.getByTestId("chat-input").fill("Qui appelle le programme LGIPDB01 ?");
  await page.getByTestId("chat-send").click();
  await expect(page.getByTestId("trace")).toContainText("graph_lookup", { timeout: 130_000 });
});

test("registre de version : écrit à la demande, relisible ensuite", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-ab="branch"]').click();
  const card = page.getByTestId("cs-summary");
  await expect(card).toBeVisible();
  await page.getByTestId("cs-summarize").click();
  // Le registre nomme le fichier et chiffre l'impact — jamais une phrase vide.
  await expect(card).toContainText(/file\(s\) edited|program\(s\)|No file was edited/i, { timeout: 60000 });
});
