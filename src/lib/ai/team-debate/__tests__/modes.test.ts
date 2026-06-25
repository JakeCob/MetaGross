import { describe, it, expect } from "vitest";
import { normalizeMode, isTournament, modeDirective } from "../modes";

describe("debate modes", () => {
  it("normalizeMode defaults to ladder and only accepts tournament", () => {
    expect(normalizeMode("tournament")).toBe("tournament");
    expect(normalizeMode("ladder")).toBe("ladder");
    expect(normalizeMode("nonsense")).toBe("ladder");
    expect(normalizeMode(undefined)).toBe("ladder");
    expect(normalizeMode(null)).toBe("ladder");
  });

  it("isTournament", () => {
    expect(isTournament("tournament")).toBe(true);
    expect(isTournament("ladder")).toBe(false);
    expect(isTournament(undefined)).toBe(false);
  });

  it("tournament directive forbids surprise tech and references proven teams", () => {
    const d = modeDirective("tournament").toLowerCase();
    expect(d).toContain("open team sheet");
    expect(d).toContain("proven");
    expect(d).toMatch(/avoid|no surprise/);
  });

  it("ladder directive allows a surprise tech", () => {
    const d = modeDirective("ladder").toLowerCase();
    expect(d).toContain("closed team sheet");
    expect(d).toContain("surprise");
  });
});
