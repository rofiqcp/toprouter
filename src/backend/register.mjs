/**
 * Custom Node.js module loader for jsconfig path aliases.
 *
 * Handles:
 *   @/*          → ./src/*
 *   open-sse/*   → ./open-sse/*
 *   extensionless imports → auto-appends .js (Next.js bundler compat)
 *
 * Usage: node --import ./src/backend/register.mjs src/backend/server.js
 */

import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");

const hookCode = `
import { resolve as resolvePath, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const root = ${JSON.stringify(ROOT)};

function tryResolveJs(filePath) {
  if (filePath.endsWith(".js") || filePath.endsWith(".mjs") || filePath.endsWith(".cjs") ||
      filePath.endsWith(".json") || filePath.endsWith(".node")) return filePath;
  if (existsSync(filePath + ".js")) return filePath + ".js";
  if (existsSync(filePath + ".mjs")) return filePath + ".mjs";
  if (existsSync(filePath + "/index.js")) return filePath + "/index.js";
  if (existsSync(filePath + "/index.mjs")) return filePath + "/index.mjs";
  return filePath;
}

export function resolve(specifier, context, nextResolve) {
  const parentUrl = context.parentURL;

  // @/ alias → ./src/
  if (specifier.startsWith("@/")) {
    const rel = specifier.slice(2);
    const newPath = resolvePath(root, "src", rel);
    return nextResolve(tryResolveJs(newPath), context);
  }

  // open-sse alias
  if (specifier === "open-sse" || specifier.startsWith("open-sse/")) {
    const rel = specifier.slice("open-sse".length);
    const suffix = rel.startsWith("/") ? rel.slice(1) : rel;
    const newPath = resolvePath(root, "open-sse", suffix || "index.js");
    return nextResolve(tryResolveJs(newPath), context);
  }

  // Relative imports (./ or ../) — auto-append .js
  if (specifier.startsWith(".") && parentUrl) {
    let baseDir;
    try {
      baseDir = dirname(fileURLToPath(parentUrl));
    } catch {
      baseDir = root;
    }
    const fullPath = resolvePath(baseDir, specifier);
    return nextResolve(tryResolveJs(fullPath), context);
  }

  // Default: pass through to Node.js
  return nextResolve(specifier, context);
}
`;

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";

const tmpDir = resolve(tmpdir(), "toprouter-backend");
if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
const hookPath = resolve(tmpDir, "alias-loader.mjs");
writeFileSync(hookPath, hookCode);

register(pathToFileURL(hookPath));