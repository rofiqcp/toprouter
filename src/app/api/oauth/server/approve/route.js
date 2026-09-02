import { NextResponse } from "next/server";
import { approveDeviceCode, denyDeviceCode, getDeviceRecordByUserCode } from "@/lib/oauth/server/oauthServer.js";
import { verifyDashboardAuthToken } from "@/lib/auth/dashboardSession.js";

// All server routes require an authenticated dashboard session (JWT cookie).
async function requireDashboardAuth(request) {
  const token = request.cookies.get("auth_token")?.value;
  return !!(await verifyDashboardAuthToken(token));
}

// POST /api/oauth/server/approve  — approve or deny a pending device code.
export async function POST(request) {
  try {
    if (!(await requireDashboardAuth(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { userCode, decision, label } = await request.json();
    if (!userCode) {
      return NextResponse.json({ error: "userCode required" }, { status: 400 });
    }

    const rec = getDeviceRecordByUserCode(userCode);
    if (!rec) {
      return NextResponse.json({ error: "not_found", message: "User code not found or expired" }, { status: 404 });
    }

    if (decision === "deny") {
      denyDeviceCode(userCode);
      return NextResponse.json({ ok: true, status: "denied" });
    }

    // Approve — embed identity claims into the eventual JWT.
    const claims = {
      clientId: rec.clientId,
      sub: label || rec.label || rec.clientId,
      label: label || rec.label || null,
    };
    const updated = approveDeviceCode(userCode, claims);
    return NextResponse.json({
      ok: true,
      status: "approved",
      clientId: updated.clientId,
    });
  } catch (error) {
    console.log("OAuth approve error:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// GET /api/oauth/server/pending — list pending device codes for the approval UI.
export async function GET(request) {
  try {
    if (!(await requireDashboardAuth(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { listPendingDevices } = await import("@/lib/oauth/server/oauthServer.js");
    return NextResponse.json({ devices: listPendingDevices() });
  } catch (error) {
    console.log("OAuth pending error:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
