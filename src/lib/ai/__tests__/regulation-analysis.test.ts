import { describe, it, expect } from "vitest";
import { getMbContentBreakdown } from "@/lib/data/regulation-diff";

describe("getMbContentBreakdown — M-B diff over M-A", () => {
  const b = getMbContentBreakdown("champions-reg-m-b");

  it("lists the new species, flagging un-banned ones", () => {
    const names = b.newSpecies.map((s) => s.species);
    expect(names).toContain("Eelektross");
    expect(names).toContain("Annihilape");
    for (const s of ["Metagross", "Gholdengo", "Grimmsnarl"]) {
      expect(names).toContain(s);
      expect(b.newSpecies.find((x) => x.species === s)?.unbanned).toBe(true);
    }
    // Eelektross was simply absent in M-A (not banned) → not flagged un-banned.
    expect(b.newSpecies.find((x) => x.species === "Eelektross")?.unbanned).toBe(
      false,
    );
    expect(b.counts.species).toBeGreaterThanOrEqual(20);
  });

  it("populates species types + abilities from the dex", () => {
    const eel = b.newSpecies.find((s) => s.species === "Eelektross");
    expect(eel?.types).toContain("Electric");
    expect(eel?.abilities).toContain("Levitate");
  });

  it("lists new megas with stone + signature ability + types", () => {
    const ee = b.newMegas.find((m) => m.mega === "Eelektross-Mega");
    expect(ee?.stone).toBe("Eelektrossite");
    expect(ee?.ability).toBe("Eelevate");
    expect(ee?.types).toContain("Electric");

    const meta = b.newMegas.find((m) => m.mega === "Metagross-Mega");
    expect(meta?.stone).toBe("Metagrossite");
    expect(b.counts.megas).toBeGreaterThanOrEqual(14);
  });

  it("classifies items: Life Orb un-banned, mega stones new", () => {
    expect(b.newItems.find((i) => i.item === "Life Orb")?.status).toBe(
      "unbanned",
    );
    const stone = b.newItems.find((i) => i.item === "Metagrossite");
    expect(stone?.status).toBe("new");
    expect(stone?.isStone).toBe(true);
  });

  it("enriches items with effects + mega targets", () => {
    const lifeOrb = b.newItems.find((i) => i.item === "Life Orb");
    expect(lifeOrb?.description).toBeTruthy();
    expect(b.newItems.find((i) => i.item === "Metagrossite")?.enables).toContain(
      "Mega Metagross",
    );
    expect(b.newItems.find((i) => i.item === "Raichunite X")?.enables).toContain(
      "Mega Raichu X",
    );
    // Stones carry a base species so the UI can show its sprite as the icon.
    expect(b.newItems.find((i) => i.item === "Metagrossite")?.iconSpecies).toBe(
      "Metagross",
    );
    expect(b.newItems.find((i) => i.item === "Life Orb")?.iconSpecies).toBeUndefined();
  });

  it("reports no new content when comparing M-A to itself", () => {
    const a = getMbContentBreakdown("champions-reg-m-a");
    expect(a.counts.species).toBe(0);
    expect(a.counts.megas).toBe(0);
    expect(a.counts.items).toBe(0);
  });
});
