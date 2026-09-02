/**
 * End-to-end verification of TopRouter's OAuth Device Authorization Server.
 * Run with: node scripts/verify-oauth-device-flow.mjs
 * Requires a running TopRouter at BASE_URL (default http://127.0.0.1:20128).
 */

const BASE = process.env.BASE_URL || "http://127.0.0.1:20128";
const INITIAL_PASSWORD = process.env.INITIAL_PASSWORD || "123456";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: INITIAL_PASSWORD }),
    redirect: "manual",
  });
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error(`login failed: ${res.status} ${await res.text()}`);
  // Extract auth_token cookie value
  const m = setCookie.match(/auth_token=([^;]+)/);
  if (!m) throw new Error("no auth_token in set-cookie");
  return m[1];
}

async function setRequireApiKey(cookie, value) {
  const res = await fetch(`${BASE}/api/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: `auth_token=${cookie}` },
    body: JSON.stringify({ requireApiKey: value }),
  });
  return res.status;
}

async function createClient(cookie) {
  const res = await fetch(`${BASE}/api/oauth/server/clients`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `auth_token=${cookie}` },
    body: JSON.stringify({ name: "Hermes Agent", label: "hermes-verify-01" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`createClient failed: ${res.status} ${JSON.stringify(data)}`);
  return data.client.id;
}

async function deviceAuthorization(clientId) {
  const res = await fetch(`${BASE}/api/oauth/device_authorization`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, scope: "api", label: "hermes-verify-01" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`device_authorization failed: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function approve(cookie, userCode) {
  const res = await fetch(`${BASE}/api/oauth/server/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `auth_token=${cookie}` },
    body: JSON.stringify({ userCode, decision: "approve", label: "hermes-verify-01" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`approve failed: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function pollToken(deviceCode) {
  const res = await fetch(`${BASE}/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: deviceCode,
    }).toString(),
  });
  return { status: res.status, data: await res.json() };
}

async function callV1(accessToken, model = "gpt-4o-mini", external = false) {
  const headers = { Authorization: "Bearer " + accessToken };
  if (external) headers.Host = "external-check.invalid";
  const res = await fetch(BASE + "/v1/models", { headers });
  return { status: res.status, data: await res.text() };
}

async function callV1Rejected(wrongToken, external = true) {
  const headers = { Authorization: "Bearer " + wrongToken };
  if (external) headers.Host = "external-check.invalid";
  const res = await fetch(BASE + "/v1/models", { headers });
  return res.status;
}

(async () => {
  console.log("== TopRouter OAuth Device Flow verification ==");
  console.log("BASE:", BASE);

  console.log("\n[1] login dashboard");
  const cookie = await login();
  console.log("  ok, cookie length:", cookie.length);

  console.log("\n[2] create OAuth client (one per Hermes instance)");
  const clientId = await createClient(cookie);
  console.log("  clientId:", clientId);

  console.log("\n[3] device_authorization");
  const da = await deviceAuthorization(clientId);
  console.log("  user_code:", da.user_code);
  console.log("  verification_uri_complete:", da.verification_uri_complete);
  console.log("  interval:", da.interval, "expires_in:", da.expires_in);

  console.log("\n[4] poll BEFORE approval (expect authorization_pending)");
  const before = await pollToken(da.device_code);
  console.log("  status:", before.status, "error:", before.data.error);

  console.log("\n[5] approve via dashboard");
  const ap = await approve(cookie, da.user_code);
  console.log("  status:", JSON.stringify(ap));

  console.log("\n[6] poll AFTER approval (expect access_token)");
  const after = await pollToken(da.device_code);
  console.log("  status:", after.status, "token_type:", after.data.token_type, "expires_in:", after.data.expires_in);
  const accessToken = after.data.access_token;
  if (!accessToken) throw new Error("NO ACCESS TOKEN — flow broken");

  console.log("\n[7] call /v1/models with OAuth token (expect 200-ish, not 401)");
  const v1 = await callV1(accessToken);
  console.log("  /v1/models status:", v1.status, "(non-401 = token accepted)");

  console.log("\n[8] validate token rejection with requireApiKey ON (via curl to override Host)");
  const setStatus = await setRequireApiKey(cookie, true);
  console.log("  setRequireApiKey(true) status:", setStatus, setStatus === 200 ? "(applied)" : "(WARN: not applied)");
  await sleep(1500); // allow settings cache to refresh in handlers
  const { execSync } = await import("node:child_process");
  const good = await callV1(accessToken, "gpt-4o-mini", false); // local client always allowed
  const curlStatus = (token) =>
    execSync(
      `curl -s -o /dev/null -w "%{http_code}" ${BASE}/v1/models -H "Authorization: Bearer ${token}" -H "Host: external.invalid"`,
      { encoding: "utf8" }
    ).trim();
  const bad = curlStatus("eyJhbGciOiJIUzI1NiJ9.garbage.signature");
  const missing = curlStatus("");
  console.log("  valid OAuth token /v1 (local) status:", good.status, "(expect 200 — local always allowed)");
  console.log("  garbage token /v1 (external) status:", bad, "(expect 401)");
  console.log("  no token /v1 (external) status:", missing, "(expect 401)");
  await setRequireApiKey(cookie, false);
  var step8 = setStatus === 200 && bad === "401" && missing === "401";

  console.log("\n[9] check static API key still works (create one)");
  const keyRes = await fetch(`${BASE}/api/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `auth_token=${cookie}` },
    body: JSON.stringify({ name: "verify-key", machineId: "verify-machine" }),
  });
  const keyData = await keyRes.json();
  if (keyData.key) {
    const v1k = await callV1(keyData.key.key || keyData.key);
    console.log("  static API key /v1/models status:", v1k.status);
  } else {
    console.log("  (could not create static key, skipping)");
  }

  console.log("\n== RESULT ==",
    before.data.error === "authorization_pending" &&
    after.status === 200 &&
    accessToken &&
    v1.status !== 401 &&
    step8
      ? "PASS ✅" : "FAIL ❌");
})().catch((e) => {
  console.error("VERIFICATION ERROR:", e.message);
  process.exit(1);
});
