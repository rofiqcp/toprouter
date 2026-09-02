// GET /api/providers/kie/models
// Returns the list of KIE AI image models by calling the KIE Market models API
// using the API key stored in the provider connection. Used by the registry
// `modelsFetcher` so the dashboard can suggest available models.
import { NextResponse } from "next/server";
import { getProviderConnections } from "@/models";

const MODELS_URL = "https://api.kie.ai/api/v1/models";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const connections = await getProviderConnections().catch(() => []);
    const conn = (connections || []).find((c) => c.provider === "kie");
    const apiKey = conn?.apiKey;
    if (!apiKey) {
      // No connection yet — return the known static models so the UI still works.
      return NextResponse.json({
        provider: "kie",
        models: [
          { id: "nano-banana-2", name: "Nano Banana 2", type: "image" },
          { id: "seedream/5-pro-image-to-image", name: "Seedream 5 Pro (Image-to-Image)", type: "image" },
        ],
      });
    }

    const res = await fetch(MODELS_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (!res.ok) {
      return NextResponse.json(
        { provider: "kie", models: [], warning: `KIE models API ${res.status}` },
        { status: 200 }
      );
    }
    const data = await res.json();
    const list = data?.data || data?.models || [];
    const models = (Array.isArray(list) ? list : []).map((m) => ({
      id: m.id || m.slug || m.model,
      name: m.name || m.label || m.id || m.slug || m.model,
      type: "image",
    })).filter((m) => m.id);

    return NextResponse.json({
      provider: "kie",
      models: models.length
        ? models
        : [
            { id: "nano-banana-2", name: "Nano Banana 2", type: "image" },
            { id: "seedream/5-pro-image-to-image", name: "Seedream 5 Pro (Image-to-Image)", type: "image" },
          ],
    });
  } catch (error) {
    console.error("[kie/models] failed:", error);
    return NextResponse.json(
      { provider: "kie", models: [], warning: String(error?.message || error) },
      { status: 200 }
    );
  }
}
