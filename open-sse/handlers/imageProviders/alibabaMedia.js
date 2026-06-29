// Alibaba Cloud (DashScope) - async image generation + edit + video
// Base: dashscope-intl.aliyuncs.com (Singapore region)
// Endpoints: text2image, multimodal-generation, image-generation,
//            video-generation, image2video, image2image
import { PROVIDER_MEDIA } from '../../providers/index.js';

const IMG_BASE = PROVIDER_MEDIA['alibaba-media']?.imageConfig?.baseUrl;
const EDIT_BASE = PROVIDER_MEDIA['alibaba-media']?.imageEditConfig?.baseUrl;
const VIDEO_BASE = PROVIDER_MEDIA['alibaba-media']?.videoConfig?.baseUrl;

function getBaseDomain(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    return u.origin;
  } catch {
    return url.replace(/\/api\/v1\/.*$/, '');
  }
}

const BASE_DOMAIN = getBaseDomain(IMG_BASE);

// In-memory task store for async video generation.
// Keyed by taskId → { provider, model, apiKey, createdAt }.
// Tasks expire after 10 minutes via cleanup.
const _taskStore = new Map();
const TASK_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Cleanup expired tasks every minute
setInterval(() => {
  const now = Date.now();
  for (const [id, task] of _taskStore) {
    if (now - task.createdAt > TASK_TTL_MS) _taskStore.delete(id);
  }
}, 60_000).unref();

function registerAsyncTask(taskId, model, apiKey) {
  _taskStore.set(taskId, { provider: 'alibaba-media', model, apiKey, createdAt: Date.now() });
}

export function getAsyncTask(taskId) {
  return _taskStore.get(taskId) || null;
}

export async function pollAsyncTask(taskId, log) {
  const task = _taskStore.get(taskId);
  if (!task) return { error: 'Task not found' };

  const pollUrl = `${BASE_DOMAIN}/api/v1/tasks/${taskId}`;
  const headers = { 'Authorization': `Bearer ${task.apiKey}` };

  const resp = await fetch(pollUrl, { headers });
  if (!resp.ok) {
    if (resp.status === 404) return { status: 'PENDING', taskId };
    const text = await resp.text();
    return { error: `Poll error [${resp.status}]: ${text.slice(0, 200)}` };
  }

  const data = await resp.json();
  const status = data?.output?.task_status;

  if (status === 'SUCCEEDED') {
    // Normalize the result
    const results = data?.output?.results || [];
    const videoUrl = data?.output?.video_url;
    const dataItems = results.map(r => ({ url: r.url || '', revised_prompt: r.actual_prompt || '' }));
    if (videoUrl) dataItems.push({ url: videoUrl, revised_prompt: '' });

    // Cleanup task
    _taskStore.delete(taskId);

    return {
      status: 'COMPLETED',
      taskId,
      created: Math.floor(Date.now() / 1000),
      data: dataItems,
    };
  }
  if (status === 'FAILED') {
    const errMsg = data?.output?.message || data?.output?.code || 'Task failed';
    _taskStore.delete(taskId);
    return { status: 'FAILED', taskId, error: errMsg };
  }

  return { status: status || 'PENDING', taskId };
}

// === Model routing maps (verified via DashScope API testing 2026-06-25) ===

const TEXT2IMAGE_MODELS = new Set([
  'qwen-image', 'qwen-image-plus',
  'wan2.2-t2i-flash', 'wan2.2-t2i-plus',
  'wan2.1-t2i-plus', 'wan2.1-t2i-turbo',
  'wan2.5-t2i-preview',
]);

const MULTIMODAL_MODELS = new Set([
  'qwen-image-plus-2026-01-09', 'qwen-image-max', 'qwen-image-max-2025-12-30',
  'qwen-image-2.0-2026-03-03', 'qwen-image-2.0-pro',
  'qwen-image-2.0-pro-2026-03-03', 'qwen-image-2.0-pro-2026-04-22',
  'wan2.6-t2i',
  'wan2.7-image', 'wan2.7-image-pro',
  'wan2.6-image',
  'qwen-image-edit', 'qwen-image-edit-plus', 'qwen-image-edit-plus-2025-10-30',
  'qwen-image-edit-plus-2025-12-15', 'qwen-image-edit-max',
  'qwen-image-edit-max-2026-01-16',
]);

const IMAGE_GEN_MODELS = new Set();

const IMAGE2VIDEO_MODELS = new Set([
  'wan2.1-kf2v-plus',
]);
const ANIMATE_MODELS = new Set([
  'wan2.2-animate-move', 'wan2.2-animate-mix',
]);

const IMAGE2IMAGE_MODELS = new Set(['wan2.5-i2i-preview']);

const STANDARD_VIDEO_PREFIXES = [
  'wan2.1-t2v', 'wan2.1-i2v', 'wan2.1-vace',
  'wan2.2-t2v', 'wan2.2-i2v',
  'wan2.5-t2v', 'wan2.5-i2v',
  'wan2.6-t2v', 'wan2.6-i2v', 'wan2.6-r2v',
  'wan2.7-t2v', 'wan2.7-i2v', 'wan2.7-r2v', 'wan2.7-videoedit',
  'happyhorse',
];

function isVideoModel(model) {
  return STANDARD_VIDEO_PREFIXES.some(p => model.startsWith(p)) ||
    IMAGE2VIDEO_MODELS.has(model) || IMAGE2IMAGE_MODELS.has(model);
}

function detectKind(body) {
  return body?._kind || body?.kind || 'image';
}

function sizeToDashScope(size) {
  if (!size || size === 'auto') return '1024*1024';
  if (size.includes('*')) return size;
  return size.replace('x', '*');
}

// Poll a single DashScope task. Returns data or throws.
async function pollDashScopeTask(taskId, apiKey, model, log) {
  const pollUrl = `${BASE_DOMAIN}/api/v1/tasks/${taskId}`;
  const pollHeaders = { 'Authorization': `Bearer ${apiKey}` };
  const maxPolls = 120;
  const pollInterval = 3000;

  for (let i = 0; i < maxPolls; i++) {
    await new Promise(r => setTimeout(r, pollInterval));

    const pollResp = await fetch(pollUrl, { headers: pollHeaders });
    if (!pollResp.ok) {
      if (pollResp.status === 404) continue;
      const errText = await pollResp.text();
      throw new Error(`[${model}] Poll error [${pollResp.status}]: ${errText.slice(0, 300)}`);
    }

    const pollData = await pollResp.json();
    const status = pollData?.output?.task_status;

    if (status === 'SUCCEEDED') {
      log?.debug?.('ALIBABA-MEDIA', `Task ${taskId} succeeded`);
      return pollData;
    }
    if (status === 'FAILED') {
      const errMsg = pollData?.output?.message || pollData?.output?.code || 'Task failed';
      throw new Error(`[${model}] Task failed: ${errMsg}`);
    }
  }

  throw new Error(`[${model}] Task ${taskId} timed out after ${maxPolls * pollInterval / 1000}s`);
}

export default {
  useExecutor: true,

  async executeViaExecutor(model, body, credentials, log) {
    const kind = detectKind(body);
    const apiKey = credentials?.apiKey || credentials?.accessToken || '';

    let endpointPath;
    let dashScopeBody;
    let useAsync = true;

    if (ANIMATE_MODELS.has(model)) {
      if (!body.image_url && !body.image) {
        throw new Error(model + ' requires image_url parameter');
      }
      if (!body.video_url) {
        throw new Error(model + ' requires video_url parameter (reference video)');
      }
      endpointPath = '/api/v1/services/aigc/image2video/video-synthesis';
      dashScopeBody = {
        model,
        input: {
          prompt: body.prompt || '',
          image_url: body.image_url || body.image,
          video_url: body.video_url,
        },
        parameters: {
          video_frames: body.video_frames || 16,
        },
      };
    } else if (IMAGE2VIDEO_MODELS.has(model)) {
      endpointPath = '/api/v1/services/aigc/image2video/video-synthesis';
      dashScopeBody = {
        model,
        input: {
          prompt: body.prompt || '',
          first_frame_url: body.image || body.image_url || '',
        },
        parameters: {},
      };
      if (model === 'wan2.1-kf2v-plus' && !body.last_frame_url) {
        throw new Error('wan2.1-kf2v-plus requires both image and last_frame_url parameters');
      }
      if (body.last_frame_url) {
        dashScopeBody.input.last_frame_url = body.last_frame_url;
      }
    } else if (IMAGE2IMAGE_MODELS.has(model)) {
      endpointPath = '/api/v1/services/aigc/image2image/image-synthesis';
      dashScopeBody = {
        model,
        input: {
          prompt: body.prompt || '',
          images: body.image ? [body.image] : [],
        },
        parameters: { n: body.n || 1 },
      };
    } else if (isVideoModel(model)) {
      // Standard video model: t2v, i2v, r2v, videoedit
      endpointPath = '/api/v1/services/aigc/video-generation/video-synthesis';
      dashScopeBody = {
        model,
        input: { prompt: body.prompt },
        parameters: {},
      };
      if (model.includes('-i2v') && (body.image || body.image_url)) {
        dashScopeBody.input.img_url = body.image || body.image_url;
      }
    } else if (IMAGE_GEN_MODELS.has(model)) {
      endpointPath = '/api/v1/services/aigc/image-generation/generation';
      dashScopeBody = {
        model,
        input: { prompt: body.prompt },
        parameters: {
          size: sizeToDashScope(body.size),
          n: body.n || 1,
        },
      };
    } else if (MULTIMODAL_MODELS.has(model) || kind === 'imageEdit') {
      endpointPath = '/api/v1/services/aigc/multimodal-generation/generation';
      useAsync = false;
      const messages = [{ role: 'user', content: [{ text: body.prompt }] }];
      if (body.image) {
        messages[0].content.push({ image: body.image });
      }
      dashScopeBody = {
        model,
        input: { messages },
        parameters: { n: body.n || 1 },
      };
    } else {
      endpointPath = '/api/v1/services/aigc/text2image/image-synthesis';
      dashScopeBody = {
        model,
        input: { prompt: body.prompt },
        parameters: {
          size: sizeToDashScope(body.size),
          n: body.n || 1,
        },
      };
    }

    const url = `${BASE_DOMAIN}${endpointPath}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
    if (useAsync) {
      headers['X-DashScope-Async'] = 'enable';
    }

    log?.debug?.('ALIBABA-MEDIA', `POST ${url} model=${model} async=${useAsync}`);

    const submitResp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(dashScopeBody),
    });

    if (!submitResp.ok) {
      const errText = await submitResp.text();
      throw new Error(`[${model}] [${submitResp.status}]: ${errText.slice(0, 300)}`);
    }

    const submitData = await submitResp.json();
    const taskId = submitData?.output?.task_id;

    // Synchronous models (multimodal): return immediately
    if (!taskId) {
      return submitData;
    }

    // Fast models (image gen, i2i): poll normally
    if (!isVideoModel(model)) {
      log?.debug?.('ALIBABA-MEDIA', `Task ${taskId} submitted (fast), polling...`);
      return pollDashScopeTask(taskId, apiKey, model, log);
    }

    // Slow models (video gen): return immediately with task_id for async polling
    // This avoids Cloudflare 524 timeout (100s limit via tunnel)
    log?.debug?.('ALIBABA-MEDIA', `Task ${taskId} submitted (video, async return)`);

    // Register task for polling
    registerAsyncTask(taskId, model, apiKey);

    return {
      _asyncTask: true,
      model,
      taskId,
      statusUrl: `${BASE_DOMAIN}/api/v1/tasks/${taskId}`,
      output: {
        task_id: taskId,
        task_status: 'PENDING',
      },
    };
  },

  normalize(responseBody, prompt) {
    // Handle async task return (video models)
    if (responseBody?._asyncTask) {
      return {
        _asyncTask: true,
        model: responseBody.model,
        taskId: responseBody.taskId,
        statusUrl: responseBody.statusUrl,
        created: Math.floor(Date.now() / 1000),
        data: [],
      };
    }

    const results = responseBody?.output?.results || [];

    const data = results.map((r) => ({
      url: r.url || '',
      b64_json: r.b64_json || undefined,
      revised_prompt: r.actual_prompt || prompt,
    }));

    const videoUrl = responseBody?.output?.video_url;
    if (videoUrl) {
      data.push({ url: videoUrl, revised_prompt: prompt });
    }

    const choices = responseBody?.output?.choices || [];
    for (const choice of choices) {
      const content = choice?.message?.content || [];
      for (const item of content) {
        if (item?.image) {
          data.push({ url: item.image, revised_prompt: prompt });
        }
      }
    }

    return { created: Math.floor(Date.now() / 1000), data };
  },
};