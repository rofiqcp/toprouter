/**
 * OAuth client registry for TopRouter acting as a Device Authorization Server.
 *
 * A "client" represents a headless consumer that will log in via the device flow
 * — e.g. a Hermes Agent instance. Clients are public (no secret, RFC 8628
 * device flow is designed for untrusted/embedded clients), identified by a
 * client_id + optional machine/instance label.
 */

import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";

function rowToClient(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    label: row.label,
    isActive: row.isActive === 1 || row.isActive === true,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt || null,
  };
}

export async function getOauthClients() {
  const db = await getAdapter();
  const rows = await db.all(`SELECT * FROM oauthClients ORDER BY createdAt ASC`);
  return rows.map(rowToClient);
}

export async function getOauthClientById(id) {
  const db = await getAdapter();
  const row = await db.get(`SELECT * FROM oauthClients WHERE id = ?`, [id]);
  return rowToClient(row);
}

export async function createOauthClient({ name, label = null }) {
  const db = await getAdapter();
  const client = {
    id: uuidv4(),
    name: name || "Hermes Agent",
    label: label || null,
    isActive: 1,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  };
  await db.run(
    `INSERT INTO oauthClients(id, name, label, isActive, createdAt, lastUsedAt) VALUES(?, ?, ?, ?, ?, ?)`,
    [client.id, client.name, client.label, 1, client.createdAt, null]
  );
  return client;
}

export async function updateOauthClient(id, data) {
  const db = await getAdapter();
  const existing = await getOauthClientById(id);
  if (!existing) return null;
  const merged = { ...existing, ...data };
  await db.run(
    `UPDATE oauthClients SET name = ?, label = ?, isActive = ? WHERE id = ?`,
    [merged.name, merged.label, merged.isActive ? 1 : 0, id]
  );
  return merged;
}

export async function deleteOauthClient(id) {
  const db = await getAdapter();
  const res = await db.run(`DELETE FROM oauthClients WHERE id = ?`, [id]);
  return (res?.changes ?? 0) > 0;
}

export async function touchOauthClient(id) {
  const db = await getAdapter();
  await db.run(`UPDATE oauthClients SET lastUsedAt = ? WHERE id = ?`, [
    new Date().toISOString(),
    id,
  ]);
}
