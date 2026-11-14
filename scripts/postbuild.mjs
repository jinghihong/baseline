// GitHub Pages serves 404.html for unknown paths. Copying the app shell there lets deep links
// like /baseline/app/forecast load the single-page app, which then routes on the client.
import { copyFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib.mjs";

const dist = join(ROOT, "dist");
if (!existsSync(join(dist, "index.html"))) {
  console.error("dist/index.html not found. Run vite build first.");
  process.exit(1);
}
copyFileSync(join(dist, "index.html"), join(dist, "404.html"));
writeFileSync(join(dist, ".nojekyll"), "");
console.log("postbuild: wrote dist/404.html and dist/.nojekyll");
