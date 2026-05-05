import { describe, expect, it } from "vitest";
import { shouldCacheCompiledGraph } from "../graph/runtime";

describe("graph runtime caching", () => {
  it("rebuilds the graph outside production", () => {
    expect(shouldCacheCompiledGraph("development")).toBe(false);
    expect(shouldCacheCompiledGraph("test")).toBe(false);
  });

  it("caches the compiled graph in production", () => {
    expect(shouldCacheCompiledGraph("production")).toBe(true);
  });
});
