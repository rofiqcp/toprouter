// GET /api/providers/deapi/models
// Returns the list of deAPI image models by calling the deAPI models API
// using the API key stored in the provider connection. Used by the registry
// `modelsFetcher` so the dashboard can suggest available models.
import { NextResponse } from "next/server";
import { getProviderConnections } from "@/models";

const MODELS_URL = "https://api.deapi.ai/api/v1/client/models?per_page=200";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const connections = await getProviderConnections().catch(() => []);
    const conn = (connections || []).find((c) => c.provider === "deapi");
    const apiKey = conn?.apiKey;
    if (!apiKey) {
      return NextResponse.json({
        provider: "deapi",
        models: [{ id: "Flux_2_Klein_4B_BF16", name: "Flux 2 Klein 4B BF16", type: "image" }],
      });
    }

    const res = await fetch(MODELS_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) {
      return NextResponse.json(
        { provider: "deapi", models: [], warning: `deAPI models API ${res.status}` },
        { status: 200 }
      );
    }
    const data = await res.json();
    const list = data?.data || data?.models || [];
    const models = (Array.isArray(list) ? list : []).map((m) => ({
      id: m.slug || m.id || m.model,
      name: m.name || m.label || m.slug || m.id || m.model,
      type: "image",
    })).filter((m) => m.id);

    return NextResponse.json({
      provider: "deapi",
      models: models.length ? models : [{ id: "Flux_2_Klein_4B_BF16", name: "Flux 2 Klein 4B BF16", type: "image" }],
    });
  } catch (error) {
    console.error("[deapi/models] failed:", error);
    return NextResponse.json(
      { provider: "deapi", models: [], warning: String(error?.message || error) },
      { status: 200 }
    );
  }
}
