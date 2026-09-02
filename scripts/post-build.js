// Post-build step for the standalone TopRouter deployment.
// Next.js `output: "standalone"` does NOT copy static/public assets into the
// standalone server directory, so the production server would 404 on
// /_next/static/* and /favicon.svg, /icons/*. We copy them here so every
// `npm run build` (and therefore `server.sh 2`) produces a complete standalone.
import { existsSync, mkdirSync, cpSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const standalone = join(root, ".next", "standalone");

function copyIfExists(srcRel, destRel) {
  const src = join(root, srcRel);
  const dest = join(standalone, destRel);
  if (!existsSync(src)) return;
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log(`[post-build] copied ${srcRel} -> standalone/${destRel}`);
}

if (existsSync(standalone)) {
  copyIfExists(".next/static", ".next/static");
  copyIfExists(".next/server", ".next/server");
  copyIfExists("public", "public");
} else {
  console.log("[post-build] no .next/standalone dir — skipping asset copy");
}

export default {};
