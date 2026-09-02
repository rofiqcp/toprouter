"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function OAuthDeviceApproveInner() {
  const params = useSearchParams();
  const userCode = params.get("user_code") || "";
  const [code, setCode] = useState(userCode);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [label, setLabel] = useState("");

  async function doDecision(decision) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/oauth/server/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userCode: code.trim().toUpperCase(), decision, label: label.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.message || "Failed");
      } else {
        setResult(decision === "deny" ? "denied" : "approved");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md bg-card rounded-xl border border-border p-6 shadow-sm">
        <h1 className="text-lg font-semibold mb-1">Approve Device Login</h1>
        <p className="text-sm text-text-muted mb-4">
          A Hermes Agent (or other client) is requesting access to this TopRouter gateway.
        </p>

        {result ? (
          <div className={`p-3 rounded-lg text-sm ${result === "approved" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}>
            {result === "approved" ? "✓ Approved. The client can now retrieve its token." : "✕ Denied."}
          </div>
        ) : (
          <>
            <label className="block text-xs font-medium text-text-main mb-1">User Code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="XXXX-XXXX"
              className="w-full px-3 py-2 rounded border border-border bg-surface text-sm uppercase mb-3 focus:outline-none focus:ring-1 focus:ring-primary"
            />

            <label className="block text-xs font-medium text-text-main mb-1">Label (optional)</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. hermes-laptop-01"
              className="w-full px-3 py-2 rounded border border-border bg-surface text-sm mb-4 focus:outline-none focus:ring-1 focus:ring-primary"
            />

            {error && <div className="text-xs text-red-500 mb-3">{error}</div>}

            <div className="flex gap-2">
              <button
                disabled={loading || !code.trim()}
                onClick={() => doDecision("approve")}
                className="flex-1 py-2 rounded bg-primary text-white text-sm font-medium disabled:opacity-50"
              >
                {loading ? "..." : "Approve"}
              </button>
              <button
                disabled={loading || !code.trim()}
                onClick={() => doDecision("deny")}
                className="flex-1 py-2 rounded border border-border text-sm disabled:opacity-50"
              >
                Deny
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function OAuthDeviceApprovePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
      <OAuthDeviceApproveInner />
    </Suspense>
  );
}
