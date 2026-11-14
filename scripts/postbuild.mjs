// GitHub Pages has no server-side routing. Two steps make every link work:
// 1. Write the app shell to each known route (dist/app/forecaster/index.html, ...) so they return HTTP 200.
// 2. Copy it to 404.html so dynamic routes (/app/watchlist/:id) still load the app, which then routes on the client.
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib.mjs";

const ROUTES = [
  "brief",
  "methodology",
  "app",
  "app/forecaster",
  "app/watchlist",
  "app/maintenance",
  "app/debt",
  "app/second-opinion",
  "app/overtime",
  "app/spend-tracker",
  "app/scenarios",
  "app/hearings",
  "app/fiscal-notes",
  "app/district",
  "app/demand",
  "app/grants",
  "app/ask",
  "app/reports",
  "app/data",
  "app/settings",
];

const dist = join(ROOT, "dist");
const shell = join(dist, "index.html");
if (!existsSync(shell)) {
  console.error("dist/index.html not found. Run vite build first.");
  process.exit(1);
}
for (const route of ROUTES) {
  const dir = join(dist, route);
  mkdirSync(dir, { recursive: true });
  copyFileSync(shell, join(dir, "index.html"));
}
copyFileSync(shell, join(dist, "404.html"));
writeFileSync(join(dist, ".nojekyll"), "");
console.log(`postbuild: wrote ${ROUTES.length} route pages, 404.html and .nojekyll`);
