import { defineConfig } from "@playwright/test";

// Assumes the FastAPI server is serving the built app at :8000.
// Start it with:  make serve   (see project README)
// Set E2E_BASE_URL to test another instance (e.g. one started on a spare port).
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  // shots.spec.ts rewrites the PNGs the public page ships. It is a generator, not
  // a test, so an ordinary run must neither trigger it nor count it. `make shots`
  // sets SHOTS=1 to let it in.
  testIgnore: process.env.SHOTS ? [] : ["**/shots.spec.ts"],
  use: { baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:8000", headless: true },
  reporter: [["list"]],
});
