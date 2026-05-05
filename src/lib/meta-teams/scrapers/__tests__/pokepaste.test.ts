import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parsePokepaste } from "../pokepaste";

describe("parsePokepaste — EV / IV extraction", () => {
  it("captures EVs, IVs, and Level lines from a standard paste", () => {
    const raw = `Pelipper @ Damp Rock
Ability: Drizzle
Level: 50
Tera Type: Water
EVs: 252 HP / 4 Def / 252 SpA
Modest Nature
IVs: 0 Atk
- Weather Ball
- Hurricane
- Tailwind
- Protect`;
    const out = parsePokepaste(raw);
    expect(out.pokemon).toHaveLength(1);
    const mon = out.pokemon[0];
    expect(mon.species).toBe("Pelipper");
    expect(mon.item).toBe("Damp Rock");
    expect(mon.ability).toBe("Drizzle");
    expect(mon.nature).toBe("Modest");
    expect(mon.teraType).toBe("Water");
    expect(mon.evs).toBe("252 HP / 4 Def / 252 SpA");
    expect(mon.ivs).toBe("0 Atk");
    expect(mon.level).toBe(50);
    expect(mon.moves).toEqual([
      "Weather Ball",
      "Hurricane",
      "Tailwind",
      "Protect",
    ]);
  });

  it("leaves evs/ivs undefined when absent (so callers can fall back)", () => {
    const raw = `Sneasler @ White Herb
Ability: Unburden
- Close Combat
- Dire Claw
- Acrobatics
- Protect`;
    const out = parsePokepaste(raw);
    expect(out.pokemon[0].evs).toBeUndefined();
    expect(out.pokemon[0].ivs).toBeUndefined();
    expect(out.pokemon[0].level).toBeUndefined();
  });

  it("parses multiple Pokemon and preserves per-mon EV strings", () => {
    const raw = `Talonflame @ Focus Sash
Ability: Gale Wings
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Brave Bird
- Tailwind
- Protect
- Taunt

Garchomp @ Life Orb
Ability: Rough Skin
EVs: 4 HP / 252 Atk / 252 Spe
Jolly Nature
- Earthquake
- Dragon Claw
- Rock Slide
- Protect`;
    const out = parsePokepaste(raw);
    expect(out.pokemon).toHaveLength(2);
    expect(out.pokemon[0].evs).toBe("252 Atk / 4 SpD / 252 Spe");
    expect(out.pokemon[1].evs).toBe("4 HP / 252 Atk / 252 Spe");
  });
});
