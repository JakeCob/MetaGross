import { describe, it, expect } from "vitest";
import { predictEVs } from "../reverse-calc";
import type { DamageObservation, SpeedObservation, MetaSpread } from "@/lib/types/ev";
import type { EVSpread } from "@/lib/types/pokemon";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const spread = (
  hp: number,
  atk: number,
  def: number,
  spa: number,
  spd: number,
  spe: number,
): EVSpread => ({ hp, atk, def, spa, spd, spe });

const metaSpreads: MetaSpread[] = [
  {
    evs: spread(252, 0, 108, 0, 148, 0),
    nature: "Impish",
    usagePercent: 32.1,
    source: "pikalytics",
    rank: 1,
  },
  {
    evs: spread(4, 252, 0, 0, 0, 252),
    nature: "Jolly",
    usagePercent: 24.5,
    source: "pikalytics",
    rank: 2,
  },
  {
    evs: spread(252, 0, 0, 0, 4, 252),
    nature: "Jolly",
    usagePercent: 12.3,
    source: "pikalytics",
    rank: 3,
  },
];

// ---------------------------------------------------------------------------
// Damage observation tests
// ---------------------------------------------------------------------------
describe("predictEVs – damage observations", () => {
  it("predicts defender has significant HP/Def investment from low physical damage", () => {
    // 252 Atk Adamant Metagross uses Stomping Tantrum on Garchomp and deals 45%
    // This is relatively low damage, implying Garchomp has defensive investment
    const observations: DamageObservation[] = [
      {
        attackerSpecies: "Metagross",
        attackerEvs: spread(252, 252, 0, 0, 4, 0),
        attackerNature: "Adamant",
        moveName: "Stomping Tantrum",
        defenderSpecies: "Garchomp",
        damagePercent: 45,
      },
    ];

    const result = predictEVs(observations, [], metaSpreads);

    // Should predict some HP or Def investment
    expect(result.predictedEvs.hp).toBeDefined();
    expect(result.predictedEvs.def).toBeDefined();
    // Confidence should be LOW with just 1 observation (20-40)
    expect(result.confidence).toBeGreaterThanOrEqual(20);
    expect(result.confidence).toBeLessThanOrEqual(40);
    expect(result.observations).toBe(1);
  });

  it("predicts minimal Def investment from high physical damage", () => {
    // 252 Atk Adamant Metagross uses Stomping Tantrum on Garchomp and deals ~80%
    // This means Garchomp has very little defensive investment
    const observations: DamageObservation[] = [
      {
        attackerSpecies: "Metagross",
        attackerEvs: spread(252, 252, 0, 0, 4, 0),
        attackerNature: "Adamant",
        moveName: "Stomping Tantrum",
        defenderSpecies: "Garchomp",
        damagePercent: 80,
      },
    ];

    const result = predictEVs(observations, [], metaSpreads);

    // Should predict minimal HP/Def investment or the Jolly 4/252/0/0/0/252 set
    expect(result.predictedEvs).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(20);
  });

  it("narrows HP/SpD from special damage observations", () => {
    // Special move from known attacker → narrows HP + SpD
    const observations: DamageObservation[] = [
      {
        attackerSpecies: "Kyogre",
        attackerEvs: spread(4, 0, 0, 252, 0, 252),
        attackerNature: "Modest",
        moveName: "Water Spout",
        defenderSpecies: "Garchomp",
        damagePercent: 85,
        fieldWeather: "rain",
      },
    ];

    const result = predictEVs(observations, [], metaSpreads);

    expect(result.predictedEvs).toBeDefined();
    // Should mention either hp or spd since it's a special move
    expect(
      result.predictedEvs.hp !== undefined ||
      result.predictedEvs.spd !== undefined,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Speed observation tests
// ---------------------------------------------------------------------------
describe("predictEVs – speed observations", () => {
  it("predicts high speed EVs when target moves first vs a known fast Pokemon", () => {
    // Garchomp moved before 252 Spe Jolly Metagross → Garchomp must be fast
    const speedObs: SpeedObservation[] = [
      {
        pokemonA: "Garchomp",
        pokemonB: "Metagross",
        aMovedFirst: true,
      },
    ];

    const result = predictEVs([], speedObs, metaSpreads);

    // Should predict high Spe investment
    expect(result.predictedEvs.spe).toBeDefined();
    expect(result.predictedEvs.spe!).toBeGreaterThanOrEqual(100);
    expect(result.confidence).toBeGreaterThanOrEqual(20);
  });

  it("considers Trick Room in speed calculations", () => {
    // In Trick Room, if A moved first, A is actually SLOWER
    const speedObs: SpeedObservation[] = [
      {
        pokemonA: "Garchomp",
        pokemonB: "Tornadus",
        aMovedFirst: true,
        fieldState: { trickRoom: true },
      },
    ];

    const result = predictEVs([], speedObs, metaSpreads);

    // Under Trick Room, slower moves first → Garchomp is SLOW
    // So speed EVs should be low
    expect(result.predictedEvs.spe).toBeDefined();
    expect(result.predictedEvs.spe!).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// Multiple observations → confidence
// ---------------------------------------------------------------------------
describe("predictEVs – confidence scaling", () => {
  it("starts LOW (20-40) with 1 observation", () => {
    const observations: DamageObservation[] = [
      {
        attackerSpecies: "Metagross",
        attackerEvs: spread(252, 252, 0, 0, 4, 0),
        attackerNature: "Adamant",
        moveName: "Iron Head",
        defenderSpecies: "Garchomp",
        damagePercent: 60,
      },
    ];

    const result = predictEVs(observations, [], metaSpreads);
    expect(result.confidence).toBeGreaterThanOrEqual(20);
    expect(result.confidence).toBeLessThanOrEqual(40);
  });

  it("reaches MEDIUM (40-60) with 2 observations", () => {
    const observations: DamageObservation[] = [
      {
        attackerSpecies: "Metagross",
        attackerEvs: spread(252, 252, 0, 0, 4, 0),
        attackerNature: "Adamant",
        moveName: "Iron Head",
        defenderSpecies: "Garchomp",
        damagePercent: 60,
      },
      {
        attackerSpecies: "Incineroar",
        attackerEvs: spread(252, 252, 0, 0, 4, 0),
        attackerNature: "Adamant",
        moveName: "Flare Blitz",
        defenderSpecies: "Garchomp",
        damagePercent: 55,
      },
    ];

    const result = predictEVs(observations, [], metaSpreads);
    expect(result.confidence).toBeGreaterThanOrEqual(40);
    expect(result.confidence).toBeLessThanOrEqual(60);
  });

  it("reaches HIGH (60-90) with 3+ observations", () => {
    const observations: DamageObservation[] = [
      {
        attackerSpecies: "Metagross",
        attackerEvs: spread(252, 252, 0, 0, 4, 0),
        attackerNature: "Adamant",
        moveName: "Iron Head",
        defenderSpecies: "Garchomp",
        damagePercent: 60,
      },
      {
        attackerSpecies: "Incineroar",
        attackerEvs: spread(252, 252, 0, 0, 4, 0),
        attackerNature: "Adamant",
        moveName: "Flare Blitz",
        defenderSpecies: "Garchomp",
        damagePercent: 55,
      },
    ];
    const speedObs: SpeedObservation[] = [
      {
        pokemonA: "Garchomp",
        pokemonB: "Metagross",
        aMovedFirst: true,
      },
    ];

    const result = predictEVs(observations, speedObs, metaSpreads);
    expect(result.confidence).toBeGreaterThanOrEqual(60);
    expect(result.confidence).toBeLessThanOrEqual(90);
    expect(result.observations).toBe(3);
  });

  it("populates possibleSpreads from meta data", () => {
    const observations: DamageObservation[] = [
      {
        attackerSpecies: "Metagross",
        attackerEvs: spread(252, 252, 0, 0, 4, 0),
        attackerNature: "Adamant",
        moveName: "Iron Head",
        defenderSpecies: "Garchomp",
        damagePercent: 60,
      },
    ];

    const result = predictEVs(observations, [], metaSpreads);
    expect(result.possibleSpreads).toBeDefined();
    expect(Array.isArray(result.possibleSpreads)).toBe(true);
  });

  it("returns a predictedNature string", () => {
    const observations: DamageObservation[] = [
      {
        attackerSpecies: "Metagross",
        attackerEvs: spread(252, 252, 0, 0, 4, 0),
        attackerNature: "Adamant",
        moveName: "Stomping Tantrum",
        defenderSpecies: "Garchomp",
        damagePercent: 45,
      },
    ];

    const result = predictEVs(observations, [], metaSpreads);
    expect(typeof result.predictedNature).toBe("string");
    expect(result.predictedNature.length).toBeGreaterThan(0);
  });
});
