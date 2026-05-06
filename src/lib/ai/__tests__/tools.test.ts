import { describe, it, expect, vi, beforeEach } from "vitest";

// `server-only` throws in a jsdom environment. New tools (tournament,
// meta-teams) transitively pull in server-only modules; stub it out so
// the tool barrel import doesn't explode.
vi.mock("server-only", () => ({}));

// Mock the DB modules before importing tools
vi.mock("@/lib/db/queries/matches", () => ({
  getMatchById: vi.fn(),
}));

vi.mock("@/lib/db/queries/teams", () => ({
  getTeamById: vi.fn(),
}));

vi.mock("@/lib/db/queries/agent-memories", () => ({
  getMemoriesByScope: vi.fn(() => []),
}));

// Limitless / Pikalytics are server-only; their full implementations
// aren't exercised by these tool-shape tests.
vi.mock("@/lib/pokemon/limitless", () => ({
  getChampionsTournaments: vi.fn(async () => []),
  getTournamentStandings: vi.fn(async () => []),
  getTournamentUsage: vi.fn(async () => []),
  getTournamentPokemonDetail: vi.fn(async () => null),
}));

// Mock external data sources that some tools may use
vi.mock("@/lib/engine/damage-calc", () => ({
  calculateDamage: vi.fn(() => ({
    minPercent: 45,
    maxPercent: 53,
    minDamage: 150,
    maxDamage: 176,
    isOhko: false,
    isTwoHko: true,
  })),
}));

vi.mock("@/lib/engine/speed-calc", () => ({
  compareSpeed: vi.fn(() => ({
    pokemon1Speed: 150,
    pokemon2Speed: 120,
    pokemon1GoesFirst: true,
    pokemon1SpeedStat: 150,
    pokemon2SpeedStat: 120,
  })),
}));

import { getMatchById } from "@/lib/db/queries/matches";
import { getTeamById } from "@/lib/db/queries/teams";

describe("read tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("get_match_context", () => {
    it("returns match data when found", async () => {
      const { getMatchContextTool } = await import("../tools/read/get-match-context");

      const mockMatch = {
        id: "match-1",
        format: "gen9vgc2024regh",
        mode: "bo1",
        result: "win",
        playedAt: 1700000000000,
        opponentName: "TestPlayer",
        notes: "Good game",
        myTeam: [],
        opponentTeam: [],
        myBrought: [],
        opponentBrought: [],
        myLeads: [],
        opponentLeads: [],
        archetypeSelf: "hyper offense",
        archetypeOpponent: "balance",
        ruleAnalysisJson: null,
        aiAnalysisJson: null,
        turns: [{ id: "t1", actions: [] }],
      };

      vi.mocked(getMatchById).mockReturnValue(mockMatch as never);

      const result = await getMatchContextTool.invoke({ matchId: "match-1" });
      const parsed = JSON.parse(result);

      expect(parsed.id).toBe("match-1");
      expect(parsed.format).toBe("gen9vgc2024regh");
      expect(parsed.result).toBe("win");
      expect(parsed.opponentName).toBe("TestPlayer");
      expect(parsed.turnCount).toBe(1);
    });

    it("returns error when match not found", async () => {
      const { getMatchContextTool } = await import("../tools/read/get-match-context");

      vi.mocked(getMatchById).mockResolvedValue(null);

      const result = await getMatchContextTool.invoke({ matchId: "nonexistent" });
      const parsed = JSON.parse(result);

      expect(parsed.error).toContain("nonexistent");
    });
  });

  describe("get_team", () => {
    it("returns team data when found", async () => {
      const { getTeamTool } = await import("../tools/read/get-team");

      const mockTeam = {
        id: "team-1",
        userId: "user-1",
        name: "Rain Team",
        format: "gen9vgc2024regh",
        notes: "Rain abuser",
        isActive: 1,
        pokepaste: null,
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        pokemon: [
          {
            id: "p1",
            teamId: "team-1",
            slot: 1,
            species: "Pelipper",
            ability: "Drizzle",
            item: "Damp Rock",
            nature: "Bold",
            level: 50,
            moves: ["Tailwind", "Weather Ball", "Hurricane", "Protect"],
            evs: { hp: 252, atk: 0, def: 252, spa: 0, spd: 4, spe: 0 },
            ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 },
            teraType: "Water",
            megaEvolution: null,
            createdAt: 1700000000000,
          },
        ],
      };

      vi.mocked(getTeamById).mockReturnValue(mockTeam as never);

      const result = await getTeamTool.invoke({ teamId: "team-1" });
      const parsed = JSON.parse(result);

      expect(parsed.id).toBe("team-1");
      expect(parsed.name).toBe("Rain Team");
      expect(parsed.pokemon).toHaveLength(1);
      expect(parsed.pokemon[0].species).toBe("Pelipper");
    });

    it("returns error when team not found", async () => {
      const { getTeamTool } = await import("../tools/read/get-team");

      vi.mocked(getTeamById).mockResolvedValue(null);

      const result = await getTeamTool.invoke({ teamId: "nonexistent" });
      const parsed = JSON.parse(result);

      expect(parsed.error).toContain("nonexistent");
    });
  });
});

describe("write tools", () => {
  describe("propose_match_note", () => {
    it("returns a valid WriteActionProposal", async () => {
      const { proposeMatchNoteTool } = await import("../tools/write/propose-match-note");

      const result = await proposeMatchNoteTool.invoke({
        matchId: "match-1",
        notes: "Key turning point on turn 4",
        reason: "The Fake Out prediction won the game",
      });
      const parsed = JSON.parse(result);

      expect(parsed.actionType).toBe("update_match_notes");
      expect(parsed.description).toBe("The Fake Out prediction won the game");
      expect(parsed.payload.matchId).toBe("match-1");
      expect(parsed.payload.notes).toBe("Key turning point on turn 4");
    });
  });

  describe("propose_team_note", () => {
    it("returns a valid WriteActionProposal", async () => {
      const { proposeTeamNoteTool } = await import("../tools/write/propose-team-note");

      const result = await proposeTeamNoteTool.invoke({
        teamId: "team-1",
        notes: "Weak to Trick Room",
        reason: "Team lacks Trick Room answers",
      });
      const parsed = JSON.parse(result);

      expect(parsed.actionType).toBe("update_team_notes");
      expect(parsed.description).toBe("Team lacks Trick Room answers");
      expect(parsed.payload.teamId).toBe("team-1");
      expect(parsed.payload.notes).toBe("Weak to Trick Room");
    });
  });

  describe("propose_pokemon_patch", () => {
    it("supports species replacement patches", async () => {
      const { proposePokemonPatchTool } = await import(
        "../tools/write/propose-pokemon-patch"
      );

      const result = await proposePokemonPatchTool.invoke({
        teamId: "team-1",
        species: "Incineroar",
        patch: { species: "Farigiraf" },
        reason: "Replace Incineroar with Farigiraf while keeping the rest of the team intact.",
      });
      const parsed = JSON.parse(result);

      expect(parsed.actionType).toBe("patch_team_pokemon");
      expect(parsed.payload.teamId).toBe("team-1");
      expect(parsed.payload.species).toBe("Incineroar");
      expect(parsed.payload.patch.species).toBe("Farigiraf");
    });
  });
});

describe("tool arrays", () => {
  it("exports readTools, writeTools, and allTools", async () => {
    const { readTools, writeTools, allTools } = await import("../tools");

    expect(readTools.length).toBeGreaterThan(0);
    expect(writeTools.length).toBeGreaterThan(0);
    expect(allTools.length).toBe(readTools.length + writeTools.length);
  });

  it("all tools have names and descriptions", async () => {
    const { allTools } = await import("../tools");

    for (const tool of allTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
    }
  });

  it("write tools return proposals with correct shape", async () => {
    const { writeTools } = await import("../tools");
    const writeToolNames = writeTools.map((t) => t.name);

    expect(writeToolNames).toContain("propose_match_note");
    expect(writeToolNames).toContain("propose_team_note");
    expect(writeToolNames).toContain("propose_team_variant");
    expect(writeToolNames).toContain("propose_pokemon_patch");
  });
});
