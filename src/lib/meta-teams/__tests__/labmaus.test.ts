import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  parseLabmausTopTeams,
  normalizeLabmausSpecies,
} from "../aggregator-labmaus";

// A trimmed copy of the real /api/top_teams nesting:
// [ { composition, teams: [ { core, teams: [ player, player ] } ] } ]
const SAMPLE = [
  {
    composition: 4,
    teams: [
      {
        pokemon_names: ["Archaludon", "Swampert", "Pelipper", "Grimmsnarl"],
        teams: [
          {
            name: "Force_India",
            placement: 1,
            pokemon_names: [
              "Archaludon",
              "Swampert",
              "Pelipper",
              "Metagross",
              "Grimmsnarl",
              "Sneasler",
            ],
            record: "9-2-0",
            team_url: "https://pokepast.es/bf711fe9c155284a",
            tournament_name: "MMHM x Stellar Novas Tour #2",
            tournament_id: 60181,
          },
          {
            name: "junorisingg",
            placement: 4,
            pokemon_names: ["Sinistcha", "Archaludon", "Swampert"], // <4 → skipped
            record: "5-2-0",
            team_url: "https://pokepast.es/a40618162b408585",
            tournament_name: "MMHM x Stellar Novas Tour #2",
          },
        ],
      },
    ],
  },
];

describe("normalizeLabmausSpecies", () => {
  it("hyphenates multi-word forms", () => {
    expect(normalizeLabmausSpecies("Urshifu Rapid Strike")).toBe("Urshifu-Rapid-Strike");
  });
  it("strips gender symbols", () => {
    expect(normalizeLabmausSpecies("Basculegion ♂")).toBe("Basculegion-M");
    expect(normalizeLabmausSpecies("Indeedee ♀")).toBe("Indeedee-F");
  });
  it("leaves plain names untouched", () => {
    expect(normalizeLabmausSpecies("Archaludon")).toBe("Archaludon");
  });
});

describe("parseLabmausTopTeams", () => {
  it("flattens the nested payload into individual player teams", () => {
    const teams = parseLabmausTopTeams(SAMPLE);
    expect(teams).toHaveLength(1); // the 3-mon entry is dropped (<4)
    const t = teams[0];
    expect(t.author).toBe("Force_India");
    expect(t.species).toEqual([
      "Archaludon",
      "Swampert",
      "Pelipper",
      "Metagross",
      "Grimmsnarl",
      "Sneasler",
    ]);
    expect(t.pokepasteUrl).toBe("https://pokepast.es/bf711fe9c155284a");
    expect(t.record).toBe("MMHM x Stellar Novas Tour #2 — 9-2-0 — #1");
  });

  it("returns [] for non-array / empty payloads", () => {
    expect(parseLabmausTopTeams(null)).toEqual([]);
    expect(parseLabmausTopTeams({})).toEqual([]);
    expect(parseLabmausTopTeams([])).toEqual([]);
  });
});
