import { getAllSpecies } from "@/lib/pokemon/species";
import { isChampionsPokemon } from "@/lib/data/champions";

const NON_SPECIES_HEADING_WORDS = new Set<string>([
  "team",
  "overview",
  "summary",
  "notes",
  "strategy",
  "game plan",
  "gameplan",
  "matchup",
  "matchups",
  "lead",
  "leads",
  "bring",
  "core",
  "core tech",
  "source",
  "url",
  "record",
  "link",
  "why",
  "why this works",
  "final",
  "final verdict",
  "final recommendation",
  "tradeoff",
  "tradeoffs",
  "gains",
  "losses",
  "overall",
  "example",
  "bulaklak",
  "placement",
  "roster",
  "pokemon",
  "lineup",
  "archetype",
  "bottom line",
  "updated",
  "what changed",
  "important note",
  "tips",
  "principles",
  "additional",
  "deliverables",
  "results",
]);

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSpeciesRegex(name: string): RegExp {
  const pattern = escapeRegex(name)
    .replace(/\\ /g, "[\\s-]+")
    .replace(/\\-/g, "[-\\s]+")
    .replace(/\\\./g, "\\.?");
  return new RegExp(`(?<![A-Za-z-])${pattern}(?![A-Za-z-])`, "i");
}

const ALL_DEX_SPECIES = Array.from(
  new Set(getAllSpecies().map((species) => species.name)),
).sort((a, b) => b.length - a.length);

const DEX_SPECIES_REGEXES = ALL_DEX_SPECIES.map((name) => ({
  name,
  regex: buildSpeciesRegex(name),
}));

const KNOWN_DEX_SPECIES = new Set(
  ALL_DEX_SPECIES.flatMap((name) => [
    name.toLowerCase(),
    name.toLowerCase().replace(/-/g, " "),
  ]),
);

function isLikelySpeciesHeading(candidate: string): boolean {
  const normalized = candidate.trim().toLowerCase();
  return (
    KNOWN_DEX_SPECIES.has(normalized) ||
    KNOWN_DEX_SPECIES.has(normalized.replace(/-/g, " ")) ||
    isChampionsPokemon(candidate)
  );
}

/**
 * Extract Pokemon species mentions from free-form LLM text.
 *
 * We combine:
 * - heading-style parsing (for `### Heatran`, `1. Rillaboom`, etc.)
 * - full dex scanning (for prose like "Heatran is a good Scizor answer")
 *
 * This closes the gap where non-heading prose could mention illegal
 * species that were not on our explicit NOT_IN_CHAMPIONS blocklist.
 */
export function extractSpeciesMentions(content: string): string[] {
  const mentionedSpecies = new Set<string>();

  const headingRegexes: RegExp[] = [
    /(?:^|\n)#{1,3}\s+(?:\d+[.)]\s+)?\*{0,2}([A-Z][A-Za-z]+(?:-[A-Za-z]+)*)\*{0,2}/g,
    /(?:^|\n)\s*\d+[.)]\s+\*{0,2}([A-Z][A-Za-z]+(?:-[A-Za-z]+)*)\*{0,2}/g,
    /(?:^|\n)\*\*([A-Z][A-Za-z]+(?:-[A-Za-z]+)*)\*\*/g,
  ];

  for (const re of headingRegexes) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(content)) !== null) {
      const candidate = (match[1] ?? "").trim();
      if (!candidate) continue;
      if (NON_SPECIES_HEADING_WORDS.has(candidate.toLowerCase())) continue;
      if (!isLikelySpeciesHeading(candidate)) continue;
      mentionedSpecies.add(candidate);
    }
  }

  for (const { name, regex } of DEX_SPECIES_REGEXES) {
    if (regex.test(content)) {
      mentionedSpecies.add(name);
    }
  }

  return Array.from(mentionedSpecies);
}
