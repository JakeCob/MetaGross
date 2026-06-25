import { describe, it, expect } from "vitest";
import {
  classifyArchetypeFromSnapshot,
  membersFromSnapshot,
  isKnownArchetype,
} from "../team-context";
import { calculateArchetypeMatchups } from "@/lib/utils/stats";

const FORMAT = "Champions Reg M-B";

describe("isKnownArchetype (guards legacy/garbage tags)", () => {
  it("accepts recognized archetypes", () => {
    for (const a of ["Rain", "Sun", "Sand", "Snow", "Trick Room", "Tailwind", "Balance"]) {
      expect(isKnownArchetype(a)).toBe(true);
    }
  });

  it("rejects null, Unknown, and legacy timestamp strings", () => {
    expect(isKnownArchetype(null)).toBe(false);
    expect(isKnownArchetype(undefined)).toBe(false);
    expect(isKnownArchetype("Unknown")).toBe(false);
    expect(isKnownArchetype("1776356711988")).toBe(false); // legacy positional-insert timestamp
    expect(isKnownArchetype(1776356711988)).toBe(false);
  });
});

describe("membersFromSnapshot", () => {
  it("maps a stored snapshot to AITeamMembers, dropping junk", () => {
    const members = membersFromSnapshot([
      { species: "Pelipper", ability: "Drizzle", item: "Damp Rock", moves: ["Hurricane"] },
      { species: "" },
      null,
      { nope: true },
    ]);
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ species: "Pelipper", ability: "Drizzle" });
  });

  it("returns [] for non-array input", () => {
    expect(membersFromSnapshot(undefined)).toEqual([]);
    expect(membersFromSnapshot("Pelipper")).toEqual([]);
  });
});

describe("classifyArchetypeFromSnapshot", () => {
  it("classifies from a full snapshot via abilities (Drizzle → Rain)", () => {
    const arche = classifyArchetypeFromSnapshot(
      [{ species: "Pelipper", ability: "Drizzle", moves: ["Hurricane"] }],
      null,
      FORMAT,
    );
    expect(arche).toBe("Rain");
  });

  it("falls back to bare brought species when no snapshot (Politoed → Rain)", () => {
    const arche = classifyArchetypeFromSnapshot(null, ["Politoed", "Basculegion"], FORMAT);
    expect(arche).toBe("Rain");
  });

  it("prefers the full snapshot over the fallback list", () => {
    const arche = classifyArchetypeFromSnapshot(
      [{ species: "Torkoal", ability: "Drought", moves: ["Eruption"] }],
      ["Politoed"],
      FORMAT,
    );
    expect(arche).toBe("Sun");
  });

  it("returns Unknown when nothing is classifiable", () => {
    expect(classifyArchetypeFromSnapshot(null, null, FORMAT)).toBe("Unknown");
    expect(classifyArchetypeFromSnapshot([], [], FORMAT)).toBe("Unknown");
  });
});

describe("calculateArchetypeMatchups (opponent win-rates)", () => {
  it("buckets your win/loss by opponent archetype and skips untagged rows", () => {
    const out = calculateArchetypeMatchups([
      { archetypeOpponent: "Trick Room", result: "loss" },
      { archetypeOpponent: "Trick Room", result: "loss" },
      { archetypeOpponent: "Trick Room", result: "win" },
      { archetypeOpponent: "Rain", result: "win" },
      { result: "win" }, // untagged → ignored
    ]);
    const tr = out.find((m) => m.archetype === "Trick Room");
    const rain = out.find((m) => m.archetype === "Rain");
    expect(tr).toMatchObject({ wins: 1, losses: 2 });
    expect(tr?.winRate).toBeCloseTo(33.33, 1);
    expect(rain).toMatchObject({ wins: 1, losses: 0, winRate: 100 });
  });
});
