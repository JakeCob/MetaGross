/**
 * Synthesizer — LLM-backed lead + watch-for + win-condition builder.
 *
 * Consumes: analyzer output (archetype, synergies, speed control),
 *           researcher output (meta data), predictor output (opponent
 *           sets), plus MY team with FULL movesets.
 *
 * Produces: structured JSON with ranked lead suggestions, branching
 *           turn-1 scripts, role-labelled threat taxonomy, ability-
 *           interaction notes, late-game plan, watch-fors, and
 *           win conditions.
 *
 * Hard invariants enforced in the prompt:
 *   - Never cite a move the species doesn't actually know.
 *   - Leads must be species from MY team.
 *   - Archetype must be compound ("Hyper-Offense with Defensive Anchor"),
 *     never a one-word label.
 *   - Every lead must include at least 2 branching turn-1 scripts.
 *   - Must name at least one ability-level interaction.
 *   - Must include a late-game win condition.
 *
 * Parser coerces output back to the schema and flags hallucinated moves
 * with a visible ⚠ warning appended to the gamePlan.
 */
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { createModel, detectProvider } from "@/lib/ai/graph/model";
import type { ScoutingStateType, ScoutingStateUpdate } from "../state";
import type {
  SuggestedLead,
  ThreatRole,
  TurnOneScript,
  WinCondition,
  WinConditionKind,
} from "../types";
import type { TeamPokemon } from "@/lib/types/pokemon";
import { renderFactsForPrompt } from "../mechanical-facts";

function mkId(prefix: string, i: number): string {
  return `${prefix}-${Date.now().toString(36)}-${i}`;
}

const SYSTEM_PROMPT = `You are a world-class VGC doubles coach in the Wolfe Glick / Aaron "Cybertron" Zheng tradition. You receive:
  - the opponent's predicted 6 with items/abilities/moves
  - MY team of 6 with FULL movesets, items, abilities, natures
  - optional user-written strategy
  - any mid-battle observations

You must think like an elite player. You are NOT a template — you reason about speed tiers, Intimidate chains, ability mind-games, Tailwind vs Trick Room races, chip-damage progressions, and late-game positioning.

Return VALID JSON ONLY — no markdown, no prose outside the object. Schema:

{
  "archetype": "<REQUIRED compound phrase, e.g. 'Hyper-Offense with Defensive Anchor', 'Bulky Offense + Tailwind Sweep', 'Trick Room Stall'. Never a single word like 'balance', 'offense', or 'stall'.>",
  "threatTaxonomy": [
    { "role": "<e.g. 'Engine', 'Enforcer', 'Pivot Core', 'Wildcard', 'Defensive Anchor'>", "species": ["<one or more>"], "description": "<one sentence — what they actually do on the board>" },
    ...3-5 entries covering all 6 opponents
  ],
  "abilityInteractions": [
    "<e.g. 'My Milotic has Competitive — if they bring Aqua Tauros and Intimidate, Milotic gets +2 SpA free.'>",
    "<e.g. 'Their Aegislash King's Shield drops my Attack on contact — lead with Scald / Icy Wind instead of physical pressure.'>",
    ...2-4 entries; each must name the ability by name
  ],
  "suggestedLeads": [
    {
      "pair": ["<my species 1>", "<my species 2>"],
      "score": <0-100>,
      "rationale": "<one sentence citing the matchup logic>",
      "gamePlan": "<2-3 sentences; cite ONLY moves my pair actually knows>",
      "turnOneScripts": [
        {
          "label": "Plan A",
          "opponentLeads": "<e.g. 'Aerodactyl + Mega Kangaskhan'>",
          "play": "<e.g. 'Fake Out Aerodactyl with Incineroar, Icy Wind with Milotic'>",
          "logic": "<1-2 sentences explaining the speed/damage/status math>"
        },
        { "label": "Plan B", ... },
        { "label": "Plan C", ... }
      ]
    },
    ...up to 3 leads, ranked best first
  ],
  "watchFor": [
    "<bullet: specific threat, 1 sentence. About THEIR threats, not my plays.>",
    ...3-5 entries
  ],
  "suggestedWinConditions": [
    { "label": "<e.g. 'KO their Archaludon', 'Land Icy Wind turn 1'>", "kind": "ko" | "keep-alive" | "move-landed" | "field-state" | "hp-threshold" | "custom", "target": { "species": "<if ko/keep-alive/hp-threshold>", "moveName": "<if move-landed>", "fieldEffect": "<if field-state>", "hpPercent": <if hp-threshold>, "byTurn": <optional> } },
    ...2-3 entries
  ],
  "lateGameWinCon": "<2-3 sentences; what the game looks like after the first trade. 'Once Aerodactyl is down and Typhlosion-Hisui has taken Scald damage, Garchomp can freely Earthquake. Keep Sneasler hidden until Mega Kangaskhan is the only threat, then clean with Close Combat.'>",
  "synthesis": "<2-3 sentence paragraph summarizing the matchup, naming the key lever that wins it>"
}

HARD RULES — you will be graded on these:
1. Leads MUST be two distinct species from MY team. If I have a brought-4 list, prefer those.
2. gamePlan and turnOneScripts MUST only cite moves the species actually has in its listed moveset. If a species doesn't know Fake Out, never write Fake Out. If the pair can't do the play you're proposing, pick a different plan.
3. Every lead MUST include at least 2 entries in turnOneScripts keyed to plausible opponent leads. A single script is not enough — the opponent has options.
4. abilityInteractions MUST name at least one concrete ability (Intimidate, Competitive, Defiant, Levitate, Cloud Nine, Download, Rough Skin, Water Bubble, Unaware, etc.) and the play it enables or denies. Prefer interactions listed in the MECHANICAL FACTS block below.
5. threatTaxonomy MUST cover all 6 of the opponent's Pokemon somewhere (roles can group them).
6. archetype MUST be a compound descriptor. One-word labels are rejected.
7. watchFor is about the OPPONENT's threats — not advice on what I should do.
8. Win-condition "kind" must match the target shape. move-landed needs moveName; ko/keep-alive needs species; hp-threshold needs species + hpPercent; field-state needs fieldEffect.
9. Use the fieldEffect enum literally: "trickRoom" | "tailwindP1" | "tailwindP2" | "rain" | "sun" | "sand" | "snow" | "grassyTerrain" | "electricTerrain" | "psychicTerrain" | "mistyTerrain".
10. lateGameWinCon is REQUIRED — do not leave it empty. The user needs to know what the win looks like after turn 2.
11. No markdown, no code fences, no commentary outside the JSON.

FACT-GROUNDING RULES — the user prompt contains a MECHANICAL FACTS block (Mega ability swaps, Fake Out immunities, 4× weaknesses, weather setters, Intimidate × Defiant/Competitive audit, ability trigger order). TRUST THESE OVER YOUR OWN RECALL. In particular:
  - If a Pokemon is listed under "FAKE OUT / FLINCH IMMUNITIES", NEVER target Fake Out at it. Route Fake Out elsewhere.
  - If MEGA ABILITY SWAPS shows a Mega triggering a weather-setting ability, the Mega turn will overwrite any other weather in play — factor this into turn-1 scripts.
  - If 4× WEAKNESSES shows an opponent with an exploiter on my team, prioritise that matchup in your lead or late-game plan.
  - If INTIMIDATE × DEFIANT/COMPETITIVE/CONTRARY flags a conflict, explicitly address it (e.g., "Don't send Incineroar in on their Bisharp — Defiant will boost it.").
  - The ABILITY TRIGGER ORDER in the facts block IS the correct Champions/VGC sequence. Use it when reasoning about Mega + weather + Intimidate interactions — switch-ins fire entry abilities in speed order, then Mega Evolution resolves BEFORE any moves and swaps in the Mega's ability.`;

export async function synthesizerNode(
  state: ScoutingStateType,
): Promise<Partial<ScoutingStateUpdate>> {
  const userPrompt = buildUserPrompt(state);
  const provider =
    (state.providerOverride as "openai" | "openrouter" | "anthropic" | null) ||
    detectProvider();
  const model = createModel(provider, state.modelOverride ?? undefined);

  const response = await model.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(userPrompt),
  ]);

  const text = flattenContent(response.content);
  const parsed = parseJsonLoose(text);

  const archetype = coerceArchetype(parsed?.archetype, state.archetype);
  const threatTaxonomy = coerceThreatTaxonomy(parsed?.threatTaxonomy);
  const abilityInteractions = coerceStringArray(parsed?.abilityInteractions, 6);
  const suggestedLeads = coerceLeads(parsed?.suggestedLeads, state.myTeam);
  const watchFor = coerceStringArray(parsed?.watchFor, 6);
  const suggestedWinConditions = coerceWinConditions(
    parsed?.suggestedWinConditions,
  );
  const lateGameWinCon =
    typeof parsed?.lateGameWinCon === "string" ? parsed.lateGameWinCon : "";
  const synthesis =
    typeof parsed?.synthesis === "string" ? parsed.synthesis : "";

  return {
    archetype,
    threatTaxonomy,
    abilityInteractions,
    suggestedLeads,
    watchFor,
    suggestedWinConditions,
    lateGameWinCon,
    synthesis,
    history: [
      {
        source: "synthesizer",
        summary: `leads=${suggestedLeads.length}, scripts=${suggestedLeads.reduce((n, l) => n + (l.turnOneScripts?.length ?? 0), 0)}, taxonomy=${threatTaxonomy.length}, abilities=${abilityInteractions.length}`,
        at: Date.now(),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Prompt assembly
// ---------------------------------------------------------------------------

function buildUserPrompt(state: ScoutingStateType): string {
  const lines: string[] = [];

  // --- MY TEAM ---
  lines.push("MY TEAM (★ = brought-4):");
  const brSet = new Set(state.myBrought);
  for (const p of state.myTeam) {
    const tag = brSet.has(p.species) ? "★" : " ";
    const moves = p.moves.filter(Boolean).join(" / ") || "(no moves listed)";
    lines.push(
      `  ${tag} ${p.species} | ability=${p.ability || "?"} | item=${p.item || "?"} | nature=${p.nature} | moves=[${moves}]`,
    );
  }
  if (state.myTeamDescription.trim()) {
    lines.push("");
    lines.push(`MY STRATEGY (user-written): ${state.myTeamDescription.trim()}`);
  }
  lines.push("");

  // --- OPPONENT ---
  lines.push("OPPONENT TEAM (predicted sets):");
  for (const pred of state.predictions) {
    const moves = pred.moves.filter(Boolean).join(" / ") || "?";
    lines.push(
      `  • ${pred.species} (conf ${Math.round(pred.confidence * 100)}%) | ability=${pred.ability || "?"} | item=${pred.item || "?"} | nature=${pred.nature} | moves=[${moves}]`,
    );
  }
  lines.push(`ANALYZER ARCHETYPE GUESS: ${state.archetype || "unknown"}`);
  if (state.teamSynergies.length) {
    lines.push(`SYNERGIES: ${state.teamSynergies.join("; ")}`);
  }
  if (state.speedControl.length) {
    lines.push(`SPEED CONTROL: ${state.speedControl.join(", ")}`);
  }
  lines.push("");

  // --- MECHANICAL FACTS (pure compute — grounds the LLM) ---
  if (state.mechanicalFacts) {
    lines.push(renderFactsForPrompt(state.mechanicalFacts));
    lines.push("");
  }

  lines.push(
    "Based ONLY on the movesets above and the MECHANICAL FACTS block, produce the JSON object. Remember: never cite a move that isn't on the pair's actual movesets, never Fake Out a Ghost-type, and every lead needs at least 2 turnOneScripts.",
  );
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Output coercion
// ---------------------------------------------------------------------------

function flattenContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter(
        (b): b is { type: "text"; text: string } =>
          typeof b === "object" &&
          b !== null &&
          "type" in b &&
          (b as { type: string }).type === "text" &&
          "text" in b,
      )
      .map((b) => b.text)
      .join("");
  }
  return "";
}

function parseJsonLoose(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const first = withoutFence.indexOf("{");
  const last = withoutFence.lastIndexOf("}");
  if (first === -1 || last <= first) return null;
  try {
    return JSON.parse(withoutFence.slice(first, last + 1)) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

/**
 * Reject single-word archetype labels — they lose all signal. Fall back
 * to the analyzer's guess if the synthesizer gives us garbage.
 */
function coerceArchetype(raw: unknown, fallback: string): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return fallback;
  // A "compound" label must have at least 2 meaningful tokens.
  const tokens = s.split(/[\s,+/-]+/).filter(Boolean);
  if (tokens.length < 2) return fallback || s;
  return s;
}

function coerceThreatTaxonomy(raw: unknown): ThreatRole[] {
  if (!Array.isArray(raw)) return [];
  const out: ThreatRole[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const obj = r as Record<string, unknown>;
    const role = typeof obj.role === "string" ? obj.role.trim() : "";
    const description =
      typeof obj.description === "string" ? obj.description.trim() : "";
    const species = Array.isArray(obj.species)
      ? obj.species.filter((s): s is string => typeof s === "string")
      : [];
    if (!role || !description || species.length === 0) continue;
    out.push({ role, species, description });
    if (out.length >= 6) break;
  }
  return out;
}

/**
 * Validate leads against MY team — drop anything where the species
 * doesn't match, and scrub gamePlan mentions of moves the pair doesn't
 * know. This is the last-line defense against LLM hallucination.
 */
function coerceLeads(
  raw: unknown,
  myTeam: TeamPokemon[],
): SuggestedLead[] {
  if (!Array.isArray(raw)) return [];

  const teamSet = new Set(myTeam.map((p) => p.species.toLowerCase()));
  const moveMap = new Map<string, Set<string>>();
  for (const p of myTeam) {
    moveMap.set(
      p.species.toLowerCase(),
      new Set(p.moves.filter(Boolean).map((m) => m.toLowerCase())),
    );
  }

  const out: SuggestedLead[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const r = entry as Record<string, unknown>;
    const pair = r.pair;
    if (!Array.isArray(pair) || pair.length !== 2) continue;
    const a = String(pair[0] ?? "").trim();
    const b = String(pair[1] ?? "").trim();
    if (!a || !b || a === b) continue;
    if (!teamSet.has(a.toLowerCase()) || !teamSet.has(b.toLowerCase())) {
      // Species not on my team — LLM hallucinated. Drop this lead.
      continue;
    }

    const score =
      typeof r.score === "number"
        ? Math.max(0, Math.min(100, Math.round(r.score)))
        : 50;
    const rationale = typeof r.rationale === "string" ? r.rationale : "";
    let gamePlan = typeof r.gamePlan === "string" ? r.gamePlan : "";

    // Build the set of moves available to the pair for hallucination checks.
    const movesAvailable = new Set<string>([
      ...(moveMap.get(a.toLowerCase()) ?? new Set<string>()),
      ...(moveMap.get(b.toLowerCase()) ?? new Set<string>()),
    ]);

    const hallucinated = findHallucinatedMoves(gamePlan, movesAvailable);
    if (hallucinated.length > 0) {
      gamePlan += ` ⚠ (AI cited move${hallucinated.length > 1 ? "s" : ""} not on this pair: ${hallucinated.join(", ")})`;
    }

    const turnOneScripts = coerceTurnOneScripts(
      r.turnOneScripts,
      movesAvailable,
    );

    out.push({ pair: [a, b], score, rationale, gamePlan, turnOneScripts });
  }
  return out.slice(0, 3);
}

function coerceTurnOneScripts(
  raw: unknown,
  movesAvailable: Set<string>,
): TurnOneScript[] {
  if (!Array.isArray(raw)) return [];
  const out: TurnOneScript[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const obj = r as Record<string, unknown>;
    const label = typeof obj.label === "string" ? obj.label.trim() : "";
    const opponentLeads =
      typeof obj.opponentLeads === "string" ? obj.opponentLeads.trim() : "";
    let play = typeof obj.play === "string" ? obj.play.trim() : "";
    const logic = typeof obj.logic === "string" ? obj.logic.trim() : "";
    if (!label || !play || !opponentLeads) continue;
    const hallucinated = findHallucinatedMoves(play, movesAvailable);
    if (hallucinated.length > 0) {
      play += ` ⚠ (${hallucinated.join(", ")} not on this pair)`;
    }
    out.push({ label, opponentLeads, play, logic });
    if (out.length >= 4) break;
  }
  return out;
}

/**
 * Heuristic: scan free-form plan text for capitalised move names that
 * aren't in the pair's movesets. We don't try to be exhaustive — just
 * catch common flags.
 */
function findHallucinatedMoves(
  plan: string,
  movesAvailable: Set<string>,
): string[] {
  const COMMON_MOVES = [
    "Fake Out", "Protect", "Taunt", "Tailwind", "Trick Room", "Rain Dance",
    "Sunny Day", "Snowscape", "Icy Wind", "Thunder Wave", "Will-O-Wisp",
    "Swords Dance", "Nasty Plot", "Helping Hand", "Follow Me", "Rage Powder",
    "Spore", "Sleep Powder", "Substitute", "Recover", "Roost", "Ally Switch",
    "Fake Tears", "Snarl", "Parting Shot", "U-turn", "Volt Switch",
    "Earthquake", "Rock Slide", "Dazzling Gleam", "Hyper Voice", "Heat Wave",
    "Blizzard", "Muddy Water", "Flare Blitz", "Knock Off", "Close Combat",
    "Eruption", "Draco Meteor", "Sucker Punch", "Aqua Jet", "Extreme Speed",
    "Scald", "Surf", "Aura Sphere",
    // Forced-switch tools — critical against Trick Room / setup setters.
    "Dragon Tail", "Roar", "Whirlwind", "Circle Throw",
    // Priority / pivoting / disruption the LLM loves to cite.
    "Quick Attack", "Bullet Punch", "Ice Shard", "Mach Punch",
    "Encore", "Disable", "Haze", "Clear Smog",
  ];
  const found: string[] = [];
  const lower = plan.toLowerCase();
  for (const m of COMMON_MOVES) {
    if (
      lower.includes(m.toLowerCase()) &&
      !movesAvailable.has(m.toLowerCase())
    ) {
      found.push(m);
    }
  }
  return found;
}

function coerceStringArray(raw: unknown, cap = 6): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .slice(0, cap);
}

const ALLOWED_KINDS: WinConditionKind[] = [
  "ko",
  "keep-alive",
  "move-landed",
  "field-state",
  "hp-threshold",
  "custom",
];

function coerceWinConditions(raw: unknown): WinCondition[] {
  if (!Array.isArray(raw)) return [];
  const now = Date.now();
  const out: WinCondition[] = [];
  for (let i = 0; i < raw.length && out.length < 4; i++) {
    const r = raw[i];
    if (!r || typeof r !== "object") continue;
    const obj = r as Record<string, unknown>;
    const label = typeof obj.label === "string" ? obj.label : "";
    const kind = ALLOWED_KINDS.includes(obj.kind as WinConditionKind)
      ? (obj.kind as WinConditionKind)
      : "custom";
    if (!label) continue;
    const target =
      obj.target && typeof obj.target === "object"
        ? (obj.target as WinCondition["target"])
        : undefined;
    out.push({
      id: mkId("wc", i),
      label,
      kind,
      target,
      status: "pending",
      checkable: kind !== "custom",
      source: "agent",
      createdAt: now,
    });
  }
  return out;
}
