import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { CHAMPIONS_POINTS } from "@/lib/data/champions";

const POKEPASTE_STAT_ORDER = [
  ["hp", "HP"],
  ["atk", "Atk"],
  ["def", "Def"],
  ["spa", "SpA"],
  ["spd", "SpD"],
  ["spe", "Spe"],
] as const;

const pokemonSchema = z.object({
  species: z.string().min(1),
  nickname: z.string().optional(),
  item: z.string().optional(),
  ability: z.string().optional(),
  level: z.number().int().min(1).max(100).optional(),
  nature: z.string().optional(),
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
    .describe("Champions stat points (0-32/stat). Converted to pokepaste EVs via point × 8 (capped at 252)."),
  ivs: z
    .object({
      hp: z.number().int().min(0).max(31).optional(),
      atk: z.number().int().min(0).max(31).optional(),
      def: z.number().int().min(0).max(31).optional(),
      spa: z.number().int().min(0).max(31).optional(),
      spd: z.number().int().min(0).max(31).optional(),
      spe: z.number().int().min(0).max(31).optional(),
    })
    .optional()
    .describe("Per-stat IVs 0-31. Defaults to 31 for all stats (Champions fixes IVs at 31 — only override to hit specific damage/speed tiers, e.g. 0 Spe for Trick Room)."),
});

type PokemonInput = z.infer<typeof pokemonSchema>;

function pointsToEvs(points: PokemonInput["points"]): Record<string, number> {
  if (!points) return {};
  const out: Record<string, number> = {};
  for (const [key] of POKEPASTE_STAT_ORDER) {
    const raw = points[key as keyof typeof points];
    if (raw === undefined || raw === 0) continue;
    // Points × 8 → EVs; cap at 252 because that's the Showdown max.
    const converted = Math.min(252, raw * CHAMPIONS_POINTS.evConversion);
    if (converted > 0) out[key] = converted;
  }
  return out;
}

function formatEvLine(
  evs: Record<string, number>,
  label: "EVs" | "IVs",
  defaultValue: number,
): string | null {
  // Emit only non-default stats — Showdown convention.
  const parts: string[] = [];
  for (const [key, display] of POKEPASTE_STAT_ORDER) {
    const value = evs[key];
    if (value === undefined) continue;
    if (label === "IVs" && value === defaultValue) continue;
    if (label === "EVs" && value === 0) continue;
    parts.push(`${value} ${display}`);
  }
  if (parts.length === 0) return null;
  return `${label}: ${parts.join(" / ")}`;
}

function renderOneMon(mon: PokemonInput): string {
  const lines: string[] = [];

  // Header: "Nickname (Species) @ Item" — omit nickname parens when absent.
  const headerSpecies = mon.nickname
    ? `${mon.nickname} (${mon.species})`
    : mon.species;
  lines.push(mon.item ? `${headerSpecies} @ ${mon.item}` : headerSpecies);

  if (mon.ability) lines.push(`Ability: ${mon.ability}`);
  if (mon.level !== undefined && mon.level !== 50) {
    lines.push(`Level: ${mon.level}`);
  } else {
    // Champions default — always emit so the Showdown importer scales
    // correctly even if the user forgot to paste a level.
    lines.push(`Level: 50`);
  }

  const evs = pointsToEvs(mon.points);
  const evLine = formatEvLine(evs, "EVs", 0);
  if (evLine) lines.push(evLine);

  if (mon.nature) lines.push(`${mon.nature} Nature`);

  const ivLine = mon.ivs ? formatEvLine(mon.ivs as Record<string, number>, "IVs", 31) : null;
  if (ivLine) lines.push(ivLine);

  if (mon.moves) {
    for (const move of mon.moves) {
      if (move.trim()) lines.push(`- ${move.trim()}`);
    }
  }

  return lines.join("\n");
}

export const exportPokepasteTool = new DynamicStructuredTool({
  name: "export_pokepaste",
  description:
    "Generate a Showdown-compatible pokepaste for a proposed team. Takes the same per-Pokemon shape as validate_team_build (species + item + ability + moves + nature + Champions points). Converts Champions stat points to EVs (point × 8, capped at 252) so the user can paste directly into Showdown or pokepaste.es. Call this when the user asks for a 'pokepaste', 'showdown export', 'exportable format', or wants to test the team on Showdown.",
  schema: z.object({
    teamName: z
      .string()
      .optional()
      .describe("Optional team name rendered as '=== [format] Team Name ===' at the top."),
    format: z
      .string()
      .optional()
      .default("Champions Reg M-A")
      .describe("Format label for the paste header."),
    pokemon: z.array(pokemonSchema).min(1).max(6),
  }),
  func: async ({ teamName, format, pokemon }) => {
    const fmtLabel = format ?? "Champions Reg M-A";
    const blocks = pokemon.map(renderOneMon);
    const header = teamName
      ? `=== [${fmtLabel}] ${teamName} ===\n\n`
      : "";
    const paste = header + blocks.join("\n\n");

    return JSON.stringify({
      pokepaste: paste,
      teamSize: pokemon.length,
      format: fmtLabel,
      nextStep:
        "Emit the `pokepaste` field verbatim inside a fenced code block so the user can copy/paste it directly into Showdown's team builder or pokepaste.es. Tell the user that points were converted to EVs (×8, cap 252) for Showdown compatibility — on-cartridge the Champions 66-point total is what matters.",
    });
  },
});
