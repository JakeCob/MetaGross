/**
 * Team-building "mode" — ladder vs tournament — which materially changes the
 * right team.
 *
 * - LADDER (closed team sheet): the opponent doesn't see your team until preview,
 *   so SURPRISE has real value (e.g. a Choice Scarf + Final Gambit on a Pokémon
 *   usually run as a Mega sweeper).
 * - TOURNAMENT (open team sheet): the opponent sees everything — no surprise — so
 *   it's better to run PROVEN, refined tournament structures and expect counterplay.
 */
export type DebateMode = "tournament" | "ladder";

export const DEFAULT_MODE: DebateMode = "ladder";

export function normalizeMode(m: unknown): DebateMode {
  return m === "tournament" ? "tournament" : "ladder";
}

export function isTournament(mode: DebateMode | undefined): boolean {
  return mode === "tournament";
}

/** The prompt directive injected into the team-building agents for a mode. */
export function modeDirective(mode: DebateMode): string {
  if (mode === "tournament") {
    return [
      `TOURNAMENT MODE — OPEN TEAM SHEET: the opponent SEES your full team at preview, so there is NO surprise factor.`,
      `- Prefer PROVEN tournament-winning structures and the exact refined sets top players run; reference recent Limitless / regional top-cut teams and ADAPT a winning core rather than inventing one.`,
      `- Assume opponents bring tournament-tested cores and will play around your obvious threats and your one Mega — so the team must be sound under full information, not reliant on the opponent misreading a set.`,
      `- AVOID gimmick / "surprise" tech that only works when hidden (e.g. an unexpected Choice item or Final Gambit) — on an open sheet it just looks bad and gets played around.`,
    ].join("\n");
  }
  return [
    `LADDER MODE — CLOSED TEAM SHEET: the opponent does NOT see your team until preview, so SURPRISE has real value.`,
    `- You MAY include ONE unexpected tech/set that exploits a common assumption (e.g. a Choice Scarf + Final Gambit on a Pokémon usually run as a Mega sweeper — opponents won't expect it).`,
    `- Don't over-optimise for open-sheet counterplay; weight coverage depth + a hidden edge over pure tournament popularity. Proven cores are still fine — just allow creativity.`,
  ].join("\n");
}
