import { describe, it, expect } from "vitest";
import { calcStat } from "../stats";

describe("calcStat", () => {
  // Metagross base stats: HP 80, Atk 135, Def 130, SpA 95, SpD 90, Spe 70

  it("calculates HP correctly (Metagross, 31 IV, 252 EV, Lv50, Adamant)", () => {
    // HP = floor((2*80 + 31 + floor(252/4)) * 50/100) + 50 + 10
    // HP = floor((160 + 31 + 63) * 50/100) + 60
    // HP = floor(254 * 50/100) + 60
    // HP = floor(127) + 60 = 187
    const result = calcStat("hp", 80, 31, 252, 50, "Adamant");
    expect(result).toBe(187);
  });

  it("calculates Atk with +10% nature (Adamant)", () => {
    // Atk = floor((floor((2*135 + 31 + 63) * 50/100) + 5) * 1.1)
    // Atk = floor((floor(364 * 50/100) + 5) * 1.1)
    // Atk = floor((floor(182) + 5) * 1.1)
    // Atk = floor(187 * 1.1)
    // Atk = floor(205.7) = 205
    const result = calcStat("atk", 135, 31, 252, 50, "Adamant");
    expect(result).toBe(205);
  });

  it("calculates Atk with -10% nature (Modest)", () => {
    // Atk = floor((floor((2*135 + 31 + 63) * 50/100) + 5) * 0.9)
    // Atk = floor((182 + 5) * 0.9)
    // Atk = floor(187 * 0.9)
    // Atk = floor(168.3) = 168
    const result = calcStat("atk", 135, 31, 252, 50, "Modest");
    expect(result).toBe(168);
  });

  it("calculates Spe with +10% nature (Jolly)", () => {
    // Spe = floor((floor((2*70 + 31 + 63) * 50/100) + 5) * 1.1)
    // Spe = floor((floor(234 * 50/100) + 5) * 1.1)
    // Spe = floor((117 + 5) * 1.1)
    // Spe = floor(122 * 1.1)
    // Spe = floor(134.2) = 134
    const result = calcStat("spe", 70, 31, 252, 50, "Jolly");
    expect(result).toBe(134);
  });

  it("calculates SpA with neutral nature and no EVs", () => {
    // SpA = floor((floor((2*95 + 31 + 0) * 50/100) + 5) * 1.0)
    // SpA = floor((floor(221 * 50/100) + 5) * 1.0)
    // SpA = floor((110 + 5) * 1.0)
    // SpA = 115
    const result = calcStat("spa", 95, 31, 0, 50, "Hardy");
    expect(result).toBe(115);
  });

  it("calculates HP at level 100", () => {
    // HP = floor((2*80 + 31 + 63) * 100/100) + 100 + 10
    // HP = floor(254) + 110 = 364
    const result = calcStat("hp", 80, 31, 252, 100, "Adamant");
    expect(result).toBe(364);
  });

  it("calculates a stat with 0 IVs and 0 EVs", () => {
    // Atk = floor((floor((2*135 + 0 + 0) * 50/100) + 5) * 1.0)
    // Atk = floor((floor(270 * 50/100) + 5) * 1.0)
    // Atk = floor((135 + 5)) = 140
    const result = calcStat("atk", 135, 0, 0, 50, "Hardy");
    expect(result).toBe(140);
  });
});
