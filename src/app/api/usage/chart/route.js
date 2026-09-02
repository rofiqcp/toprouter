import { NextResponse } from "next/server";
import { getChartData } from "@/lib/usageDb";

const VALID_PERIODS = new Set(["today", "24h", "7d", "30d", "60d"]);

// In-memory cache (per server instance) so thousands of dashboard users don't
// all hit Postgres at once. 60s TTL is plenty for usage analytics.
const CHART_CACHE_TTL_MS = 60 * 1000;
const chartCache = new Map();

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "7d";

    if (!VALID_PERIODS.has(period)) {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }

    const now = Date.now();
    const cached = chartCache.get(period);
    if (cached && now - cached.ts < CHART_CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    const data = await getChartData(period);
    chartCache.set(period, { ts: now, data });
    return NextResponse.json(data);
  } catch (error) {
    console.error("[API] Failed to get chart data:", error);
    return NextResponse.json({ error: "Failed to fetch chart data" }, { status: 500 });
  }
}
