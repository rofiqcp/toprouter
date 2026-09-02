import { NextResponse } from "next/server";
import { getUsageStats } from "@/lib/usageDb";

const VALID_PERIODS = new Set(["today", "24h", "7d", "30d", "60d", "all"]);

export const dynamic = "force-dynamic";

// In-memory cache (per server instance) so thousands of dashboard users don't
// all hit Postgres at once. 60s TTL is plenty for usage analytics.
const STATS_CACHE_TTL_MS = 60 * 1000;
const statsCache = new Map();

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "7d";

    if (!VALID_PERIODS.has(period)) {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }

    const now = Date.now();
    const cached = statsCache.get(period);
    if (cached && now - cached.ts < STATS_CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    const stats = await getUsageStats(period);
    statsCache.set(period, { ts: now, data: stats });
    return NextResponse.json(stats);
  } catch (error) {
    console.error("[API] Failed to get usage stats:", error);
    return NextResponse.json({ error: "Failed to fetch usage stats" }, { status: 500 });
  }
}
