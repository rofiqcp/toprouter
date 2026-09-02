import { NextResponse } from "next/server";
import {
  getOauthClients,
  createOauthClient,
} from "@/lib/db/index.js";
import { verifyDashboardAuthToken } from "@/lib/auth/dashboardSession.js";

async function requireDashboardAuth(request) {
  const token = request.cookies.get("auth_token")?.value;
  return !!(await verifyDashboardAuthToken(token));
}

// GET /api/oauth/server/clients — list registered OAuth clients.
export async function GET(request) {
  try {
    if (!(await requireDashboardAuth(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const clients = await getOauthClients();
    return NextResponse.json({ clients });
  } catch (error) {
    console.log("OAuth clients list error:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// POST /api/oauth/server/clients — register a new client (one per Hermes instance).
export async function POST(request) {
  try {
    if (!(await requireDashboardAuth(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { name, label } = await request.json();
    const client = await createOauthClient({
      name: name || "Hermes Agent",
      label: label || null,
    });
    return NextResponse.json({ client });
  } catch (error) {
    console.log("OAuth client create error:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
