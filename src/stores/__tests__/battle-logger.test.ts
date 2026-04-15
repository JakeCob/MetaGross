import { describe, it, expect, beforeEach } from "vitest";
import { createBattleLoggerStore } from "../battle-logger";
import type { TeamPokemon } from "@/lib/types/pokemon";
import { DEFAULT_EVS, DEFAULT_IVS } from "@/lib/types/pokemon";

const makePokemon = (species: string): TeamPokemon => ({
  species,
  ability: "Test Ability",
  item: "Test Item",
  nature: "Adamant",
  level: 50,
  moves: ["Move 1", "Move 2", "Move 3", "Move 4"],
  evs: { ...DEFAULT_EVS, hp: 252, atk: 252, spd: 4 },
  ivs: { ...DEFAULT_IVS },
});

const myTeam: TeamPokemon[] = [
  makePokemon("Metagross"),
  makePokemon("Incineroar"),
  makePokemon("Rillaboom"),
  makePokemon("Garchomp"),
  makePokemon("Sinistcha"),
  makePokemon("Sneasler"),
];

const opponentTeam = [
  { species: "Kyogre" },
  { species: "Tornadus" },
  { species: "Rillaboom" },
  { species: "Incineroar" },
  { species: "Iron Hands" },
  { species: "Amoonguss" },
];

describe("battle-logger store", () => {
  let store: ReturnType<typeof createBattleLoggerStore>;

  beforeEach(() => {
    store = createBattleLoggerStore();
  });

  it("starts in idle phase", () => {
    expect(store.getState().phase).toBe("idle");
    expect(store.getState().mode).toBeNull();
  });

  it("starts a battle in realtime mode", () => {
    store.getState().startBattle("realtime");
    expect(store.getState().phase).toBe("teamEntry");
    expect(store.getState().mode).toBe("realtime");
  });

  it("starts a battle in quick mode", () => {
    store.getState().startBattle("quick");
    expect(store.getState().phase).toBe("teamEntry");
    expect(store.getState().mode).toBe("quick");
  });

  it("sets my team", () => {
    store.getState().startBattle("realtime");
    store.getState().setMyTeam(myTeam);
    expect(store.getState().myTeam).toHaveLength(6);
    expect(store.getState().myTeam[0].species).toBe("Metagross");
  });

  it("sets opponent team", () => {
    store.getState().startBattle("realtime");
    store.getState().setOpponentTeam(opponentTeam);
    expect(store.getState().opponentTeam).toHaveLength(6);
    expect(store.getState().opponentTeam[0].species).toBe("Kyogre");
  });

  it("transitions to teamPreview after both teams set", () => {
    store.getState().startBattle("realtime");
    store.getState().setMyTeam(myTeam);
    store.getState().setOpponentTeam(opponentTeam);
    store.getState().proceedToTeamPreview();
    expect(store.getState().phase).toBe("teamPreview");
  });

  it("selects brought-4 (exactly 4)", () => {
    store.getState().startBattle("realtime");
    store.getState().setMyTeam(myTeam);
    store.getState().setOpponentTeam(opponentTeam);
    store.getState().proceedToTeamPreview();

    store.getState().setMyBrought(["Metagross", "Incineroar", "Garchomp", "Rillaboom"]);
    expect(store.getState().myBrought).toHaveLength(4);
  });

  it("rejects brought with wrong count", () => {
    store.getState().startBattle("realtime");
    store.getState().setMyTeam(myTeam);
    store.getState().setOpponentTeam(opponentTeam);
    store.getState().proceedToTeamPreview();

    store.getState().setMyBrought(["Metagross", "Incineroar", "Garchomp"]);
    // Should not update — still empty
    expect(store.getState().myBrought).toHaveLength(0);
  });

  it("selects leads (exactly 2 from brought-4)", () => {
    store.getState().startBattle("realtime");
    store.getState().setMyTeam(myTeam);
    store.getState().setOpponentTeam(opponentTeam);
    store.getState().proceedToTeamPreview();
    store.getState().setMyBrought(["Metagross", "Incineroar", "Garchomp", "Rillaboom"]);

    store.getState().setMyLeads(["Metagross", "Incineroar"]);
    expect(store.getState().myLeads).toEqual(["Metagross", "Incineroar"]);
  });

  it("rejects leads not in brought-4", () => {
    store.getState().startBattle("realtime");
    store.getState().setMyTeam(myTeam);
    store.getState().setOpponentTeam(opponentTeam);
    store.getState().proceedToTeamPreview();
    store.getState().setMyBrought(["Metagross", "Incineroar", "Garchomp", "Rillaboom"]);

    store.getState().setMyLeads(["Metagross", "Sinistcha"]);
    expect(store.getState().myLeads).toHaveLength(0);
  });

  it("transitions to inProgress after leads set", () => {
    store.getState().startBattle("realtime");
    store.getState().setMyTeam(myTeam);
    store.getState().setOpponentTeam(opponentTeam);
    store.getState().proceedToTeamPreview();
    store.getState().setMyBrought(["Metagross", "Incineroar", "Garchomp", "Rillaboom"]);
    store.getState().setMyLeads(["Metagross", "Incineroar"]);
    store.getState().setOpponentBrought(["Kyogre", "Tornadus", "Rillaboom", "Incineroar"]);
    store.getState().setOpponentLeads(["Kyogre", "Tornadus"]);
    store.getState().proceedToBattle();
    expect(store.getState().phase).toBe("inProgress");
  });

  it("accepts opponentBrought seeded with only 2 leads (unknown back)", () => {
    // Real-world flow: user doesn't know the opponent's brought-4, so
    // opponentBrought starts with just the 2 leads. proceedToBattle
    // should still succeed as long as opponentLeads is set.
    store.getState().startBattle("realtime");
    store.getState().setMyTeam(myTeam);
    store.getState().setOpponentTeam(opponentTeam);
    store.getState().proceedToTeamPreview();
    store.getState().setMyBrought(["Metagross", "Incineroar", "Garchomp", "Rillaboom"]);
    store.getState().setMyLeads(["Metagross", "Incineroar"]);
    store.getState().setOpponentLeads(["Kyogre", "Tornadus"]);
    store.getState().setOpponentBrought(["Kyogre", "Tornadus"]); // length 2
    store.getState().proceedToBattle();
    expect(store.getState().phase).toBe("inProgress");
    expect(store.getState().opponentBrought).toEqual(["Kyogre", "Tornadus"]);
  });

  it("rejects opponentBrought of length 1 (must have at least the 2 leads)", () => {
    store.getState().startBattle("realtime");
    store.getState().setMyTeam(myTeam);
    store.getState().setOpponentTeam(opponentTeam);
    store.getState().proceedToTeamPreview();
    store.getState().setOpponentBrought(["Kyogre"]);
    expect(store.getState().opponentBrought).toHaveLength(0);
  });

  it("accepts opponentBrought growing from 2 to 3 as back Pokemon revealed", () => {
    store.getState().startBattle("realtime");
    store.getState().setMyTeam(myTeam);
    store.getState().setOpponentTeam(opponentTeam);
    store.getState().proceedToTeamPreview();
    store.getState().setOpponentBrought(["Kyogre", "Tornadus"]);
    // A back Pokemon switches in during the match
    store.getState().setOpponentBrought(["Kyogre", "Tornadus", "Rillaboom"]);
    expect(store.getState().opponentBrought).toEqual([
      "Kyogre",
      "Tornadus",
      "Rillaboom",
    ]);
  });

  it("ends battle with result", () => {
    store.getState().startBattle("quick");
    store.getState().setMyTeam(myTeam);
    store.getState().setOpponentTeam(opponentTeam);
    store.getState().proceedToTeamPreview();
    store.getState().setMyBrought(["Metagross", "Incineroar", "Garchomp", "Rillaboom"]);
    store.getState().setMyLeads(["Metagross", "Incineroar"]);
    store.getState().setOpponentBrought(["Kyogre", "Tornadus", "Rillaboom", "Incineroar"]);
    store.getState().setOpponentLeads(["Kyogre", "Tornadus"]);

    store.getState().endBattle("win");
    expect(store.getState().phase).toBe("complete");
    expect(store.getState().result).toBe("win");
  });

  it("resets store to idle", () => {
    store.getState().startBattle("realtime");
    store.getState().setMyTeam(myTeam);
    store.getState().reset();
    expect(store.getState().phase).toBe("idle");
    expect(store.getState().myTeam).toHaveLength(0);
    expect(store.getState().mode).toBeNull();
  });

  it("sets opponent name and notes", () => {
    store.getState().startBattle("realtime");
    store.getState().setOpponentName("PlayerX");
    store.getState().setNotes("Close game, need to Tera earlier");
    expect(store.getState().opponentName).toBe("PlayerX");
    expect(store.getState().notes).toBe("Close game, need to Tera earlier");
  });

  it("generates match data for saving", () => {
    store.getState().startBattle("quick");
    store.getState().setMyTeam(myTeam);
    store.getState().setOpponentTeam(opponentTeam);
    store.getState().proceedToTeamPreview();
    store.getState().setMyBrought(["Metagross", "Incineroar", "Garchomp", "Rillaboom"]);
    store.getState().setMyLeads(["Metagross", "Incineroar"]);
    store.getState().setOpponentBrought(["Kyogre", "Tornadus", "Rillaboom", "Incineroar"]);
    store.getState().setOpponentLeads(["Kyogre", "Tornadus"]);
    store.getState().endBattle("win");

    const matchData = store.getState().getMatchData();
    expect(matchData).not.toBeNull();
    expect(matchData!.result).toBe("win");
    expect(matchData!.mode).toBe("quick");
    expect(matchData!.myTeam).toHaveLength(6);
    expect(matchData!.opponentTeam).toHaveLength(6);
    expect(matchData!.myBrought).toHaveLength(4);
    expect(matchData!.myLeads).toHaveLength(2);
  });
});
