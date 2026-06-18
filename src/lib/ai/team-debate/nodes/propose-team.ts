import type { TeamDebateStateType, TeamDebateStateUpdate } from "../state";
import { runModel, parseDraftJson, renderDraft } from "../llm";
import { getRegulation } from "@/lib/data/champions";
import {
  describeMember,
  detectSpeedDirective,
  detectWeatherDirective,
  computeCoreWeaknesses,
} from "@/lib/team-analysis/team-context";

/**
 * Node: propose (or, on a loop, re-propose) a full 6-Pokemon team. On the
 * first pass it builds around the user's seed + brief; on later passes it must
 * FIX the critic's violations and address the personas' critiques.
 */
export async function proposeTeamNode(
  state: TeamDebateStateType,
): Promise<Partial<TeamDebateStateUpdate>> {
  const { format, seed, brief, draft, critique, violations } = state;
  const reg = getRegulation(format);
  const round = state.round + 1;
  const isRevision = round > 1;

  const seedList = seed.length
    ? seed.map((m) => `- ${describeMember(m, format)}`).join("\n")
    : "(none — you choose the whole team)";

  // Deterministic guidance from the seed (first pass) or the current draft.
  const basis = isRevision && draft.length ? draft : seed;
  const speed = detectSpeedDirective(basis, format);
  const weather = detectWeatherDirective(basis, format);
  const weaknesses = computeCoreWeaknesses(basis, format);

  const system = [
    `You are the lead team architect for Pokemon ${reg.label} (VGC doubles, bring 6 pick 4, level 50, Mega ON, NO Tera, IVs 31, ${reg.points.totalMax}-pt stats max ${reg.points.perStatMax}/stat).`,
    `Build ONE cohesive 6-Pokemon team with a clear win condition. Think synergy first: weather/terrain ↔ its abusers, the speed mode (Tailwind XOR Trick Room) ↔ the attackers built for it, redirection ↔ a fragile sweeper, Intimidate/Fake Out ↔ securing KOs, pivots ↔ bringing breakers in safely.`,
    `HARD RULES: only Pokemon from this roster (exact names): ${reg.pokemon.join(", ")}. No duplicate species. EXACTLY ONE mega stone on the team. No Terastallization. Never put Trick Room and Tailwind (or a Swift-Swim/weather-speed plan) on the same team. Never run a weather-locked payoff (Archaludon Electro Shot needs rain; Solar Beam needs sun) unless the team sets that weather.`,
    `Cover the core's shared defensive weaknesses — prefer ability immunities that also redirect (Lightning Rod ↔ Electric, Storm Drain ↔ Water, Flash Fire ↔ Fire, Levitate ↔ Ground).`,
    `Respond with ONLY a JSON array of exactly 6 objects (no prose, no fences):`,
    `[{"species":"<roster name>","role":"<short role>","item":"<item>","ability":"<ability>","moves":["m1","m2","m3","m4"],"note":"<1 sentence on why it's here / what it does for a named teammate>"}]`,
  ].join("\n");

  const user = [
    isRevision
      ? `REVISION round ${round}. Fix the problems below and return an improved full 6-Pokemon team.`
      : `Build a new 6-Pokemon team.`,
    ``,
    `MUST BUILD AROUND these locked-in members (keep them, complete the rest):`,
    seedList,
    brief ? `\nUSER BRIEF / win condition: ${brief}` : "",
    speed ? `\n${speed}` : "",
    weather ? `\n${weather}` : "",
    weaknesses
      ? `\nSHARED DEFENSIVE WEAKNESSES to cover:\n${weaknesses}`
      : "",
    isRevision && draft.length
      ? `\nCURRENT DRAFT (improve it, keep what works):\n${renderDraft(draft, format)}`
      : "",
    isRevision && violations.length
      ? `\nMUST-FIX violations from the judge:\n${violations.map((v) => `- [${v.severity}] ${v.message}`).join("\n")}`
      : "",
    isRevision && critique ? `\nJudge's required changes:\n${critique}` : "",
    `\nReturn the JSON array of 6.`,
  ]
    .filter(Boolean)
    .join("\n");

  const text = await runModel(system, user);
  const parsed = parseDraftJson(text, format);

  // Fall back to the previous draft (or seed) if the model returned garbage.
  const next =
    parsed ??
    (draft.length
      ? draft
      : seed.map((m) => ({
          species: m.species,
          item: m.item,
          ability: m.ability,
          moves: m.moves,
        })));

  return {
    draft: next,
    round,
    transcript: [
      {
        agent: "propose",
        label: isRevision ? `Architect (revision ${round})` : "Architect",
        round,
        text: parsed
          ? `Proposed a ${next.length}-Pokemon team:\n${renderDraft(next, format)}`
          : `Could not parse a clean proposal; kept the prior draft.`,
      },
    ],
  };
}
