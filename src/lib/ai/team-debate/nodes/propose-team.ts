import type { TeamDebateStateType, TeamDebateStateUpdate } from "../state";
import { runModel, parseDraftJson, renderDraft } from "../llm";
import { getRegulation } from "@/lib/data/champions";
import {
  describeMember,
  detectSpeedDirective,
  detectWeatherDirective,
  computeCoreWeaknesses,
  formatSpeedProfile,
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
  const speeds = formatSpeedProfile(basis, format);

  const system = [
    `You are the lead team architect for Pokemon ${reg.label} (VGC doubles, bring 6 pick 4, level 50, Mega ON, NO Tera, IVs 31, ${reg.points.totalMax}-pt stats max ${reg.points.perStatMax}/stat).`,
    `Build ONE cohesive 6-Pokemon team with a clear win condition. Think synergy first: weather/terrain ↔ its abusers, the speed mode (Tailwind XOR Trick Room) ↔ the attackers built for it, redirection ↔ a fragile sweeper, Intimidate/Fake Out ↔ securing KOs, pivots ↔ bringing breakers in safely.`,
    `HARD RULES: only Pokemon from this roster (exact names): ${reg.pokemon.join(", ")}. No duplicate species. EXACTLY ONE mega stone on the team. No Terastallization. Never put Trick Room and Tailwind (or a Swift-Swim/weather-speed plan) on the same team. Never run a weather-locked payoff (Archaludon Electro Shot needs rain; Solar Beam needs sun) unless the team sets that weather.`,
    `BANNED ITEMS — do NOT give any Pokemon these (they are illegal in ${reg.label}): ${reg.itemsBanned.join(", ")}.`,
    `Give every Pokemon a LEGAL held item and an ability it can actually have (the post-mega ability for mega members, e.g. Mega Mawile has Huge Power, not Intimidate).`,
    `DEFENSIVE TYPE BACKBONE: build a core whose types COVER EACH OTHER so no single attack threatens the whole team — classic mutually-covering triangles like Fire / Water / Grass or Steel / Fairy / Dragon (e.g. Mawile Steel/Fairy + Garchomp Dragon/Ground + Sylveon Fairy support each other). Every shared weakness should be RESISTED or made IMMUNE by a teammate (prefer abilities that also redirect: Lightning Rod ↔ Electric, Storm Drain ↔ Water, Flash Fire ↔ Fire, Levitate ↔ Ground).`,
    `SPEED FITS THE PLAN: on a Trick Room team every attacker must be SLOW (low base Speed — the slowest moves first); on a fast/Tailwind team they must be FAST. Do not put a high base-Speed attacker on a Trick Room team.`,
    `ANSWER NAMED THREATS concretely: for each big meta threat, include a member that beats it with a real typing + move — e.g. answer Charizard-Y (Fire/sun) with a Fire-resist carrying a Rock move (Hisuian Arcanine Fire/Rock OHKOs it with Rock Slide); answer Garchomp / Ground spam with a Fairy or a Levitate/Flying mon. Say WHICH threat each pick answers.`,
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
    speeds ? `\nBASE SPEEDS of the current core (the slowest move first under Trick Room): ${speeds}` : "",
    weaknesses
      ? `\nSHARED DEFENSIVE WEAKNESSES (cover each one with a teammate's resist/immunity):\n${weaknesses}`
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
