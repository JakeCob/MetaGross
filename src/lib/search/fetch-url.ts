/**
 * fetch-url — grab the TEXT CONTENT behind a URL the agent found
 * via search_web so it can actually extract team data from YouTube
 * descriptions, Reddit threads, and VGC blog posts.
 *
 * Strategy per domain:
 *   - YouTube  → oEmbed API gives title + channel; fall back to
 *     scraping the watch-page meta tags for the description.
 *   - Reddit   → append `.json` to the post URL for the structured
 *     selftext + top comments. No auth required.
 *   - Generic  → fetch HTML, strip tags, keep <title> + first N chars.
 *
 * Everything is capped to ~6000 chars so one fetch_url call doesn't
 * blow the model's context. Uses a short timeout + descriptive UA.
 *
 * SERVER-ONLY.
 */
import "server-only";

export interface FetchedUrl {
  url: string;
  domain: string;
  kind: "youtube" | "reddit" | "html" | "json";
  title: string;
  description?: string;
  /** Main body text — already truncated. */
  excerpt: string;
  /** Short tag for why we returned what we did. */
  note?: string;
}

const FETCH_TIMEOUT_MS = 6000;
const MAX_EXCERPT = 6000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; MetaGrossBot/1.0; +https://metagross.local)";

export async function fetchUrl(url: string): Promise<FetchedUrl | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const domain = parsed.hostname.replace(/^www\./, "");

  try {
    if (isYouTube(domain)) return await fetchYouTube(parsed);
    if (isReddit(domain)) return await fetchReddit(parsed);
    return await fetchGeneric(parsed);
  } catch (err) {
    console.info(
      `[fetch-url] ${domain} failed:`,
      err instanceof Error ? err.message : String(err),
    );
    return {
      url,
      domain,
      kind: "html",
      title: "",
      excerpt: "",
      note: err instanceof Error ? err.message : "fetch failed",
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isYouTube(domain: string): boolean {
  return (
    domain === "youtube.com" ||
    domain === "m.youtube.com" ||
    domain === "youtu.be" ||
    domain === "music.youtube.com"
  );
}

function isReddit(domain: string): boolean {
  return (
    domain === "reddit.com" ||
    domain === "old.reddit.com" ||
    domain === "np.reddit.com" ||
    domain === "new.reddit.com"
  );
}

function truncate(s: string, max = MAX_EXCERPT): string {
  const clean = s.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max) + "…[truncated]";
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

async function timedFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        ...(init.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// YouTube
// ---------------------------------------------------------------------------

async function fetchYouTube(url: URL): Promise<FetchedUrl> {
  // oEmbed gives us title + author quickly.
  const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(url.toString())}&format=json`;
  let title = "";
  let author = "";
  try {
    const res = await timedFetch(oembed);
    if (res.ok) {
      const data = (await res.json()) as {
        title?: string;
        author_name?: string;
      };
      title = data.title ?? "";
      author = data.author_name ?? "";
    }
  } catch {
    // fall through to scrape
  }

  // Scrape the watch page for the meta description (usually
  // og:description or description).
  let description = "";
  try {
    const res = await timedFetch(url.toString());
    if (res.ok) {
      const html = await res.text();
      const ogDesc =
        html.match(
          /<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i,
        )?.[1] ??
        html.match(
          /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
        )?.[1];
      if (ogDesc) description = ogDesc;
      if (!title) {
        title = html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? "";
      }
    }
  } catch {
    // ignore — we still have the oembed data
  }

  return {
    url: url.toString(),
    domain: url.hostname.replace(/^www\./, ""),
    kind: "youtube",
    title: title || "(YouTube — title unavailable)",
    description,
    excerpt: truncate(
      [author && `Channel: ${author}`, description].filter(Boolean).join("\n\n"),
    ),
    note:
      description.length === 0
        ? "YouTube hides the full video description from anonymous HTML; only the short meta description is available. Pin team details via other sources."
        : undefined,
  };
}

// ---------------------------------------------------------------------------
// Reddit
// ---------------------------------------------------------------------------

async function fetchReddit(url: URL): Promise<FetchedUrl> {
  // Reddit serves structured JSON for any post URL with `.json` appended.
  const jsonUrl = url.toString().replace(/\/?$/, ".json");
  const res = await timedFetch(jsonUrl);
  if (!res.ok) {
    throw new Error(`reddit HTTP ${res.status}`);
  }
  const data = (await res.json()) as unknown;

  let title = "";
  let selftext = "";
  let author = "";
  const topComments: string[] = [];

  if (Array.isArray(data) && data.length >= 1) {
    const post = (data[0] as { data?: { children?: Array<{ data?: Record<string, unknown> }> } })
      ?.data?.children?.[0]?.data;
    if (post) {
      title = (post.title as string) ?? "";
      selftext = (post.selftext as string) ?? "";
      author = (post.author as string) ?? "";
    }
    const comments =
      (data[1] as { data?: { children?: Array<{ data?: Record<string, unknown> }> } })
        ?.data?.children ?? [];
    for (const c of comments.slice(0, 5)) {
      const body = (c.data?.body as string) ?? "";
      const commentAuthor = (c.data?.author as string) ?? "anon";
      if (body.trim()) topComments.push(`[u/${commentAuthor}]: ${body.trim()}`);
    }
  }

  const body = [
    selftext.trim(),
    topComments.length ? "\n---\nTop comments:\n" + topComments.join("\n") : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    url: url.toString(),
    domain: url.hostname.replace(/^www\./, ""),
    kind: "reddit",
    title: title || "(Reddit post)",
    description: author ? `Posted by u/${author}` : undefined,
    excerpt: truncate(body || "(post body empty)"),
  };
}

// ---------------------------------------------------------------------------
// Generic HTML
// ---------------------------------------------------------------------------

async function fetchGeneric(url: URL): Promise<FetchedUrl> {
  const res = await timedFetch(url.toString());
  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  if (contentType.includes("application/json")) {
    const text = await res.text();
    return {
      url: url.toString(),
      domain: url.hostname.replace(/^www\./, ""),
      kind: "json",
      title: url.pathname,
      excerpt: truncate(text),
    };
  }

  const html = await res.text();
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ?? "";
  const ogDesc =
    html.match(
      /<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i,
    )?.[1] ??
    html.match(
      /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
    )?.[1] ??
    "";
  // Focus on <article> if one exists, else the body — better signal/noise.
  const main =
    html.match(/<article[\s\S]*?<\/article>/i)?.[0] ??
    html.match(/<main[\s\S]*?<\/main>/i)?.[0] ??
    html;
  const body = stripHtml(main);

  return {
    url: url.toString(),
    domain: url.hostname.replace(/^www\./, ""),
    kind: "html",
    title,
    description: ogDesc || undefined,
    excerpt: truncate(body),
  };
}
