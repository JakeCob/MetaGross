import { fetchUrl } from "@/lib/search/fetch-url";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/learn-url
 *
 * Extract readable content from any website or YouTube URL so the app can
 * "learn" from it. Uses the shared fetch-url extractor (raw scrape +
 * Jina reader for JS pages / YouTube descriptions). Session-gated.
 *
 * Body: { url: string }
 * Response: { url, kind, title, description?, content, note? }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url) {
      return Response.json({ error: "A url is required." }, { status: 400 });
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return Response.json({ error: "That isn't a valid URL." }, { status: 400 });
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return Response.json(
        { error: "Only http(s) URLs are supported." },
        { status: 400 },
      );
    }

    const result = await fetchUrl(url);
    if (!result || (!result.excerpt && !result.title)) {
      return Response.json(
        { error: "Couldn't extract readable content from that URL." },
        { status: 502 },
      );
    }

    return Response.json({
      url: result.url,
      kind: result.kind,
      title: result.title,
      description: result.description,
      content: result.excerpt,
      note: result.note,
    });
  } catch (err) {
    console.error("POST /api/learn-url error:", err);
    return Response.json({ error: "Failed to read that URL." }, { status: 500 });
  }
}
