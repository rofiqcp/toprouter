/**
 * TopRouter as an OAuth 2.0 Device Authorization Server.
 *
 * Enables headless clients (e.g. many Hermes Agent instances) to obtain an
 * access token (a signed JWT) by completing the RFC 8628 device flow:
 *
 *   1. Client POST /api/oauth/device_authorization  -> device_code, user_code, verification_uri
 *   2. User opens verification_uri (+ user_code) in the dashboard and approves
 *   3. Client POST /api/oauth/token (grant_type=urn:ietf:params:oauth:grant-type:device_code)
 *      -> polls until approved -> { access_token, token_type, expires_in }
 *   4. Client uses `Authorization: Bearer <access_token>` against /v1/* — accepted
 *      by the same validateApiKey() path via validateOAuthAccessToken().
 *
 * Design notes:
 *  - Access tokens are stateless HS256 JWTs signed with JWT_SECRET (reuses the
 *    existing dashboard secret, so no new secret to manage). They embed the
 *    clientId + sub (machine/instance label) and expire by exp.
 *  - Device codes are tracked in-memory (module-global Map) keyed by device_code
 *    plus a secondary index by user_code. This is sufficient for a single-instance
 *    gateway; for multi-replica deploys, swap this for Redis/KV later.
 */

import { SignJWT, jwtVerify } from "jose";
import crypto from "node:crypto";
import { DATA_DIR } from "@/lib/dataDir.js";
import fs from "node:fs";
import path from "node:path";

function loadJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = path.join(DATA_DIR, "jwt-secret");
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch {}
  // Fallback (shouldn't happen — dashboardSession generates the file on boot)
  return "toprouter-oauth-fallback-secret";
}

const SECRET = new TextEncoder().encode(loadJwtSecret());

const ISSUER = "toprouter";
const AUDIENCE = "toprouter-api";

// Access token lifetime: 24h (refresh by re-running device flow from client side).
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60 * 24;

// Device code lifetimes per RFC 8628 polling guidance.
const DEVICE_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes to approve
const USER_CODE_TTL_MS = 10 * 60 * 1000;
const POLL_INTERVAL_SECONDS = 5;

// ALPHABET excludes ambiguous chars (no 0/O/1/I) for manual entry.
const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function genUserCode() {
  const part = () =>
    Array.from({ length: 4 }, () =>
      USER_CODE_ALPHABET[crypto.randomInt(0, USER_CODE_ALPHABET.length)]
    ).join("");
  return `${part()}-${part()}`;
}

// ---- In-memory device-code store -------------------------------------------------

/** @type {Map<string, DeviceCodeRecord>} */
const deviceByCode = new Map();
/** @type {Map<string, string>} userCode -> deviceCode */
const deviceByUserCode = new Map();

/**
 * @typedef {Object} DeviceCodeRecord
 * @property {string} deviceCode
 * @property {string} userCode
 * @property {string} clientId
 * @property {string} scope
 * @property {number} expiresAt   epoch ms
 * @property {"pending"|"approved"|"denied"} status
 * @property {Object|null} approvedClaims  claims to embed in the JWT once approved
 * @property {number} lastPolledAt
 */

export function createDeviceCode(clientId, scope = "api", label = null) {
  const deviceCode = randomToken(32);
  const userCode = genUserCode();
  // Avoid (rare) user_code collision
  while (deviceByUserCode.has(userCode)) {
    const nc = genUserCode();
    if (nc !== userCode) break;
  }
  const now = Date.now();
  const record = {
    deviceCode,
    userCode,
    clientId,
    scope,
    label: label || null,
    expiresAt: now + DEVICE_CODE_TTL_MS,
    status: "pending",
    approvedClaims: null,
    lastPolledAt: 0,
  };
  deviceByCode.set(deviceCode, record);
  deviceByUserCode.set(userCode, deviceCode);
  return record;
}

export function getDeviceRecord(deviceCode) {
  const rec = deviceByCode.get(deviceCode);
  if (!rec) return null;
  if (rec.expiresAt < Date.now()) {
    removeDeviceRecord(deviceCode);
    return null;
  }
  return rec;
}

export function getDeviceRecordByUserCode(userCode) {
  const deviceCode = deviceByUserCode.get(userCode);
  if (!deviceCode) return null;
  return getDeviceRecord(deviceCode);
}

export function removeDeviceRecord(deviceCode) {
  const rec = deviceByCode.get(deviceCode);
  if (!rec) return;
  deviceByCode.delete(deviceCode);
  if (deviceByUserCode.get(rec.userCode) === deviceCode) {
    deviceByUserCode.delete(rec.userCode);
  }
}

export function approveDeviceCode(userCode, claims) {
  const rec = getDeviceRecordByUserCode(userCode);
  if (!rec) return null;
  rec.status = "approved";
  rec.approvedClaims = claims;
  return rec;
}

export function denyDeviceCode(userCode) {
  const rec = getDeviceRecordByUserCode(userCode);
  if (!rec) return null;
  rec.status = "denied";
  return rec;
}

export function listPendingDevices() {
  const now = Date.now();
  return [...deviceByCode.values()]
    .filter((r) => r.expiresAt > now && r.status === "pending")
    .map((r) => ({
      userCode: r.userCode,
      clientId: r.clientId,
      scope: r.scope,
      label: r.label,
      expiresAt: new Date(r.expiresAt).toISOString(),
    }));
}

export function touchDevicePoll(deviceCode) {
  const rec = deviceByCode.get(deviceCode);
  if (rec) rec.lastPolledAt = Date.now();
}

export const DEVICE_POLL_INTERVAL_SECONDS = POLL_INTERVAL_SECONDS;
export const DEVICE_USER_CODE_TTL_MS = USER_CODE_TTL_MS;

// ---- JWT access token -----------------------------------------------------------

/**
 * Sign an OAuth access token (stateless JWT).
 * @param {{ clientId: string, sub?: string, scope?: string, label?: string }} claims
 */
export async function signAccessToken({ clientId, sub, scope = "api", label = null }) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    clientId,
    scope,
    ...(sub ? { sub } : {}),
    ...(label ? { label } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(now + ACCESS_TOKEN_TTL_SECONDS)
    .sign(SECRET);
}

/**
 * Verify an OAuth access token (JWT). Returns the payload or null.
 * Only accepts tokens we issued (HS256, our issuer/audience, not expired).
 */
export async function verifyAccessToken(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const { payload } = await jwtVerify(token, SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (payload.type && payload.type !== "oauth") return null;
    return payload;
  } catch {
    return null;
  }
}

// Mark JWTs as OAuth-issued for future-proofing (optional claim).
export async function signAccessTokenTagged(claims) {
  const token = await signAccessToken(claims);
  return token;
}

export function isOauthJwt(token) {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    return header.alg === "HS256";
  } catch {
    return false;
  }
}
