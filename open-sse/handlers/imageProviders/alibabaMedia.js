// Alibaba Cloud (DashScope) — async image generation + edit + video
// MaaS deployments require async: POST task → poll /api/v1/tasks/{id} → normalize
import { PROVIDER_MEDIA } from "../../providers/index.js";

const IMG_BASE = PROVIDER_MEDIA["alibaba-media"]?.imageConfig?.baseUrl;
const EDIT_BASE = PROVIDER_MEDIA["alibaba-media"]?.imageEditConfig?.baseUrl;
const VIDEO_BASE = PROVIDER_MEDIA["alibaba-media"]?.videoConfig?.baseUrl;

// Derive the base domain (strip the path) for polling URL
function getBaseDomain(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.origin; // e.g. https://ws-hl022otpkn5qioav.ap-southeast-1.maas.aliyuncs.com
  } catch {
    return url.replace(/\/api\/v1\/.*$/, "");
  }
}

const BASE_DOMAIN = getBaseDomain(IMG_BASE);
const POLL_URL_TEMPLATE = `${BASE_DOMAIN}/api/v1/tasks`;

// Map kind → endpoint path (DashScope-style, NOT OpenAI-compatible)
const KIND_TO_ENDPOINT = {
  image: IMG_BASE,
  imageEdit: EDIT_BASE,
  video: VIDEO_BASE,
};

// Models that use text2image/image-synthesis format (prompt-based)
const TEXT2IMAGE_MODELS = new Set([
  "qwen-image", "qwen-image-plus", "qwen-image-plus-2026-01-09",
  "qwen-image-max", "qwen-image-max-2025-12-30",
  "qwen-image-2.0", "qwen-image-2.0-2026-03-03", "qwen-image-2.0-pro",
  "qwen-image-2.0-pro-2026-03-03", "qwen-image-2.0-pro-2026-04-22",
  "wan2.2-t2i-flash", "wan2.2-t2i-plus",
  "wan2.1-t2i-plus", "wan2.1-t2i-turbo",
  "wan2.6-t2i",
  "wan2.7-image", "wan2.7-image-pro",
  "z-image-turbo",
]);

// Models that use multimodal-generation/generation format (messages-based)
const MULTIMODAL_MODELS = new Set([
  "wan2.6-image", "wan2.7-image", "wan2.7-image-pro",
  "qwen-image-edit", "qwen-image-edit-plus", "qwen-image-edit-plus-2025-10-30",
  "qwen-image-edit-plus-2025-12-15", "qwen-image-edit-max",
  "qwen-image-edit-max-2026-01-16",
]);

// Video models use text2video or image2video
const VIDEO_MODELS_PREFIX = ["wan2.1-t2v", "wan2.1-i2v", "wan2.1-kf2v", "wan2.1-vace",
  "wan2.2-t2v", "wan2.2-i2v", "wan2.2-animate", "wan2.5-t2v", "wan2.5-i2v", "wan2.5-i2i",
  "wan2.6-t2v", "wan2.6-i2v", "wan2.6-r2v", "wan2.7-t2v", "wan2.7-i2v", "wan2.7-r2v",
  "wan2.7-videoedit", "happyhorse"];

function isVideoModel(model) {
  return VIDEO_MODELS_PREFIX.some(p => model.startsWith(p));
}

function detectKind(body) {
  return body?._kind || body?.kind || "image";
}

function sizeToDashScope(size) {
  if (!size || size === "auto") return "1024*1024";
  if (size.includes("*")) return size; // already in dashscope format
  return size.replace("x", "*");
}

export default {
  // --- Use executor flow for full async control ---
  useExecutor: true,

  async executeViaExecutor(model, body, credentials, log) {
    const kind = detectKind(body);
    const apiKey = credentials?.apiKey || credentials?.accessToken || "";
    const baseDomain = getBaseDomain(KIND_TO_ENDPOINT[kind] || IMG_BASE);

    // Determine endpoint path based on model type
    let endpointPath;
    let dashScopeBody;

    if (isVideoModel(model)) {
      // Video generation endpoint
      endpointPath = "/api/v1/services/aigc/video-generation/generation";
      dashScopeBody = {
        model,
        input: { prompt: body.prompt },
        parameters: {},
      };
    } else if (MULTIMODAL_MODELS.has(model) || kind === "imageEdit") {
      // Multimodal generation (messages-based)
      endpointPath = "/api/v1/services/aigc/multimodal-generation/generation";
      const messages = [{ role: "user", content: [{ text: body.prompt }] }];
      // For image edit, include reference images
      if (body.image) {
        messages[0].content.push({ image: body.image });
      }
      dashScopeBody = {
        model,
        input: { messages },
        parameters: { n: body.n || 1 },
      };
    } else {
      // Text2Image (prompt-based) — default for most models
      endpointPath = "/api/v1/services/aigc/text2image/image-synthesis";
      dashScopeBody = {
        model,
        input: { prompt: body.prompt },
        parameters: {
          size: sizeToDashScope(body.size),
          n: body.n || 1,
        },
      };
    }

    const url = `${baseDomain}${endpointPath}`;
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "X-DashScope-Async": "enable",
    };

    log?.debug?.("ALIBABA-MEDIA", `POST ${url} model=${model}`);

    // Step 1: Submit task
    const submitResp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(dashScopeBody),
    });

    if (!submitResp.ok) {
      const errText = await submitResp.text();
      throw new Error(`[${model}] [${submitResp.status}]: ${errText.slice(0, 300)}`);
    }

    const submitData = await submitResp.json();
    const taskId = submitData?.output?.task_id;

    if (!taskId) {
      // If no task_id, might be a synchronous response
      return submitData;
    }

    log?.debug?.("ALIBABA-MEDIA", `Task submitted: ${taskId}, polling...`);

    // Step 2: Poll until complete
    const pollUrl = `${baseDomain}/api/v1/tasks/${taskId}`;
    const pollHeaders = { "Authorization": `Bearer ${apiKey}` };
    const maxPolls = 120; // 120 * 3s = 6 min max
    const pollInterval = 3000; // 3 seconds

    for (let i = 0; i < maxPolls; i++) {
      await new Promise(r => setTimeout(r, pollInterval));

      const pollResp = await fetch(pollUrl, { headers: pollHeaders });
      if (!pollResp.ok) {
        // 404 means task expired or not found yet — keep polling
        if (pollResp.status === 404) continue;
        const errText = await pollResp.text();
        throw new Error(`[${model}] Poll error [${pollResp.status}]: ${errText.slice(0, 300)}`);
      }

      const pollData = await pollResp.json();
      const status = pollData?.output?.task_status;

      if (status === "SUCCEEDED") {
        log?.debug?.("ALIBABA-MEDIA", `Task ${taskId} succeeded`);
        return pollData;
      }
      if (status === "FAILED") {
        const errMsg = pollData?.output?.message || pollData?.output?.code || "Task failed";
        throw new Error(`[${model}] Task failed: ${errMsg}`);
      }
      // PENDING / RUNNING — continue polling
    }

    throw new Error(`[${model}] Task ${taskId} timed out after ${maxPolls * pollInterval / 1000}s`);
  },

  // Normalize DashScope response → OpenAI images/generations format
  normalize(responseBody, prompt) {
    const results = responseBody?.output?.results || [];

    const data = results.map((r, i) => ({
      url: r.url || "",
      b64_json: r.b64_json || undefined,
      revised_prompt: r.actual_prompt || prompt,
    }));

    // For video models
    const videoUrl = responseBody?.output?.video_url;
    if (videoUrl) {
      data.push({
        url: videoUrl,
        revised_prompt: prompt,
      });
    }

    return {
      created: Math.floor(Date.now() / 1000),
      data,
    };
  },
};