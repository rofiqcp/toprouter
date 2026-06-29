# TopRouter Alibaba Media Fix - 2026-06-25

## Problem
Image generation, image edit, dan video generation 502/403 error via alibaba-media provider.

## Root Cause
1. **Base URL salah**: Pakai MaaS workspace (`ws-hl...ap-southeast-1.maas.aliyuncs.com`) bukan DashScope standard
2. **Video endpoint salah**: Pakai `/api/v1/video/generations` bukan `/api/v1/services/aigc/video-generation/video-synthesis`
3. **Async header tidak kondisional**: Semua request pakai `X-DashScope-Async` padahal image edit (multimodal) tidak support async
4. **Multimodal response tidak di-handle**: Response choices dari multimodal endpoint tidak di-normalize

## Fixes Applied

### 1. `open-sse/providers/registry/alibaba-media.js`
Ganti base URL dari MaaS ke DashScope:
```js
imageConfig: { baseUrl: "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis" },
imageEditConfig: { baseUrl: "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation" },
videoConfig: { baseUrl: "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis" },
```

### 2. `open-sse/handlers/imageProviders/alibabaMedia.js`
- Video endpoint: `video-synthesis` (bukan `generation`)
- Async header kondisional: `X-DashScope-Async: enable` HANYA untuk text2image + video, BUKAN untuk multimodal/image-edit
- Normalize: handle synchronous multimodal response (choices.message.content with image URLs)

## Test Results
| Endpoint | Status | Model Test | Notes |
|----------|--------|------------|-------|
| `/v1/images/generations` | 200 ✓ | qwen-image | 25 models, async submit+poll |
| `/v1/images/edits` | 200 ✓ | qwen-image-edit | 6 models, sync response |
| `/v1/video/generations` | 200 ✓ | wan2.6-t2v | 32 models, async submit+poll |

## Architecture
- **Frontend**: Port 20128 (Next.js standalone)
- **Backend**: Port 3030 (Express)
- **Database**: PostgreSQL sirobo@localhost:5432/toprouter
- **Cache**: Redis localhost default
- **Auth**: Cookie-based login (password 123456) + API key (sk-ccfa...)
- **Load Test**: 100 concurrent requests → 100% success, avg 134ms

## DashScope API Patterns
| Kind | Endpoint | Async | Response |
|------|----------|-------|----------|
| Image (text2image) | `/services/aigc/text2image/image-synthesis` | Yes | task_id → poll `/tasks/{id}` |
| Image Edit (multimodal) | `/services/aigc/multimodal-generation/generation` | No | Direct (choices.message.content) |
| Video | `/services/aigc/video-generation/video-synthesis` | Yes | task_id → poll `/tasks/{id}` |
