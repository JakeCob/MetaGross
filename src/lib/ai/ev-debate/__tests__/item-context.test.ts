import { describe, it, expect } from "vitest";
import { evItemGuidance, lockedItem } from "../item-context";

describe("evItemGuidance", () => {
  it("locks a chosen item and forbids changing it", () => {
    const g = evItemGuidance("White Herb", "Points");
    expect(g).toContain('LOCKED to "White Herb"');
    expect(g).toMatch(/do NOT change it/i);
    expect(g).toContain("Points"); // uses the format's label
  });

  it("falls back to pick-one mode when no item is set", () => {
    const g = evItemGuidance("", "EVs");
    expect(g).not.toContain("LOCKED");
    expect(g).toMatch(/pick the item/i);
    expect(g).toContain("EVs");
  });

  it("treats a whitespace-only item as unset", () => {
    expect(evItemGuidance("   ", "Points")).not.toContain("LOCKED");
  });

  it("always includes the White Herb -> max Attack guidance", () => {
    expect(evItemGuidance("", "Points")).toMatch(/White Herb[\s\S]*max Attack/i);
  });
});

describe("lockedItem", () => {
  it("returns the trimmed item when set", () => {
    expect(lockedItem("  Sitrus Berry ")).toBe("Sitrus Berry");
  });

  it("returns undefined when empty/blank/undefined", () => {
    expect(lockedItem("")).toBeUndefined();
    expect(lockedItem("   ")).toBeUndefined();
    expect(lockedItem(undefined)).toBeUndefined();
  });
});
