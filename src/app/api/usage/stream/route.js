import { statsEmitter, getActiveRequests } from "@/lib/usageDb";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  const state = { closed: false, keepalive: null, send: null, sendPending: null };

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (data) => {
        if (state.closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          state.closed = true;
          cleanup();
        }
      };

      // On "update" event: send lightweight real-time data only
      // (activeRequests, recentRequests, errorProvider, pending)
      // Full stats (byModel, byProvider, etc.) are fetched via REST /api/usage/stats
      state.send = async () => {
        if (state.closed) return;
        try {
          const data = await getActiveRequests();
          enqueue(data);
        } catch {
          // Ignore — next tick will retry
        }
      };

      // On "pending" event: same lightweight push
      state.sendPending = state.send;

      // Initial push
      await state.send();

      statsEmitter.on("update", state.send);
      statsEmitter.on("pending", state.sendPending);

      state.keepalive = setInterval(() => {
        if (state.closed) { clearInterval(state.keepalive); return; }
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          state.closed = true;
          cleanup();
        }
      }, 25000);
    },

    cancel() {
      state.closed = true;
      cleanup();
    },
  });

  function cleanup() {
    statsEmitter.off("update", state.send);
    statsEmitter.off("pending", state.sendPending);
    clearInterval(state.keepalive);
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
