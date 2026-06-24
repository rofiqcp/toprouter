import { handleVideoGeneration } from "@/sse/handlers/videoGeneration.js";

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

/** POST /v1/video/generations - Video generation endpoint (OpenAI-compatible shape) */
export async function POST(request) {
  return await handleVideoGeneration(request);
}
