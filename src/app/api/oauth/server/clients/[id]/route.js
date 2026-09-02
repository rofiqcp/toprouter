import { NextResponse } from "next/server";
import {
  updateOauthClient,
  deleteOauthClient,
} from "@/lib/db/index.js";
import { verifyDashboardAuthToken } from "@/lib/auth/dashboardSession.js";

async function requireDashboardAuth(request) {
  const token = request.cookies.get("auth_token")?.value;
  return !!(await verifyDashboardAuthToken(token));
}

// DELETE /api/oauth/server/clients/[id] — revoke a client.
export async function DELETE(request, { params }) {
  try {
    if (!(await requireDashboardAuth(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const ok = await deleteOauthClient(id);
    return NextResponse.json({ ok });
  } catch (error) {
    console.log("OAuth client delete error:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// PATCH /api/oauth/server/clients/[id] — rename / enable-disable.
export async function PATCH(request, { params }) {
  try {
    if (!(await requireDashboardAuth(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const { name, label, isActive } = await request.json();
    const updated = await updateOauthClient(id, { name, label, isActive });
    if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ client: updated });
  } catch (error) {
    console.log("OAuth client patch error:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
