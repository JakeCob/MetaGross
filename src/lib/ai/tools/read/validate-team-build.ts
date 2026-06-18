import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { validateSet } from "@/lib/pokemon/validate-set";
import {
  isChampionsItem,
  isChampionsPokemon,
  isConfirmedNotInChampions,
  isMoveBlockedForSpecies,
  getUnavailableMovesFor,
  CHAMPIONS_ITEMS_BANNED,
  CHAMPIONS_ITEMS_CONFIRMED,
  CHAMPIONS_MEGAS,
  ACTIVE_REGULATION_LABEL,
} from "@/lib/data/champions";

const pokemonInputSchema = z.object({
  species: z.string().describe("Species name, e.g. 'Incineroar' or 'Scovillain-Mega'."),
  item: z.string().optional().describe("Held item. Include the mega stone for Mega Pokemon."),
  ability: z.string().optional(),
  moves: z.array(z.string()).max(4).optional(),
  points: z
    .object({
      hp: z.number().int().min(0).max(32).optional(),
      atk: z.number().int().min(0).max(32).optional(),
      def: z.number().int().min(0).max(32).optional(),
      spa: z.number().int().min(0).max(32).optional(),
      spd: z.number().int().min(0).max(32).optional(),
      spe: z.number().int().min(0).max(32).optional(),
    })
    .optional()
    .describe("Champions stat points (max 32/stat, 66 total). Omit if you haven't chosen a spread yet."),
});

type PokemonInput = z.infer<typeof pokemonInputSchema>;

interface SlotResult {
  slot: number;
  species: string;
  verdict: "ok" | "fix_needed" | "reject";
  issues: string[];
  expectedAbilities?: string[];
  suggestedReplacements?: string[];
}

interface TeamResult {
  verdict: "ok" | "fix_needed" | "reject";
  slots: SlotResult[];
  teamIssues: string[];
  summary: string;
  nextStep: string;
}

function normalizeItem(raw?: string): string {
  return (raw ?? "").trim();
}

function validateItemForSlot(
  species: string,
  item: string,
): { issues: string[]; expectedStone?: string } {
  const issues: string[] = [];
  if (!item) return { issues };

  // Banned item check — hard reject.
  const bannedHit = CHAMPIONS_ITEMS_BANNED.find(
    (b) => b.toLowerCase() === item.toLowerCase(),
  );
  if (bannedHit) {
    issues.push(
      `Item "${item}" is NOT in Pokemon Champions. Pick something from the allowed list — e.g. a type-boost held item, Focus Sash, Leftovers, Sitrus Berry, or a type-resist berry.`,
    );
    return { issues };
  }

  // Generic in-format check (covers CONFIRMED + UNCERTAIN).
  if (!isChampionsItem(item)) {
    issues.push(
      `Item "${item}" is not on the Champions items list (Game8). Pick from CHAMPIONS_ITEMS_CONFIRMED.`,
    );
  }

  // Mega stone ↔ species cross-check.
  const speciesLower = species.toLowerCase();
  const isMegaSpecies = /-mega(-[xy])?$/i.test(species);
  const itemIsMegaStone = /ite( x| y)?$/i.test(item);

  if (isMegaSpecies) {
    // The Pokemon is Mega — require the matching stone.
    const megaEntry = Object.entries(CHAMPIONS_MEGAS).find(
      ([form]) => form.toLowerCase() === speciesLower,
    );
    if (megaEntry) {
      const [, info] = megaEntry;
      if (item.toLowerCase() !== info.stone.toLowerCase()) {
        issues.push(
          `${species} needs ${info.stone} to Mega Evolve. You gave it "${item}".`,
        );
        return { issues, expectedStone: info.stone };
      }
    }
  } else if (itemIsMegaStone) {
    // Non-Mega species holding a Mega stone — usually wrong unless
    // it's the base form that will Mega Evolve mid-battle. Prompt
    // the agent to be explicit.
    const owningForm = Object.entries(CHAMPIONS_MEGAS).find(
      ([, info]) => info.stone.toLowerCase() === item.toLowerCase(),
    );
    if (owningForm) {
      const [form, info] = owningForm;
      if (info.baseSpecies.toLowerCase() !== speciesLower) {
        issues.push(
          `${item} is the Mega stone for ${form} (base: ${info.baseSpecies}). ${species} can't hold it — pick a different item or swap the species.`,
        );
      }
    }
  }

  return { issues };
}

function validatePoints(points?: PokemonInput["points"]): string[] {
  if (!points) return [];
  const stats = [
    ["hp", points.hp],
    ["atk", points.atk],
    ["def", points.def],
    ["spa", points.spa],
    ["spd", points.spd],
    ["spe", points.spe],
  ] as const;
  const issues: string[] = [];
  for (const [name, value] of stats) {
    if (value !== undefined && value > 32) {
      issues.push(
        `Champions format caps each stat at 32 points, but ${name} = ${value}. Use traditional EV→Points conversion: Math.min(32, Math.round(ev / 8)).`,
      );
    }
  }
  const total = stats.reduce(
    (sum, [, value]) => sum + (value ?? 0),
    0,
  );
  if (total > 66) {
    issues.push(
      `Champions caps total points at 66, but total = ${total}. Redistribute.`,
    );
  }
  return issues;
}

export const validateTeamBuildTool = new DynamicStructuredTool({
  name: "validate_team_build",
  description:
    "Validate a proposed Champions team slot-by-slot BEFORE emitting the final response. Runs per-Pokemon checks (species legality, ability against dex, moves exist, Mega stone match, item is in Champions and not banned) AND team-wide checks (item clause — no two Pokemon hold the same item, species clause, all 6 slots filled). Returns a verdict per slot + concrete fix instructions. Call this every time you propose a full team. Catch mistakes here instead of letting them ship to the user.",
  schema: z.object({
    team: z
      .array(pokemonInputSchema)
      .min(1)
      .max(6)
      .describe("1-6 Pokemon. Order matters — each gets a slot number."),
    format: z
      .string()
      .optional()
      .describe(`Defaults to '${ACTIVE_REGULATION_LABEL}'.`),
  }),
  func: async ({ team, format }) => {
    const fmt = format ?? ACTIVE_REGULATION_LABEL;
    const slots: SlotResult[] = [];
    const teamIssues: string[] = [];

    // Per-slot validation.
    for (let i = 0; i < team.length; i++) {
      const slotNum = i + 1;
      const p = team[i];
      const issues: string[] = [];
      let expectedAbilities: string[] | undefined;
      let suggestedReplacements: string[] | undefined;

      // Species + ability + moves via validateSet (covers dex knowledge).
      const setResult = validateSet({
        species: p.species,
        ability: p.ability,
        moves: p.moves,
        format: fmt,
      });
      for (const w of setResult.warnings) {
        issues.push(w.message);
        if (w.expected) expectedAbilities = w.expected;
      }

      // Additional item validation.
      const itemIssues = validateItemForSlot(p.species, normalizeItem(p.item));
      issues.push(...itemIssues.issues);

      // Champions-specific movepool check — a move may exist in
      // @pkmn/dex and be in the species' dex learnset yet still be
      // unavailable in Champions (e.g. Incineroar loses Knock Off).
      if (p.moves && p.moves.length > 0) {
        const blocked = p.moves.filter((m) =>
          isMoveBlockedForSpecies(p.species, m),
        );
        if (blocked.length > 0) {
          const unavailable = getUnavailableMovesFor(p.species).join(", ");
          issues.push(
            `${p.species} cannot use ${blocked.join(", ")} in ${ACTIVE_REGULATION_LABEL}. Blocked moves for this species: ${unavailable}. Pick from its Champions movepool (check get_pokemon_competitive_sets results).`,
          );
        }
      }

      // Champions points (EV format) check.
      issues.push(...validatePoints(p.points));

      // If species outright not in format, suggest alternatives.
      if (isConfirmedNotInChampions(p.species)) {
        suggestedReplacements = [
          "Garchomp", "Sneasler", "Kingambit", "Archaludon",
          "Incineroar", "Pelipper", "Sinistcha", "Basculegion",
        ];
      }

      const verdict: SlotResult["verdict"] = !isChampionsPokemon(p.species) && !/-mega/i.test(p.species)
        ? "reject"
        : issues.length > 0
          ? "fix_needed"
          : "ok";

      slots.push({
        slot: slotNum,
        species: p.species,
        verdict,
        issues,
        expectedAbilities,
        suggestedReplacements,
      });
    }

    // Team-wide: item clause.
    const itemCounts = new Map<string, number[]>();
    team.forEach((p, i) => {
      const item = normalizeItem(p.item);
      if (!item) return;
      const key = item.toLowerCase();
      if (!itemCounts.has(key)) itemCounts.set(key, []);
      itemCounts.get(key)!.push(i + 1);
    });
    for (const [item, slotsWithItem] of itemCounts) {
      if (slotsWithItem.length > 1) {
        teamIssues.push(
          `Item Clause violated: "${item}" is held by slots ${slotsWithItem.join(", ")}. Champions enforces one-unique-item-per-team. Swap at least ${slotsWithItem.length - 1} to different items.`,
        );
      }
    }

    // Team-wide: species clause.
    const speciesCounts = new Map<string, number[]>();
    team.forEach((p, i) => {
      // Fold Mega forms to the base so the same base species twice is caught.
      const base = p.species.replace(/-Mega(-[XY])?$/i, "").toLowerCase();
      if (!speciesCounts.has(base)) speciesCounts.set(base, []);
      speciesCounts.get(base)!.push(i + 1);
    });
    for (const [species, slotsWithSpecies] of speciesCounts) {
      if (slotsWithSpecies.length > 1) {
        teamIssues.push(
          `Species Clause violated: ${species} appears in slots ${slotsWithSpecies.join(", ")}. Each base species can appear at most once.`,
        );
      }
    }

    // Team-wide: multiple Mega Pokemon.
    const megaSlots = team
      .map((p, i) => ({ slot: i + 1, isMega: /-Mega(-[XY])?$/i.test(p.species) }))
      .filter((x) => x.isMega)
      .map((x) => x.slot);
    if (megaSlots.length > 1) {
      teamIssues.push(
        `Only one Mega Pokemon per team is allowed. Mega slots: ${megaSlots.join(", ")}. Drop the Mega stone from all but one and pick a different item.`,
      );
    }

    // Overall verdict.
    const hasRejects = slots.some((s) => s.verdict === "reject");
    const hasFixNeeded =
      slots.some((s) => s.verdict === "fix_needed") || teamIssues.length > 0;
    const verdict: TeamResult["verdict"] = hasRejects
      ? "reject"
      : hasFixNeeded
        ? "fix_needed"
        : "ok";

    // Generate a summary.
    const problemCount =
      slots.reduce((n, s) => n + s.issues.length, 0) + teamIssues.length;
    const summary =
      verdict === "ok"
        ? `Team looks clean — all ${team.length} slot(s) pass and no team-wide issues.`
        : `${problemCount} issue${problemCount === 1 ? "" : "s"} across ${team.length} slot(s). ${hasRejects ? "At least one Pokemon is illegal in format — swap before anything else." : "Tweaks needed."}`;

    const nextStep =
      verdict === "ok"
        ? "All clear — you can emit the team to the user. Consider calling simulate_vs_top_teams next to show how this team matches up against current Limitless top cuts."
        : verdict === "reject"
          ? "One or more Pokemon are illegal in Champions. Replace them (see suggestedReplacements per slot) and call validate_team_build again."
          : "Fix the per-slot issues + teamIssues, then call validate_team_build again before emitting the team to the user. Do not ship a team that has unresolved issues.";

    const result: TeamResult = {
      verdict,
      slots,
      teamIssues,
      summary,
      nextStep,
    };

    return JSON.stringify(result);
  },
});
