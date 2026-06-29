/**
 * Express → Web API adapter.
 *
 * Converts Express (req, res) into Web API (Request, Response) objects
 * so the existing SSE handlers (which all take `Request` → return `Response`)
 * can be reused without any changes.
 */

import { Readable } from "node:stream";

/**
 * Build a Web API Request from an Express req.
 * Handles JSON bodies, FormData (multipart), and raw streams.
 */
export function expressToWebRequest(req, baseUrl) {
  const url = `${baseUrl}${req.originalUrl || req.url}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }

  // Body handling
  let body;
  if (req.is("multipart/form-data") || req.is("application/octet-stream")) {
    // Pass raw Node readable stream — Web API Request accepts Uint8Array | string | ReadableStream | null
    body = Readable.toWeb(req);
  } else if (req.body && typeof req.body === "object") {
    // Express already parsed JSON — repack as string so handler can call request.json()
    body = JSON.stringify(req.body);
    headers.set("Content-Type", "application/json");
  } else if (typeof req.body === "string") {
    body = req.body;
  } else {
    // No body parsed yet — pass the raw stream
    if (req.readable) {
      body = Readable.toWeb(req);
    } else {
      body = null;
    }
  }

  return new Request(url, { duplex: "half",
    method: req.method,
    headers,
    body: ["GET", "HEAD"].includes(req.method) ? null : body,
  });
}

/**
 * Pipe a Web API Response back into an Express res.
 * Handles SSE streams (text/event-stream), JSON, and binary.
 */
export async function webResponseToExpress(webResponse, res) {
  // Status
  res.status(webResponse.status);

  // Headers
  for (const [key, value] of webResponse.headers.entries()) {
    // Skip transfer-encoding — Express handles chunking
    if (key.toLowerCase() === "transfer-encoding") continue;
    res.setHeader(key, value);
  }

  // Body
  const contentType = webResponse.headers.get("content-type") || "";

  if (contentType.startsWith("text/event-stream") || webResponse.body) {
    // Streaming response (SSE or any stream) — pipe body ReadableStream → Node stream → Express res
    if (webResponse.body) {
      const nodeStream = Readable.fromWeb(webResponse.body);
      nodeStream.pipe(res, { end: true });

      // Handle stream errors
      nodeStream.on("error", (err) => {
        console.error("[adapter] Stream error:", err.message);
        if (!res.headersSent) res.status(500).json({ error: "Stream error" });
        res.end();
      });
    } else {
      res.end();
    }
  } else {
    // Non-streaming — buffer and send
    const buf = await webResponse.arrayBuffer();
    if (buf.byteLength > 0) {
      res.end(Buffer.from(buf));
    } else {
      res.end();
    }
  }
}
