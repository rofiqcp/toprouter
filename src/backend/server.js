/**
 * TopRouter Express Backend — standalone SSE proxy server.
 *
 * Runs on a separate port (default 3030) from Next.js frontend.
 * Handles all /v1/* and /v1beta/* LLM proxy routes.
 * This decouples the SSE streaming event loop from React SSR,
 * preventing UI lag during long chat completions.
 */

import express from "express";
import cors from "cors";
import { expressToWebRequest, webResponseToExpress } from "./adapter.js";

// ─── Handlers (same modules used by Next.js routes) ───
import { handleChat } from "../sse/handlers/chat.js";
import { handleStt } from "../sse/handlers/stt.js";
import { handleTts } from "../sse/handlers/tts.js";
import { handleEmbeddings } from "../sse/handlers/embeddings.js";
import { handleImageGeneration } from "../sse/handlers/imageGeneration.js";
import { handleImageEdit } from "../sse/handlers/imageEdit.js";
import { handleSearch } from "../sse/handlers/search.js";
import { handleFetch } from "../sse/handlers/fetch.js";
import { handleVideoGeneration } from "../sse/handlers/videoGeneration.js";
import { initTranslators } from "open-sse/translator/index.js";

// ─── Models route (inline — same logic as Next.js route) ───
import {
  PROVIDER_MODELS,
  PROVIDER_ID_TO_ALIAS,
  getModelKind,
} from "../shared/constants/models.js";
import {
  AI_PROVIDERS,
  getProviderAlias,
  isOpenAICompatibleProvider,
  isAnthropicCompatibleProvider,
} from "../shared/constants/providers.js";
import { getProviderConnections, getCombos, getCustomModels, getModelAliases } from "../lib/localDb.js";
import { getDisabledModels } from "../lib/disabledModelsDb.js";
import { resolveKiroModels } from "open-sse/services/kiroModels.js";
import { resolveQoderModels } from "open-sse/services/qoderModels.js";
import { capabilitiesFromServiceKind } from "open-sse/providers/capabilities.js";

// ─── Config ───
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || "3030", 10);
const BACKEND_HOST = process.env.BACKEND_HOST || "127.0.0.1";
const BASE_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}`;

// ─── Translator init (once) ───
let translatorsInitialized = false;
async function ensureTranslators() {
  if (!translatorsInitialized) {
    await initTranslators();
    translatorsInitialized = true;
  }
}

// ─── Express app ───
const app = express();

// Disable Express body parsing for proxy routes — we pass raw stream to Web API Request
// so handlers can read body themselves (critical for SSE + FormData)
app.use("/v1", (req, res, next) => {
  // Only parse for routes that need it (models, voices) — skip for streaming handlers
  const needsParsing = req.path.match(/^\/models|^\/audio\/voices/);
  if (needsParsing) {
    express.json({ limit: "128mb" })(req, res, next);
  } else {
    // Don't consume the body — let the Web API Request read it
    next();
  }
});

app.use("/v1beta", (req, res, next) => next()); // No body parsing for v1beta

// CORS — same as Next.js route handlers
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

// ─── Helper: wrap a Web-API handler into Express middleware ───
function wrapHandler(handler, needsInit = false) {
  return async (req, res) => {
    try {
      if (needsInit) await ensureTranslators();
      const webReq = expressToWebRequest(req, BASE_URL);
      const webRes = await handler(webReq);
      await webResponseToExpress(webRes, res);
    } catch (err) {
      console.error(`[backend] ${req.method} ${req.path} error:`, err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error", message: err.message });
      }
    }
  };
}

// ═══════════════════════════════════════
//  V1 ROUTES — LLM Proxy
// ═══════════════════════════════════════

// Chat completions (OpenAI format)
app.post("/v1/chat/completions", wrapHandler(handleChat, true));

// Audio — STT
app.post("/v1/audio/transcriptions", wrapHandler(handleStt));

// Audio — TTS
app.post("/v1/audio/speech", wrapHandler(handleTts));

// Audio — Voices list
app.get("/v1/audio/voices", wrapHandler(async (request) => {
  // Inline — same as Next.js route
  const allProviders = Object.values(AI_PROVIDERS);
  const voices = [];
  for (const p of allProviders) {
    if (p.tts?.voices) {
      for (const v of p.tts.voices) {
        voices.push({ ...v, provider: p.id });
      }
    }
  }
  return new Response(JSON.stringify({ voices }), {
    headers: { "Content-Type": "application/json" },
  });
}));

// Embeddings
app.post("/v1/embeddings", wrapHandler(handleEmbeddings));

// Search
app.post("/v1/search", wrapHandler(handleSearch));

// Web fetch
app.post("/v1/web/fetch", wrapHandler(handleFetch));

// Images — generation
app.post("/v1/images/generations", wrapHandler(handleImageGeneration));

// Images — edit
app.post("/v1/images/edits", wrapHandler(handleImageEdit));

// Video — generation
app.post("/v1/video/generations", wrapHandler(handleVideoGeneration));

// Models — list (OpenAI compatible)
app.get("/v1/models", wrapHandler(async (request) => {
  // Inline — same logic as Next.js models route
  try {
    const url = new URL(request.url);
    const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "") || "";
    const isApiKey = apiKey && !apiKey.startsWith("oauth_");
    const connections = await getProviderConnections();
    const combos = await getCombos();
    const customModels = await getCustomModels();
    const aliases = await getModelAliases();
    const disabledModels = await getDisabledModels();
    const providerIdAlias = getProviderAlias(apiKey, connections);

    const models = [];
    const seen = new Set();

    // Provider models
    for (const [providerId, providerModels] of Object.entries(PROVIDER_MODELS)) {
      const conn = connections.find((c) => c.provider === providerId);
      if (!conn) continue;
      const alias = PROVIDER_ID_TO_ALIAS[providerId] || providerId;

      for (const model of providerModels) {
        const id = model.id || model;
        if (disabledModels[id]) continue;
        if (seen.has(id)) continue;
        seen.add(id);

        models.push({
          id,
          object: "model",
          created: Math.floor(Date.now() / 1000),
          owned_by: alias,
          kind: getModelKind(id),
          capabilities: model.capabilities || capabilitiesFromServiceKind(getModelKind(id)),
        });
      }
    }

    // Custom models
    for (const cm of customModels) {
      if (disabledModels[cm.id]) continue;
      if (seen.has(cm.id)) continue;
      seen.add(cm.id);
      models.push({
        id: cm.id,
        object: "model",
        created: Math.floor(Date.now() / 1000),
        owned_by: cm.provider || "custom",
        kind: getModelKind(cm.id) || "llm",
      });
    }

    // Combo models
    for (const combo of combos) {
      if (disabledModels[combo.id]) continue;
      if (seen.has(combo.id)) continue;
      seen.add(combo.id);
      models.push({
        id: combo.id,
        object: "model",
        created: Math.floor(Date.now() / 1000),
        owned_by: "combo",
        kind: "llm",
      });
    }

    // Aliases
    for (const [alias, target] of Object.entries(aliases)) {
      if (disabledModels[alias]) continue;
      if (seen.has(alias)) continue;
      seen.add(alias);
      models.push({
        id: alias,
        object: "model",
        created: Math.floor(Date.now() / 1000),
        owned_by: "alias",
        kind: getModelKind(target) || "llm",
        alias_of: target,
      });
    }

    return new Response(JSON.stringify({ object: "list", data: models }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[backend] /v1/models error:", err);
    return new Response(JSON.stringify({ error: "Failed to list models" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}));

// Models — info
app.get("/v1/models/info", wrapHandler(async (request) => {
  try {
    const connections = await getProviderConnections();
    const combos = await getCombos();
    const customModels = await getCustomModels();
    const aliases = await getModelAliases();
    const disabledModels = await getDisabledModels();

    const data = {};
    for (const conn of connections) {
      const providerId = conn.provider;
      const alias = PROVIDER_ID_TO_ALIAS[providerId] || providerId;
      const pModels = PROVIDER_MODELS[providerId] || [];
      const available = pModels
        .filter((m) => !disabledModels[m.id || m])
        .map((m) => ({ id: m.id || m, kind: getModelKind(m.id || m) }));
      data[alias] = { provider: providerId, models: available };
    }
    if (customModels.length) data.custom = { provider: "custom", models: customModels };
    if (combos.length) data.combo = { provider: "combo", models: combos.map((c) => ({ id: c.id, kind: "llm" })) };
    if (Object.keys(aliases).length) data.alias = { provider: "alias", models: Object.entries(aliases).map(([a, t]) => ({ id: a, kind: getModelKind(t) || "llm" })) };

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to get model info" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}));

// Messages (Claude format) — uses handleChat with auto-convert
app.post("/v1/messages", wrapHandler(handleChat, true));

// Messages — count tokens
app.post("/v1/messages/count_tokens", wrapHandler(async (request) => {
  try {
    const body = await request.json();
    const inputTokens = (body.messages || []).reduce((sum, m) => sum + (m.content?.length || 0), 0);
    return new Response(JSON.stringify({ input_tokens: inputTokens }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}));

// Responses API (OpenAI Responses format)
app.all("/v1/responses", wrapHandler(handleChat, true));

// Responses — compact
app.all("/v1/responses/compact", wrapHandler(handleChat, true));

// Ollama-compatible /api/chat
app.post("/v1/api/chat", wrapHandler(async (request) => {
  await ensureTranslators();
  return handleChat(request);
}, false));

// v1 root — health check
app.all("/v1", (req, res) => {
  res.json({ status: "ok", service: "toprouter-backend", version: process.env.APP_VERSION || "unknown" });
});

// ═══════════════════════════════════════
//  V1BETA ROUTES — Gemini compatibility
// ═══════════════════════════════════════

app.get("/v1beta/models", wrapHandler(async (request) => {
  // Simplified Gemini models list
  try {
    const connections = await getProviderConnections();
    const models = [];
    for (const [providerId, pModels] of Object.entries(PROVIDER_MODELS)) {
      const conn = connections.find((c) => c.provider === providerId);
      if (!conn) continue;
      for (const m of pModels) {
        models.push({ name: `models/${m.id || m}`, displayName: m.id || m });
      }
    }
    return new Response(JSON.stringify({ models }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Failed" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}));

// v1beta models path — Gemini SSE generateContent (catch-all subpath)
app.all(/\/v1beta\/models\/(.*)/, wrapHandler(handleChat, true));

// ═══════════════════════════════════════
//  HEALTH + STARTUP
// ═══════════════════════════════════════

app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), pid: process.pid });
});

// Start server
const server = app.listen(BACKEND_PORT, BACKEND_HOST, () => {
  console.log(`[backend] SSE proxy server listening on ${BACKEND_HOST}:${BACKEND_PORT}`);
  console.log(`[backend] Handling /v1/* and /v1beta/* routes`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[backend] SIGTERM received, shutting down...");
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  console.log("[backend] SIGINT received, shutting down...");
  server.close(() => process.exit(0));
});

export { app, server };
