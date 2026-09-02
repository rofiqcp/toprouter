// KIE AI image provider — async submit + poll
import { sleep, nowSec, POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from "./_base.js";
import { PROVIDER_MEDIA } from "../../providers/index.js";

const IMG_CFG = PROVIDER_MEDIA["kie"]?.imageConfig || {};
const SUBMIT_URL = IMG_CFG.baseUrl;
const UPLOAD_URL = IMG_CFG.uploadUrl;
const POLL_BASE = IMG_CFG.pollUrl;

export default {
  async: true,
  buildUrl: () => SUBMIT_URL,
  buildHeaders: (creds) => {
    const headers = { "Content-Type": "application/json" };
    const key = creds?.apiKey || creds?.accessToken;
    if (key) headers["Authorization"] = `Bearer ${key}`;
    return headers;
  },
  buildBody: (_model, body) => {
    // body.model may be the full id "kie/nano-banana-2" or even a doubled
    // prefix "kie/kie/nano-banana-2-lite"; upstream wants the bare slug, so
    // strip everything up to and including the last "/".
    const raw = body.model || "";
    const bareModel = raw.includes("/") ? raw.split("/").pop() : raw;
    const isEdit = !!(body.image || (Array.isArray(body.images) && body.images.length));
    const req = {
      model: bareModel,
      input: {
        prompt: body.prompt,
        aspect_ratio: body.aspect_ratio || "1:1",
        // seedream/5-pro-image-to-image REQUIRES quality + output_format, so
        // always send safe defaults even when the caller omits them.
        quality: body.quality || "basic",
        output_format: body.output_format || "png",
        ...(body.resolution ? { resolution: body.resolution } : {}),
      },
    };
    if (isEdit) {
      req.input.image_input = Array.isArray(body.images)
        ? body.images.filter(Boolean)
        : body.image ? [body.image] : [];
    }
    return req;
  },
  async parseResponse(response, { headers }) {
    const submitData = await response.json();
    if (submitData.code !== 200) throw new Error(submitData.msg || "KIE submit failed");
    const taskId = submitData.data?.taskId;
    if (!taskId) throw new Error("KIE: no taskId returned");
    const pollUrl = `${POLL_BASE}?taskId=${encodeURIComponent(taskId)}`;
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      const r = await fetch(pollUrl, { headers });
      if (!r.ok) throw new Error(`KIE status ${r.status}`);
      const s = await r.json();
      if (s.code !== 200) throw new Error(s.msg || "KIE poll error");
      const state = s.data?.state;
      if (state === "success") {
        const rj = s.data?.resultJson;
        let urls = [];
        if (rj) {
          try { urls = (typeof rj === "string" ? JSON.parse(rj) : rj)?.resultUrls || []; } catch { urls = []; }
        }
        if (urls.length) return { urls };
        throw new Error("KIE success but no resultUrls");
      }
      if (state === "fail") throw new Error(s.data?.failMsg || "KIE generation failed");
    }
    throw new Error("KIE polling timeout");
  },
  normalize: (responseBody, prompt) => {
    const url = responseBody.urls?.[0];
    if (url) return { created: nowSec(), data: [{ url, revised_prompt: prompt }] };
    return { created: nowSec(), data: [] };
  },
};
