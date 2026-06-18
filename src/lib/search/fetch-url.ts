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
const JINA_TIMEOUT_MS = 22000; // Jina reader renders JS pages — give it room.
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
    if (isYouTube(domain)) {
      // Prefer the watch-page scrape: it returns the CLEAN full description
      // (chapters, team cores, pokepaste links) straight from
      // ytInitialPlayerResponse — no nav chrome. Only fall back to the reader
      // when that description comes back thin.
      const base = await fetchYouTube(parsed);
      const baseLen = base.excerpt.replace(/…\[truncated\]$/, "").length;
      if (baseLen >= 400) return base;
      const jina = await fetchViaJina(url);
      if (jina && jina.text.length > base.excerpt.length) {
        return {
          ...base,
          title: base.title || jina.title,
          excerpt: truncate(jina.text),
          note: "Read via reader (watch-page description was thin).",
        };
      }
      return base;
    }
    if (isReddit(domain)) return await fetchReddit(parsed);

    // Generic page: fast raw scrape; if it comes back thin (SPA / JS page),
    // fall back to the reader.
    const base = await fetchGeneric(parsed);
    const baseLen = base.excerpt.replace(/…\[truncated\]$/, "").length;
    if (baseLen < 500) {
      const jina = await fetchViaJina(url);
      if (jina && jina.text.length > base.excerpt.length) {
        return {
          ...base,
          title: base.title || jina.title,
          excerpt: truncate(jina.text),
          note: "Read via reader (raw HTML was thin).",
        };
      }
    }
    return base;
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
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
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

/**
 * Universal reader via Jina (r.jina.ai) — renders JS pages and returns clean
 * markdown. This is how we read content the raw HTML scrape can't: YouTube
 * descriptions/chapters (where team cores + pokepaste links live), SPA blogs,
 * etc. Strips obvious nav/link/image chrome so the model sees prose. Returns
 * null on failure so callers fall back to the raw scrape.
 */
async function fetchViaJina(
  rawUrl: string,
): Promise<{ title: string; text: string } | null> {
  try {
    const res = await timedFetch(
      `https://r.jina.ai/${rawUrl}`,
      {},
      JINA_TIMEOUT_MS,
    );
    if (!res.ok) return null;
    const md = await res.text();
    const title = md.match(/^Title:\s*(.+)$/m)?.[1]?.trim() ?? "";
    const text = md
      .replace(/^Title:.*$/m, "")
      .replace(/^URL Source:.*$/m, "")
      .replace(/^Markdown Content:\s*/m, "")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => {
        if (!l) return false;
        // Drop lines that are purely a link or image (nav chrome).
        if (/^!?\[[^\]]*\]\([^)]*\)\/?$/.test(l)) return false;
        // Drop common YouTube/site UI tokens.
        if (
          /^(Skip navigation|Search( with your voice)?|Sign in|Tap to unmute|Back|Show more|Show less|Copy link|Info|Share|Save|Download|\d+x|New|Subscribe|Subscribed|Like|Dislike|Shorts|Home|Explore)$/i.test(
            l,
          )
        ) {
          return false;
        }
        return true;
      })
      .join("\n")
      .replace(/\n{3,}/g, "\n\n");
    return text.length > 0 ? { title, text } : null;
  } catch {
    return null;
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

  // Scrape the watch page. The 140-char og:description is useless
  // for team content — the FULL description (where Pokepaste links +
  // team lists live) is hidden in an embedded JSON blob called
  // ytInitialPlayerResponse. Pull it out first; fall back to
  // og:description only when extraction fails.
  let description = "";
  let fullDescription = "";
  try {
    const res = await timedFetch(url.toString());
    if (res.ok) {
      const html = await res.text();

      fullDescription = extractYouTubeFullDescription(html) ?? "";

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

  // Prefer the full description when we have it; fall back to og.
  const bodyDesc = fullDescription || description;

  return {
    url: url.toString(),
    domain: url.hostname.replace(/^www\./, ""),
    kind: "youtube",
    title: title || "(YouTube — title unavailable)",
    description: description || fullDescription.slice(0, 200),
    excerpt: truncate(
      [author && `Channel: ${author}`, bodyDesc].filter(Boolean).join("\n\n"),
    ),
    note:
      bodyDesc.length === 0
        ? "Could not extract the full description. The og:description snippet is usually a 140-char SEO blurb; pin team details via another source."
        : fullDescription
          ? undefined
          : "Only the short og:description was retrieved — the full description extraction failed.",
  };
}

/**
 * Pull the full video description out of YouTube's embedded
 * ytInitialPlayerResponse JSON. Resilient to the varying syntax
 * patterns YouTube emits (`ytInitialPlayerResponse = {…};`,
 * `var ytInitialPlayerResponse = …`, etc.).
 */
function extractYouTubeFullDescription(html: string): string | null {
  const patterns = [
    /ytInitialPlayerResponse\s*=\s*(\{[\s\S]+?\})\s*;\s*(?:var\s+meta|ytInitialData|<\/script>|window\[)/,
    /ytInitialPlayerResponse"\s*:\s*(\{[\s\S]+?\})\s*,\s*"ytcfg/,
    /"videoDetails"\s*:\s*(\{[\s\S]+?"shortDescription"\s*:\s*"[\s\S]*?"[\s\S]*?\})/,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (!m) continue;
    try {
      const obj = JSON.parse(m[1]) as {
        videoDetails?: { shortDescription?: string };
        shortDescription?: string;
      };
      const desc =
        obj.videoDetails?.shortDescription ?? obj.shortDescription ?? null;
      if (desc && desc.length > 0) return desc;
    } catch {
      // try next pattern
    }
  }
  // Last-resort regex: just match the shortDescription JSON field
  // directly. YouTube JSON-encodes newlines as \n and quotes as \",
  // so we decode those back out.
  const direct = html.match(/"shortDescription":"((?:\\.|[^"\\])*)"/);
  if (direct) {
    try {
      // Re-wrap as a JSON string to get decoding for free.
      return JSON.parse(`"${direct[1]}"`);
    } catch {
      return null;
    }
  }
  return null;
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
