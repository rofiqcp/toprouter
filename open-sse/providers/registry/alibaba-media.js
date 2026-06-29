export default {
  id: "alibaba-media",
  priority: 85,
  alias: "alibaba-media",
  display: {
    name: "Alibaba Cloud",
    icon: "cloud",
    color: "#FF6A00",
    textIcon: "ALI",
    website: "https://dashscope.console.aliyun.com",
    notice: { apiKeyUrl: "https://dashscope.console.aliyun.com" },
  },
  category: "apikey",
  authType: "apikey",
  transport: null,
  serviceKinds: ["image", "imageEdit", "video"],
  imageConfig: {
    baseUrl: "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis",
  },
  imageEditConfig: {
    baseUrl: "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
  },
  videoConfig: {
      baseUrl: "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis",
    },
  models: [
    // === IMAGE (verified working) ===
    // text2image async endpoint
    { id: "qwen-image", name: "Qwen Image", kind: "image", params: ["size", "n"] },
    { id: "qwen-image-plus", name: "Qwen Image Plus", kind: "image", params: ["size", "n"] },
    // multimodal sync endpoint (qwen-image-plus-2026-01-09, max, 2.0-pro variants)
    { id: "qwen-image-plus-2026-01-09", name: "Qwen Image Plus 2026-01-09", kind: "image", params: ["size", "n"] },
    { id: "qwen-image-max", name: "Qwen Image Max", kind: "image", params: ["size", "n"] },
    { id: "qwen-image-max-2025-12-30", name: "Qwen Image Max 2025-12-30", kind: "image", params: ["size", "n"] },
    { id: "qwen-image-2.0-2026-03-03", name: "Qwen Image 2.0 2026-03-03", kind: "image", params: ["size", "n"] },
    { id: "qwen-image-2.0-pro", name: "Qwen Image 2.0 Pro", kind: "image", params: ["size", "n"] },
    { id: "qwen-image-2.0-pro-2026-03-03", name: "Qwen Image 2.0 Pro 2026-03-03", kind: "image", params: ["size", "n"] },
    { id: "qwen-image-2.0-pro-2026-04-22", name: "Qwen Image 2.0 Pro 2026-04-22", kind: "image", params: ["size", "n"] },
    // wan text2image async
    { id: "wan2.2-t2i-flash", name: "Wan 2.2 T2I Flash", kind: "image", params: ["size", "n"] },
    { id: "wan2.2-t2i-plus", name: "Wan 2.2 T2I Plus", kind: "image", params: ["size", "n"] },
    { id: "wan2.1-t2i-plus", name: "Wan 2.1 T2I Plus", kind: "image", params: ["size", "n"] },
    { id: "wan2.1-t2i-turbo", name: "Wan 2.1 T2I Turbo", kind: "image", params: ["size", "n"] },
    { id: "wan2.5-t2i-preview", name: "Wan 2.5 T2I Preview", kind: "image", params: ["size", "n"] },
    // multimodal sync endpoint
    { id: "wan2.6-t2i", name: "Wan 2.6 T2I", kind: "image", params: ["size", "n"] },
    { id: "wan2.7-image", name: "Wan 2.7 Image", kind: "image", params: ["size", "n"] },
    { id: "wan2.7-image-pro", name: "Wan 2.7 Image Pro", kind: "image", params: ["size", "n"] },
    // image-generation async endpoint
    { id: "wan2.6-image", name: "Wan 2.6 Image", kind: "image", params: ["size", "n"] },

    // === IMAGE EDIT (verified working - multimodal sync, needs reference image) ===
    { id: "qwen-image-edit", name: "Qwen Image Edit", kind: "imageEdit", params: ["size", "n"] },
    { id: "qwen-image-edit-plus", name: "Qwen Image Edit Plus", kind: "imageEdit", params: ["size", "n"] },
    { id: "qwen-image-edit-plus-2025-10-30", name: "Qwen Image Edit Plus 2025-10-30", kind: "imageEdit", params: ["size", "n"] },
    { id: "qwen-image-edit-plus-2025-12-15", name: "Qwen Image Edit Plus 2025-12-15", kind: "imageEdit", params: ["size", "n"] },
    { id: "qwen-image-edit-max", name: "Qwen Image Edit Max", kind: "imageEdit", params: ["size", "n"] },
    { id: "qwen-image-edit-max-2026-01-16", name: "Qwen Image Edit Max 2026-01-16", kind: "imageEdit", params: ["size", "n"] },

    // === VIDEO (verified working) ===
    // video-generation/video-synthesis (prompt only)
    { id: "wan2.1-t2v-plus", name: "Wan 2.1 T2V Plus", kind: "video", params: [] },
    { id: "wan2.1-t2v-turbo", name: "Wan 2.1 T2V Turbo", kind: "video", params: [] },
    { id: "wan2.1-i2v-plus", name: "Wan 2.1 I2V Plus", kind: "video", params: [] },
    { id: "wan2.1-i2v-turbo", name: "Wan 2.1 I2V Turbo", kind: "video", params: [] },
    { id: "wan2.1-vace-plus", name: "Wan 2.1 VACE Plus", kind: "video", params: [] },
    { id: "wan2.2-t2v-plus", name: "Wan 2.2 T2V Plus", kind: "video", params: [] },
    { id: "wan2.2-i2v-plus", name: "Wan 2.2 I2V Plus", kind: "video", params: [] },
    { id: "wan2.2-i2v-flash", name: "Wan 2.2 I2V Flash", kind: "video", params: [] },
    { id: "wan2.5-t2v-preview", name: "Wan 2.5 T2V Preview", kind: "video", params: [] },
    { id: "wan2.5-i2v-preview", name: "Wan 2.5 I2V Preview", kind: "video", params: [] },
    { id: "wan2.6-t2v", name: "Wan 2.6 T2V", kind: "video", params: [] },
    { id: "wan2.6-i2v", name: "Wan 2.6 I2V", kind: "video", params: [] },
    { id: "wan2.6-i2v-flash", name: "Wan 2.6 I2V Flash", kind: "video", params: [] },
    { id: "wan2.6-r2v", name: "Wan 2.6 R2V", kind: "video", params: [] },
    { id: "wan2.6-r2v-flash", name: "Wan 2.6 R2V Flash", kind: "video", params: [] },
    { id: "wan2.7-t2v", name: "Wan 2.7 T2V", kind: "video", params: [] },
    { id: "wan2.7-t2v-2026-04-25", name: "Wan 2.7 T2V 2026-04-25", kind: "video", params: [] },
    { id: "wan2.7-i2v", name: "Wan 2.7 I2V", kind: "video", params: [] },
    { id: "wan2.7-i2v-2026-04-25", name: "Wan 2.7 I2V 2026-04-25", kind: "video", params: [] },
    { id: "wan2.7-r2v", name: "Wan 2.7 R2V", kind: "video", params: [] },
    { id: "wan2.7-videoedit", name: "Wan 2.7 Video Edit", kind: "video", params: [] },
    // image2video/video-synthesis (needs first_frame_url)
    { id: "wan2.1-kf2v-plus", name: "Wan 2.1 KF2V Plus", kind: "video", params: [] },
    { id: "wan2.2-animate-move", name: "Wan 2.2 Animate Move", kind: "video", params: [] },
    { id: "wan2.2-animate-mix", name: "Wan 2.2 Animate Mix", kind: "video", params: [] },
    // image2image/image-synthesis (needs ref_img)
    { id: "wan2.5-i2i-preview", name: "Wan 2.5 I2I Preview", kind: "video", params: [] },
    // happyhorse
    { id: "happyhorse-1.0-t2v", name: "HappyHorse 1.0 T2V", kind: "video", params: [] },
    { id: "happyhorse-1.0-i2v", name: "HappyHorse 1.0 I2V", kind: "video", params: [] },
    { id: "happyhorse-1.0-r2v", name: "HappyHorse 1.0 R2V", kind: "video", params: [] },
    { id: "happyhorse-1.0-video-edit", name: "HappyHorse 1.0 Video Edit", kind: "video", params: [] },
    { id: "happyhorse-1.1-t2v", name: "HappyHorse 1.1 T2V", kind: "video", params: [] },
    { id: "happyhorse-1.1-i2v", name: "HappyHorse 1.1 I2V", kind: "video", params: [] },
    { id: "happyhorse-1.1-r2v", name: "HappyHorse 1.1 R2V", kind: "video", params: [] },
  ],
};
