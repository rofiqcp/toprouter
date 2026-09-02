// deAPI image provider — async submit + poll
import { sleep, nowSec, POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from "./_base.js";
import { PROVIDER_MEDIA } from "../../providers/index.js";

const IMG_CFG = PROVIDER_MEDIA["deapi"]?.imageConfig || {};
const SUBMIT_URL = IMG_CFG.baseUrl;
const POLL_BASE = IMG_CFG.pollUrl;

export default {
  async: true,
  buildUrl: () => SUBMIT_URL,
  buildHeaders: (creds) => {
    const headers = { "Content-Type": "application/json", "Accept": "application/json" };
    const key = creds?.apiKey || creds?.accessToken;
    if (key) headers["Authorization"] = `Bearer ${key}`;
    return headers;
  },
  buildBody: (_model, body) => {
    // body.model may be the full id "deapi/Flux_2_Klein_4B_BF16"; upstream wants the bare slug.
    const bareModel = (body.model || "").includes("/")
      ? body.model.split("/").pop()
      : (body.model || "");
    const m = bareModel.toLowerCase();
    const locked = m.includes("flux_2_klein_4b_bf16");
    const req = {
      prompt: body.prompt,
      model: bareModel,
      width: body.width || 1024,
      height: body.height || 1024,
      steps: locked ? 4 : (body.steps || 4),
      guidance: locked ? 0.0 : (body.guidance ?? 0.0),
      seed: body.seed || 0,
    };
    if (!locked && body.negative_prompt) req.negative_prompt = body.negative_prompt;
    if (body.image) req.image = body.image; // base64
    return req;
  },
  async parseResponse(response, { headers }) {
    const submitData = await response.json();
    if (submitData.error || submitData.status >= 400) {
      throw new Error(submitData.error?.message || submitData.message || "deAPI submit failed");
    }
    const requestId = submitData.data?.request_id;
    if (!requestId) throw new Error("deAPI: no request_id");
    const pollUrl = `${POLL_BASE}/${requestId}`;
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      const r = await fetch(pollUrl, { headers });
      if (!r.ok) throw new Error(`deAPI status ${r.status}`);
      const s = await r.json();
      if (s.error) throw new Error(s.error?.message || "deAPI poll error");
      const st = s.data?.status;
      if (st === "done") {
        const url = s.data?.result_url;
        if (url) return { url };
        throw new Error("deAPI done but no result_url");
      }
      if (st === "error") throw new Error(s.data?.error?.message || "deAPI generation failed");
    }
    throw new Error("deAPI polling timeout");
  },
  normalize: (responseBody, prompt) => {
    const url = responseBody.url;
    if (url) return { created: nowSec(), data: [{ url, revised_prompt: prompt }] };
    return { created: nowSec(), data: [] };
  },
};
