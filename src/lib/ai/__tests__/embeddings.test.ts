import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { cosine, keywordScore } from "../embeddings";

describe("cosine similarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosine([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosine([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it("returns 0 for zero-length vectors (avoids NaN)", () => {
    expect(cosine([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it("returns 0 for length mismatch instead of throwing", () => {
    expect(cosine([1, 0], [1, 0, 0])).toBe(0);
  });
});

describe("keywordScore fallback", () => {
  it("boosts docs with shared rare tokens", () => {
    const query = "build me a rain team with Archaludon";
    const hit = "User prefers rain shells anchored by Archaludon";
    const miss = "User likes offensive Trick Room teams";
    expect(keywordScore(query, hit)).toBeGreaterThan(
      keywordScore(query, miss),
    );
  });

  it("returns 0 when no overlap exists", () => {
    expect(keywordScore("sand team", "trick room setter")).toBe(0);
  });

  it("is case insensitive", () => {
    const a = keywordScore("Rain", "the user likes rain");
    const b = keywordScore("RAIN", "the USER likes rain");
    expect(a).toBeGreaterThan(0);
    expect(a).toBeCloseTo(b);
  });

  it("ignores tokens shorter than 3 chars (so 'a', 'is', etc. don't inflate)", () => {
    // query is a single noise token → no signal
    expect(keywordScore("a", "a lot of text here")).toBe(0);
  });
});
