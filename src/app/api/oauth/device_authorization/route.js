import { NextResponse } from "next/server";
import {
  createDeviceCode,
  getDeviceRecord,
  DEVICE_POLL_INTERVAL_SECONDS,
} from "@/lib/oauth/server/oauthServer.js";
import { getOauthClientById, touchOauthClient } from "@/lib/db/index.js";

// POST /api/oauth/device_authorization
// RFC 8628 §3.1 — client requests a device + user code.
export async function POST(request) {
  try {
    let body = {};
    try {
      body = await request.json();
    } catch {}

    const clientId = body.client_id;
    const scope = typeof body.scope === "string" && body.scope ? body.scope : "api";
    const label = typeof body.label === "string" ? body.label.slice(0, 128) : null;

    if (!clientId) {
      return NextResponse.json(
        { error: "invalid_request", error_description: "client_id is required" },
        { status: 400 }
      );
    }

    const client = await getOauthClientById(clientId);
    if (!client || !client.isActive) {
      return NextResponse.json(
        { error: "invalid_client", error_description: "Unknown or disabled OAuth client" },
        { status: 401 }
      );
    }

    await touchOauthClient(clientId);

    const rec = createDeviceCode(clientId, scope, label);
    const verificationUri = `/dashboard/oauth/device`;
    const verificationUriComplete = `${verificationUri}?user_code=${rec.userCode}`;

    return NextResponse.json({
      device_code: rec.deviceCode,
      user_code: rec.userCode,
      verification_uri: verificationUri,
      verification_uri_complete: verificationUriComplete,
      expires_in: Math.floor((rec.expiresAt - Date.now()) / 1000),
      interval: DEVICE_POLL_INTERVAL_SECONDS,
    });
  } catch (error) {
    console.log("OAuth device_authorization error:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
