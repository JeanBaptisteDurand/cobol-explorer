import { defineConfig } from "@playwright/test";

// Assumes the FastAPI server is serving the built app at :8000.
// Start it with:  make serve   (see project README)
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  use: { baseURL: "http://127.0.0.1:8000", headless: true },
  reporter: [["list"]],
});
