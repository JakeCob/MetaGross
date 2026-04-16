/**
 * Tiny shared SSE parser for client-side `fetch` consumers.
 *
 * Both /api/ev-debate and /api/opponent-scouting emit the same
 * "event: X\ndata: <json>\n\n" shape. This helper consumes a
 * ReadableStreamDefaultReader and dispatches to a handler map.
 *
 * The reader's backing fetch can be aborted via the AbortController
 * the caller passes to fetch — there's no dispose needed here.
 */

export type SSEHandler = (data: Record<string, unknown>) => void;

export async function consumeSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  handlers: Record<string, SSEHandler>,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Split on double-newline (SSE event delimiter) so we can keep the
    // trailing incomplete event in the buffer.
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const rawEvent of events) {
      if (!rawEvent.trim()) continue;
      let eventName = "message";
      let dataLine = "";
      for (const line of rawEvent.split("\n")) {
        if (line.startsWith("event: ")) eventName = line.slice(7).trim();
        else if (line.startsWith("data: ")) dataLine += line.slice(6);
      }
      if (!dataLine) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(dataLine);
      } catch {
        continue;
      }
      const handler = handlers[eventName];
      if (handler && parsed && typeof parsed === "object") {
        handler(parsed as Record<string, unknown>);
      }
    }
  }
}
