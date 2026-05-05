import "server-only";

/**
 * Text embeddings for MetaGross's cross-thread memory.
 *
 * Claude doesn't expose embeddings — we use OpenAI's text-embedding-3-small
 * when an OPENAI_API_KEY is present. If not, `embed()` returns null and the
 * memory retriever falls back to keyword matching.
 *
 * Dimensions are 1536 for text-embedding-3-small. Store vectors as a JSON
 * array of floats (small enough for the row counts we expect — a chat-heavy
 * user might rack up a few hundred memories, not millions).
 */

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;

export interface EmbedResult {
  vector: number[];
  model: string;
}

/**
 * Embed a single string. Returns null if OPENAI_API_KEY isn't set or the
 * API call fails — callers should fall back to keyword search.
 */
export async function embed(text: string): Promise<EmbedResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const cleaned = text.trim().slice(0, 8000); // text-embedding-3-small caps at 8k tokens, 8k chars is a safe floor
  if (!cleaned) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: cleaned,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(`[embeddings] ${res.status} ${res.statusText}`);
      return null;
    }
    const data = (await res.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    const vector = data.data?.[0]?.embedding;
    if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMS) {
      return null;
    }
    return { vector, model: EMBEDDING_MODEL };
  } catch (err) {
    const reason =
      (err as Error).name === "AbortError"
        ? "timeout (8s)"
        : (err as Error).message;
    console.error(`[embeddings] failed: ${reason}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Cosine similarity of two equal-length vectors. Returns 0 for mismatched
 * lengths (caller should treat as "no match") rather than throwing.
 */
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Keyword-scoring fallback for when we can't embed. Token-overlap with a
 * light IDF-style damp — short common words contribute less than rare ones.
 * Case-insensitive, punctuation-tolerant. Not as good as embeddings but
 * strictly better than random ordering.
 */
export function keywordScore(query: string, doc: string): number {
  const tokenize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3);
  const qTokens = new Set(tokenize(query));
  if (qTokens.size === 0) return 0;
  const dTokens = tokenize(doc);
  if (dTokens.length === 0) return 0;
  let hits = 0;
  for (const t of dTokens) {
    if (qTokens.has(t)) hits += 1;
  }
  // Normalise by query size so longer queries don't auto-win.
  return hits / qTokens.size;
}

export { EMBEDDING_MODEL, EMBEDDING_DIMS };
