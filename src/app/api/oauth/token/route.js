import { NextResponse } from "next/server";
import {
  getDeviceRecord,
  approveDeviceCode,
  signAccessToken,
  ACCESS_TOKEN_TTL_SECONDS,
  touchDevicePoll,
} from "@/lib/oauth/server/oauthServer.js";
import { getOauthClientById } from "@/lib/db/index.js";

// POST /api/oauth/token
// RFC 8628 §3.4 — client polls with the device_code.
export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let params;
    if (contentType.includes("application/x-www-form-urlencoded")) {
      params = Object.fromEntries((await request.formData()).entries());
    } else {
      try {
        params = await request.json();
      } catch {
        params = {};
      }
    }

    const grantType = params.grant_type;

    if (grantType !== "urn:ietf:params:oauth:grant-type:device_code") {
      return NextResponse.json(
        { error: "unsupported_grant_type", error_description: "Only device_code grant is supported" },
        { status: 400 }
      );
    }

    const deviceCode = params.device_code;
    if (!deviceCode) {
      return NextResponse.json(
        { error: "invalid_request", error_description: "device_code is required" },
        { status: 400 }
      );
    }

    const rec = getDeviceRecord(deviceCode);
    if (!rec) {
      return NextResponse.json(
        { error: "expired_token", error_description: "Device code expired or not found" },
        { status: 400 }
      );
    }

    touchDevicePoll(deviceCode);

    if (rec.status === "pending") {
      return NextResponse.json(
        { error: "authorization_pending", error_description: "Awaiting user approval" },
        { status: 400 }
      );
    }

    if (rec.status === "denied") {
      return NextResponse.json(
        { error: "access_denied", error_description: "The user denied the request" },
        { status: 400 }
      );
    }

    // approved
    const client = await getOauthClientById(rec.clientId);
    if (!client || !client.isActive) {
      return NextResponse.json(
        { error: "invalid_client", error_description: "OAuth client no longer valid" },
        { status: 401 }
      );
    }

    const accessToken = await signAccessToken({
      clientId: rec.clientId,
      sub: client.label || client.name,
      scope: rec.scope,
      label: rec.label || client.name,
    });

    return NextResponse.json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      scope: rec.scope,
    });
  } catch (error) {
    console.log("OAuth token error:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
