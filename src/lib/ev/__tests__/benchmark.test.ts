import { describe, it, expect } from "vitest";
import { calculateBenchmarks, type MetaThreat } from "../benchmark";
import type { TeamPokemon, EVSpread } from "@/lib/types/pokemon";
import { DEFAULT_IVS, DEFAULT_EVS } from "@/lib/types/pokemon";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function makePokemon(overrides: Partial<TeamPokemon> = {}): TeamPokemon {
  return {
    species: "Metagross",
    ability: "Clear Body",
    item: "Clear Amulet",
    nature: "Adamant",
    level: 50,
    moves: ["Iron Head", "Stomping Tantrum", "Psychic Fangs", "Protect"],
    evs: { ...DEFAULT_EVS, hp: 252, atk: 252, spd: 4 },
    ivs: { ...DEFAULT_IVS },
    ...overrides,
  };
}

const garchomp: TeamPokemon = {
  species: "Garchomp",
  ability: "Rough Skin",
  item: "Life Orb",
  nature: "Jolly",
  level: 50,
  moves: ["Earthquake", "Dragon Claw", "Rock Slide", "Protect"],
  evs: { ...DEFAULT_EVS, atk: 252, spe: 252, hp: 4 },
  ivs: { ...DEFAULT_IVS },
};

const incineroar: TeamPokemon = {
  species: "Incineroar",
  ability: "Intimidate",
  item: "Safety Goggles",
  nature: "Careful",
  level: 50,
  moves: ["Flare Blitz", "Fake Out", "Knock Off", "Parting Shot"],
  evs: { ...DEFAULT_EVS, hp: 252, spd: 252, def: 4 },
  ivs: { ...DEFAULT_IVS },
};

const threats: MetaThreat[] = [
  {
    species: "Garchomp",
    commonSets: [garchomp],
    usagePercent: 45.0,
  },
  {
    species: "Incineroar",
    commonSets: [incineroar],
    usagePercent: 55.0,
  },
];

// ---------------------------------------------------------------------------
// Survival benchmarks
// ---------------------------------------------------------------------------
describe("calculateBenchmarks – survival", () => {
  it("generates survival benchmarks for each meta threat", () => {
    const report = calculateBenchmarks(makePokemon(), threats);

    expect(report.survivalBenchmarks.length).toBeGreaterThan(0);
    // Each benchmark should have required fields
    for (const b of report.survivalBenchmarks) {
      expect(b.benchmarkType).toBe("survival");
      expect(typeof b.description).toBe("string");
      expect(typeof b.met).toBe("boolean");
      expect(typeof b.threat).toBe("string");
      expect(typeof b.move).toBe("string");
    }
  });

  it("reports whether Metagross survives 252 Atk Garchomp Earthquake", () => {
    const report = calculateBenchmarks(makePokemon(), threats);

    const eqBenchmark = report.survivalBenchmarks.find(
      (b) => b.threat === "Garchomp" && b.move === "Earthquake",
    );
    expect(eqBenchmark).toBeDefined();
    // 252+ Atk Life Orb Garchomp EQ vs 252 HP Metagross should be survivable
    expect(eqBenchmark!.damageRange).toBeDefined();
    expect(eqBenchmark!.damageRange![0]).toBeGreaterThan(0);
    expect(eqBenchmark!.damageRange![1]).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// KO benchmarks
// ---------------------------------------------------------------------------
describe("calculateBenchmarks – KO", () => {
  it("generates KO benchmarks against meta threats", () => {
    const report = calculateBenchmarks(makePokemon(), threats);

    expect(report.koBenchmarks.length).toBeGreaterThan(0);
    for (const b of report.koBenchmarks) {
      expect(b.benchmarkType).toBe("ko");
      expect(typeof b.description).toBe("string");
      expect(typeof b.met).toBe("boolean");
    }
  });

  it("reports damage range for offensive calcs", () => {
    const report = calculateBenchmarks(makePokemon(), threats);

    for (const b of report.koBenchmarks) {
      expect(b.damageRange).toBeDefined();
      expect(b.damageRange![0]).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Speed benchmarks
// ---------------------------------------------------------------------------
describe("calculateBenchmarks – speed", () => {
  it("generates speed benchmarks against meta threats", () => {
    const report = calculateBenchmarks(makePokemon(), threats);

    expect(report.speedBenchmarks.length).toBeGreaterThan(0);
    for (const b of report.speedBenchmarks) {
      expect(b.benchmarkType).toBe("speed");
      expect(typeof b.description).toBe("string");
      expect(typeof b.met).toBe("boolean");
    }
  });

  it("Metagross does not outspeed Jolly Garchomp without speed investment", () => {
    // Adamant Metagross with 0 Spe vs Jolly 252 Spe Garchomp
    const report = calculateBenchmarks(
      makePokemon({ evs: { ...DEFAULT_EVS, hp: 252, atk: 252, spd: 4 } }),
      threats,
    );

    const speedVsGarchomp = report.speedBenchmarks.find(
      (b) => b.threat === "Garchomp",
    );
    expect(speedVsGarchomp).toBeDefined();
    // Metagross base 70 Spe vs Garchomp base 102 Spe (Jolly 252) → Metagross slower
    expect(speedVsGarchomp!.met).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Suggested spread
// ---------------------------------------------------------------------------
describe("calculateBenchmarks – suggested spread", () => {
  it("returns a suggested spread with valid EV totals", () => {
    const report = calculateBenchmarks(makePokemon(), threats);

    expect(report.suggestedSpread).toBeDefined();
    const total =
      report.suggestedSpread.hp +
      report.suggestedSpread.atk +
      report.suggestedSpread.def +
      report.suggestedSpread.spa +
      report.suggestedSpread.spd +
      report.suggestedSpread.spe;

    // Total should not exceed 510
    expect(total).toBeLessThanOrEqual(510);
    // Each stat should be 0-252
    for (const val of Object.values(report.suggestedSpread)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(252);
    }
  });

  it("returns a valid nature string", () => {
    const report = calculateBenchmarks(makePokemon(), threats);
    expect(typeof report.suggestedNature).toBe("string");
    expect(report.suggestedNature.length).toBeGreaterThan(0);
  });

  it("returns the pokemon species name", () => {
    const report = calculateBenchmarks(makePokemon(), threats);
    expect(report.pokemon).toBe("Metagross");
  });
});
