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

test("the overview orients: statistics and the critical copybooks by fan-in", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ov-stats")).toContainText(/programs/i);
  await expect(page.locator('[data-testid="fanin-row"]').first()).toBeVisible();
});

test("opening a copybook: the code shows and the inspector lists what uses it", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("search").fill("LGPOLICY");
  await page.getByTestId("search").press("Enter");
  await expect(page.locator(".cm-editor")).toContainText("POLICY");
  await expect(page.locator(".panel")).toContainText(/Used by/i);
});

test("the inspector analyses impact, grounded and cited", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("search").fill("LGPOLICY");
  await page.getByTestId("search").press("Enter");
  await page.getByRole("button", { name: /See impact/ }).click();
  await expect(page.locator(".panel")).toContainText(/program/);
  await expect(page.locator(".panel")).toContainText(/COPY LGPOLICY/i);
});

test("an active version opens the Changes panel", async ({ page }) => {
  await page.goto("/");
  const v = page.locator('[data-testid="version-row"]').first();
  if ((await v.count()) > 0) {
    await v.click();
    await expect(page.getByTestId("changes-impact")).toBeVisible();
    await expect(page.locator('[data-testid="chg-file"]').first()).toBeVisible();
  }
});

test("CICS transactions and VSAM files appear in the tree", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".sidebar")).toContainText("CICS Transactions");
  await expect(page.locator(".sidebar")).toContainText("VSAM Files");
});

test("graph: clicking a node fills the inspector, and opening the code adds a centre tab", async ({ page }) => {
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

test("activity bar: one button active at a time, never stuck", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".abtn.on")).toHaveCount(1); // Explorateur
  await page.locator('[data-ab="graph"]').click();
  await expect(page.locator(".abtn.on")).toHaveCount(1); // Graphe seul
  await expect(page.locator('[data-ab="graph"]')).toHaveClass(/on/);
  await page.locator('[data-ab="spark"]').click(); // opens the agent; it adds no active state
  await expect(page.locator(".abtn.on")).toHaveCount(1);
});

test("the branch button opens Changes on the version, not an empty panel", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-ab="branch"]').click();
  await expect(page.getByTestId("rp-changes")).toHaveClass(/on/);
  await expect(page.getByTestId("changes-impact")).toBeVisible();
});

test("agent: the conversation survives a panel switch and is not re-seeded", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("rp-chat").click();
  await page.getByTestId("chat-input").fill("brouillon en cours de saisie");
  await page.getByTestId("rp-inspector").click(); // on quitte l'agent
  await page.getByTestId("rp-chat").click(); // on revient
  // If ChatPanel were unmounted and remounted, the typed input would be lost.
  await expect(page.getByTestId("chat-input")).toHaveValue("brouillon en cours de saisie");
});

test("split view: two files side by side, a program and a copybook", async ({ page }) => {
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

test("graph: focus mode reduces the view to the node's neighbourhood", async ({ page }) => {
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

test("graph: asking for a copybook's impact lights up the impact radius", async ({ page }) => {
  await page.goto("/");
  await page.locator('.tab:has-text("Graph")').click();
  await page.locator('.rf-node:has-text("LGPOLICY")').first().click();
  await page.getByTestId("graph-impact").click();
  await expect(page.getByTestId("graph-impact")).toContainText(/impacted — clear/);
});

test("palette ⌘P: a fuzzy search opens the entity", async ({ page }) => {
  await page.goto("/");
  await page.locator(".kbd").click();
  await page.getByTestId("palette-input").fill("LGPOLIC");
  await expect(page.getByTestId("palette-row").first()).toContainText("LGPOLICY");
  await page.getByTestId("palette-row").first().click();
  await expect(page.locator(".editorwrap .tabbar")).toContainText("LGPOLICY");
});

test("the agent's answer renders as Markdown with a clickable citation (mocked SSE)", async ({ page }) => {
  // Stub the SSE stream so this stays fast and deterministic (no LLM).
  await page.route("**/api/ask", async (route) => {
    const body = [
      "event: trace",
      'data: {"tool":"read_source_lines","input":{"file":"lgipol01.cbl"},"output_summary":"1 ligne","sources":["lgipol01.cbl:55"]}',
      "",
      "event: answer",
      'data: {"text":"The program reads **LGPOLICY**.\\n- copies: lgpolicy.cpy\\n- proof: lgipol01.cbl:55"}',
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

test("overview: the quality card reports dead code", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("quality-card")).toContainText(/unreferenced copybooks/i);
});

test("inspector: field-level impact of a copybook", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("search").fill("LGPOLICY");
  await page.getByTestId("search").press("Enter");
  await expect(page.getByTestId("field-impact")).toContainText(/field-level/i);
  await expect(page.getByTestId("field-impact")).toContainText("WS-CUSTOMER-LEN");
});

test("palette: Granite semantic search (mocked)", async ({ page }) => {
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

test("audit panel: the immutable log and its integrity badge", async ({ page }) => {
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

test("merge gate: the impact is confirmed before merging", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-ab="branch"]').click(); // opens Changes on the draft version
  const btn = page.getByTestId("merge-btn");
  if ((await btn.count()) > 0) {
    await expect(btn).toContainText("Merge");
    if (await btn.isEnabled()) {
      // branch up to date -> the merge gate asks for confirmation
      await btn.click();
      await expect(page.getByTestId("merge-gate")).toBeVisible();
      await expect(btn).toContainText("Confirm");
    } else {
      // branch behind -> the merge is blocked, with the reason
      await expect(btn).toContainText("import main");
      await expect(page.getByTestId("sync-btn")).toBeVisible();
    }
  }
});

test("first launch onboards into an identity", async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem("cobol-explorer-identity"));
  await page.goto("/");
  await page.getByTestId("onb-name").fill("Alice");
  await page.getByTestId("onb-start").click();
  await expect(page.getByTestId("identity")).toContainText("Alice");
});

test("the agent answers with a trace @slow", async ({ page }) => {
  test.skip(!!process.env.PWTEST_SKIP_LLM, "LLM skipped");
  test.setTimeout(150_000);
  await page.goto("/");
  await page.getByTestId("rp-chat").click();
  await page.getByTestId("chat-input").fill("Who calls program LGIPDB01?");
  await page.getByTestId("chat-send").click();
  await expect(page.getByTestId("trace")).toContainText("graph_lookup", { timeout: 130_000 });
});

test("the version registry is written on demand and readable afterwards", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-ab="branch"]').click();
  const card = page.getByTestId("cs-summary");
  await expect(card).toBeVisible();
  await page.getByTestId("cs-summarize").click();
  // The registry names the file and quantifies the impact — never an empty sentence.
  await expect(card).toContainText(/file\(s\) edited|program\(s\)|No file was edited/i, { timeout: 60000 });
});
