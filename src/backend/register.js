/**
 * Node.js custom module resolver for standalone backend.
 * Resolves jsconfig path aliases:
 *   @/* → ./src/*
 *   open-sse → ./open-sse
 *   open-sse/* → ./open-sse/*
 *
 * Usage: node --import ./src/backend/register.js src/backend/server.js
 */

import { resolve as resolvePath, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// register.js is in src/backend/ → project root is 2 levels up
const ROOT = resolvePath(__dirname, "../..");

export function resolve(specifier, context, nextResolve) {
  // @/* alias
  if (specifier.startsWith("@/")) {
    const rel = specifier.slice(2); // strip "@/"
    const newPath = resolvePath(ROOT, "src", rel);
    return nextResolve(newPath, context);
  }

  // open-sse alias (bare or subpath)
  if (specifier === "open-sse" || specifier.startsWith("open-sse/")) {
    const rel = specifier.slice("open-sse".length); // "" or "/subpath..."
    const suffix = rel.startsWith("/") ? rel.slice(1) : rel;
    const newPath = resolvePath(ROOT, "open-sse", suffix || "index.js");
    return nextResolve(newPath, context);
  }

  return nextResolve(specifier, context);
}