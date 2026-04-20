"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PokemonSprite } from "@/components/pokemon-sprite";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSetValidation } from "@/hooks/use-set-validation";

export interface PokemonBlock {
  name: string;
  role?: string;
  ability?: string;
  item?: string;
  moves?: string;
  nature?: string;
  points?: string;
  spreadReasoning?: string;
}

/**
 * A research-report team block — emitted when the agent structures a
 * player/team summary with "### Player — Archetype" + Source/URL/
 * Team/Core tech bullets (RESEARCH RESPONSE FORMAT in the system
 * prompt). Rendered as a visual card with species sprites, not as
 * plain markdown — much easier to scan in a narrow chat pane.
 */
export interface ResearchTeamBlock {
  name: string;
  subtitle?: string;
  source?: string;
  sourceType?: string;
  url?: string;
  team?: string[];
  setItems?: Record<string, string>;
  coreTech?: string;
  /** Anything else the model wrote in the section, rendered below as markdown. */
  extra?: string;
}

/**
 * Structured multi-choice question the agent emits inline via a
 * `<user-question>{JSON}</user-question>` tag. The renderer pulls them
 * out and shows tappable option chips — clicking one sends the
 * option's `value` as the next user message so the conversation
 * continues without manual typing.
 */
export interface UserQuestionBlock {
  question: string;
  options: Array<{ label: string; value: string }>;
}

export interface CardActions {
  onAddToTeam?: (data: PokemonBlock) => void;
  onAddAllToTeam?: (data: PokemonBlock[]) => void;
  onCopy?: (data: PokemonBlock) => void;
  onResuggest?: (species: string) => void;
  onChangeField?: (species: string, field: string, prompt: string) => void;
  /** Fired when the user taps one of the ask-user-question chips. */
  onAnswerQuestion?: (value: string) => void;
  /** Fired from a ResearchTeamCard "+ Use this team" button — the
   *  parent fetches the full decklist (abilities/items/moves) by the
   *  species list and loads it into the current TeamBuilder. */
  onUseResearchTeam?: (data: ResearchTeamBlock) => void;
  /** Fired from a ResearchTeamCard "Make my version" button — parent
   *  typically sends a follow-up prompt to the agent asking for a
   *  personalised variant. */
  onMakeVariant?: (data: ResearchTeamBlock) => void;
  /** Fired from the "Use first, save rest as drafts" bulk action. */
  onUseAllResearchTeams?: (teams: ResearchTeamBlock[]) => void;
}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "pokemon"; data: PokemonBlock }
  | { type: "research"; data: ResearchTeamBlock };

/**
 * Pull out every <user-question>{JSON}</user-question> block from the
 * stream, returning the content with those tags stripped plus the
 * parsed questions in order. Tolerant of incomplete/malformed JSON —
 * a bad block just becomes plain text so we don't swallow the agent's
 * reply silently.
 */
function extractUserQuestions(
  content: string,
): { stripped: string; questions: UserQuestionBlock[] } {
  const questions: UserQuestionBlock[] = [];
  const stripped = content.replace(
    /<user-question>\s*([\s\S]*?)\s*<\/user-question>/gi,
    (_, inner: string) => {
      try {
        const parsed = JSON.parse(inner) as unknown;
        if (
          parsed &&
          typeof parsed === "object" &&
          "question" in parsed &&
          "options" in parsed &&
          Array.isArray((parsed as { options: unknown }).options)
        ) {
          const q = (parsed as { question: unknown }).question;
          const optsRaw = (parsed as { options: unknown[] }).options;
          const options: UserQuestionBlock["options"] = [];
          for (const opt of optsRaw) {
            if (!opt || typeof opt !== "object") continue;
            const o = opt as Record<string, unknown>;
            const label = typeof o.label === "string" ? o.label : typeof o.value === "string" ? o.value : null;
            const value = typeof o.value === "string" ? o.value : label;
            if (!label || !value) continue;
            options.push({ label, value });
          }
          if (typeof q === "string" && q.trim() && options.length > 0) {
            questions.push({ question: q.trim(), options });
            // Leave a placeholder token where the question was so we can
            // interleave it back into the block order.
            return `\n\n<<__USER_QUESTION_${questions.length - 1}__>>\n\n`;
          }
        }
      } catch {
        // fall through — leave the raw tag in place so the user sees
        // what the model tried to do instead of silently hiding it.
      }
      return `<user-question>${inner}</user-question>`;
    },
  );
  return { stripped, questions };
}

const RESERVED_BOLD_FIELD_LABELS = new Set([
  "source",
  "url",
  "source url",
  "link",
  "record",
  "placement",
  "team",
  "roster",
  "pokemon",
  "pokémon",
  "lineup",
  "core tech",
  "core",
  "tech",
  "strategy",
  "why it works",
  "imported set list",
  "imported set list from source",
  "notes",
]);

function normalizeLabelText(value: string): string {
  return value.replace(/^[-–—"“”']+|[-–—"“”']+$/g, "").trim();
}

function normalizeFieldKey(value: string): string {
  return normalizeLabelText(value)
    .replace(/:+$/, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isStandaloneBoldHeading(line: string): boolean {
  const match = line.match(/^\*\*(.+?)\*\*\s*$/);
  if (!match) return false;

  const inner = match[1].trim();
  if (!/^[A-Z]/.test(inner)) return false;
  // Don't treat Pokepaste "**Species @ Item**" lines as generic
  // standalone bold headings — they're a sub-header of an existing
  // Pokemon section that should be absorbed as the item, not split
  // into its own block.
  if (/@/.test(inner)) return false;

  const normalized = normalizeFieldKey(inner);
  return !RESERVED_BOLD_FIELD_LABELS.has(normalized);
}

/**
 * Recognises a bare "Species @ Item" line as a Pokemon section
 * header (Pokepaste-style). Matches:
 *   Cooklediaw @ Leftovers
 *   Scovillain-Mega @ Scovillainite
 *   **Mega Scovillain** @ Scovillainite   ← partial bold is fine
 *
 * Rejects:
 *   - leading bullet ("- Mega Scovillain @ Stone") — nested list item
 *   - fully-wrapped bold ("**Species @ Item**") — that's a sub-header
 *     inside an existing Pokemon section, handled by the absorb path
 *     in parseContent, not as a new section split
 *   - colon-bearing lines ("Item: X @ Y")
 */
function isSpeciesAtItemHeader(line: string): boolean {
  if (/^\s*[-*+]\s/.test(line)) return false;
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.includes(":")) return false;
  if (!/@/.test(trimmed)) return false;
  // Reject the full-bold variant — absorbed as an item-line, not a split.
  if (/^\*\*.+\*\*\s*$/.test(trimmed)) return false;
  return /^\*{0,2}[A-Z][A-Za-z0-9'’. -]{1,40}\*{0,2}\s*@\s+.+$/.test(trimmed);
}

function splitContentSections(content: string): string[] {
  const parts: string[] = [];
  const lines = content.split("\n");
  let current: string[] = [];

  const pushCurrent = () => {
    const part = current.join("\n").trim();
    if (part) parts.push(part);
  };

  for (const line of lines) {
    const startsSection =
      /^###\s+/.test(line) ||
      /^##\s+/.test(line) ||
      /^\d+[).]\s+[A-Z]/.test(line) ||
      isStandaloneBoldHeading(line) ||
      isSpeciesAtItemHeader(line);

    if (startsSection && current.some((currentLine) => currentLine.trim())) {
      pushCurrent();
      current = [line];
      continue;
    }

    if (startsSection) {
      current = [line];
      continue;
    }

    current.push(line);
  }

  pushCurrent();
  return parts;
}

function stripMarkdownDecorations(value: string): string {
  return value
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function getSpeciesLookupKey(species: string): string {
  const clean = stripMarkdownDecorations(species).replace(/\s+/g, " ").trim();
  const explicitMega =
    /^Mega\s+/i.test(clean) ||
    /\(Mega(?:\s+[XY])?\)/i.test(clean) ||
    /-Mega(?:-[XY])?$/i.test(clean) ||
    /-Mega[XY]$/i.test(clean);

  let base = clean
    .replace(/^Mega\s+/i, "")
    .replace(/\s*\(Mega(?:\s+[XY])?\)\s*/i, "")
    .replace(/-Mega(?:-[XY])?$/i, "")
    .replace(/-Mega[XY]$/i, "")
    .trim();

  if (explicitMega) {
    base = base.replace(/(?:\s+|-)(X|Y)$/i, "").trim();
  }

  return base.toLowerCase();
}

function extractImportedSetItems(content: string): Record<string, string> {
  const items: Record<string, string> = {};
  const regex = /^\s*[-*]\s*\*{0,2}([^*\n@]+?)\*{0,2}\s*@\s*([^\n]+?)\s*$/gm;

  for (const match of content.matchAll(regex)) {
    const species = stripMarkdownDecorations(match[1] ?? "").trim();
    const item = stripMarkdownDecorations(match[2] ?? "")
      .split(/[—–]/)[0]
      .trim();
    if (!species || !item) continue;
    items[getSpeciesLookupKey(species)] = item;
  }

  return items;
}

function isMegaStoneItem(item?: string): boolean {
  if (!item) return false;
  const clean = stripMarkdownDecorations(item)
    .split(/[—–\-(:]/)[0]
    .trim();
  return /(?:ite(?:\s+[XY])?|mega stone)$/i.test(clean) || /^dragoninite$/i.test(clean);
}

type MegaVariant = "X" | "Y" | null;

function extractMegaVariant(value?: string): MegaVariant {
  if (!value) return null;
  const clean = stripMarkdownDecorations(value).trim();
  const match = clean.match(/(?:-Mega(?:-|\s*)?|Mega\s+.+\s+|ite\s+)(X|Y)$/i);
  return match ? (match[1].toUpperCase() as MegaVariant) : null;
}

function resolveRenderedPokemon(species: string, item?: string): {
  displayName: string;
  spriteSpecies: string;
  isMega: boolean;
} {
  const cleanSpecies = stripMarkdownDecorations(species).replace(/\s+/g, " ").trim();
  const explicitMega =
    /^Mega\s+/i.test(cleanSpecies) ||
    /\(Mega(?:\s+[XY])?\)/i.test(cleanSpecies) ||
    /-Mega(?:-[XY])?$/i.test(cleanSpecies) ||
    /-Mega[XY]$/i.test(cleanSpecies);
  const variant = extractMegaVariant(cleanSpecies) ?? extractMegaVariant(item);
  const isMega = explicitMega || isMegaStoneItem(item);

  let baseSpecies = cleanSpecies
    .replace(/^Mega\s+/i, "")
    .replace(/\s*\(Mega(?:\s+[XY])?\)\s*/i, "")
    .replace(/-Mega(?:-[XY])?$/i, "")
    .replace(/-Mega[XY]$/i, "")
    .trim();

  if (explicitMega) {
    baseSpecies = baseSpecies.replace(/(?:\s+|-)(X|Y)$/i, "").trim();
  }

  const spriteSpecies = isMega
    ? `${baseSpecies}-Mega${variant ? `-${variant}` : ""}`
    : baseSpecies;

  return {
    displayName: isMega
      ? `Mega ${baseSpecies}${variant ? ` ${variant}` : ""}`
      : cleanSpecies,
    spriteSpecies,
    isMega,
  };
}

function isExistingMarkdownLine(line: string): boolean {
  return /^\s*(?:[-*+]\s+|\d+[).]\s+|#{1,6}\s+|>\s+|```|\|)/.test(line);
}

function isLikelyLooseBulletLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (isExistingMarkdownLine(trimmed)) return false;
  if (/^https?:\/\//i.test(trimmed)) return false;
  if (trimmed.endsWith(":")) return false;
  if (trimmed.length > 120) return false;
  return true;
}

function isMarkdownListLine(line: string): boolean {
  return /^\s*(?:[-*+]\s+|\d+[).]\s+)/.test(line);
}

function normalizeExplicitMarkdownLists(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const prevOut = out.length > 0 ? out[out.length - 1] : null;
    const prevNonEmpty = [...out].reverse().find((entry) => entry.trim() !== "") ?? null;

    if (
      isMarkdownListLine(line) &&
      prevNonEmpty &&
      !isMarkdownListLine(prevNonEmpty) &&
      !/^#{1,6}\s+/.test(prevNonEmpty) &&
      prevOut?.trim() !== ""
    ) {
      out.push("");
    }

    out.push(line);

    if (!trimmed || !isMarkdownListLine(line)) {
      continue;
    }

    const next = lines[i + 1];
    if (!next) continue;
    const nextTrimmed = next.trim();
    if (!nextTrimmed) continue;

    if (
      !isMarkdownListLine(next) &&
      !/^\s+/.test(next) &&
      !/^#{1,6}\s+/.test(next)
    ) {
      out.push("");
    }
  }

  return out.join("\n");
}

function normalizeLooseBulletLists(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim().endsWith(":")) {
      out.push(line);
      continue;
    }

    let cursor = i + 1;
    const spacerLines: string[] = [];
    while (cursor < lines.length && lines[cursor].trim() === "" && spacerLines.length < 1) {
      spacerLines.push(lines[cursor]);
      cursor += 1;
    }

    const candidates: string[] = [];
    while (cursor < lines.length && lines[cursor].trim() !== "") {
      if (!isLikelyLooseBulletLine(lines[cursor])) break;
      candidates.push(lines[cursor].trim());
      cursor += 1;
    }

    if (candidates.length >= 2) {
      out.push(line);
      out.push(...spacerLines);
      out.push(...candidates.map((candidate) => `- ${candidate}`));
      i = cursor - 1;
      continue;
    }

    out.push(line);
  }

  return out.join("\n");
}

function normalizeDisplayMarkdown(text: string): string {
  return normalizeExplicitMarkdownLists(normalizeLooseBulletLists(text));
}

function normalizeSectionTitle(value: string): string {
  return normalizeLabelText(value.replace(/^\d+[).]\s+/, "").trim());
}

function inferResearchMegaSpecies(data: ResearchTeamBlock): string | null {
  const haystacks = [data.subtitle, data.source, data.name];
  for (const haystack of haystacks) {
    if (!haystack) continue;
    const match = haystack.match(/\bMega\s+([A-Z][A-Za-z0-9' .-]*?)(?=\s+(?:Ladder\s+Team|Team)\b|\s+[—–-]|$|["”])/i);
    if (!match) continue;
    const species = match[1].trim().replace(/\s+/g, " ");
    if (species) return species;
  }
  return null;
}

/**
 * Parse agent markdown into Pokemon card blocks + regular text blocks.
 *
 * Heading patterns accepted (agents drift between these):
 *   ### Wolfe Glick — archetype           (canonical)
 *   ## Wolfe Glick — archetype            (h2 fallback)
 *   **Wolfe Glick — archetype**           (bold fallback)
 *   1) Wolfe Glick — archetype            (numbered list)
 *   1. Wolfe Glick — archetype            (numbered list dot)
 */
function parseContent(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];

  const parts = splitContentSections(content);

  for (const part of parts) {
    const partLines = part.split("\n");
    const firstLine = partLines[0] ?? "";

    // Try ### / ## / **Name** / 1) Name / 1. Name / Species @ Item
    let headerMatch: RegExpMatchArray | null =
      firstLine.match(/^###\s+(.+?)\s*$/) ||
      firstLine.match(/^##\s+(.+?)\s*$/) ||
      (isStandaloneBoldHeading(firstLine)
        ? firstLine.match(/^\*\*(.+?)\*\*\s*$/)
        : null) ||
      firstLine.match(/^\d+[).]\s+(.+?)\s*$/);

    // Pokepaste-style "Species @ Item" — synthesise a header match
    // that captures the species + stashes the item so the field
    // collector below picks it up without a second pass.
    let pokepasteItem: string | null = null;
    if (!headerMatch && isSpeciesAtItemHeader(firstLine)) {
      const atMatch = firstLine
        .trim()
        .replace(/^[-*+]\s+/, "")
        .match(/^\*{0,2}(.+?)\*{0,2}\s*@\s+(.+?)\s*$/);
      if (atMatch) {
        headerMatch = [firstLine, atMatch[1].trim()] as unknown as RegExpMatchArray;
        pokepasteItem = atMatch[2].trim();
      }
    }

    if (!headerMatch) {
      if (part.trim()) {
        blocks.push({ type: "text", text: part.trim() });
      }
      continue;
    }

    const name = normalizeSectionTitle(headerMatch[1].trim());

    // Skip section headings that aren't Pokemon names
    const nonPokemonHeadings = [
      "additional", "team summary", "team members", "summary",
      "key synergies", "lead combinations", "matchup", "notes",
      "overview", "strategy", "tips", "principles",
    ];
    if (nonPokemonHeadings.some((h) => name.toLowerCase().includes(h))) {
      blocks.push({ type: "text", text: part.trim() });
      continue;
    }

    const exactNonCardHeadings = new Set([
      "source",
      "url",
      "record",
      "team",
      "roster",
      "pokemon",
      "pokémon",
      "lineup",
      "core tech",
      "core",
      "tech",
      "strategy",
      "why it works",
      "imported set list",
      "imported set list from source",
    ]);
    if (exactNonCardHeadings.has(normalizeFieldKey(name))) {
      blocks.push({ type: "text", text: part.trim() });
      continue;
    }

    let lines = partLines.slice(1);

    const data: PokemonBlock = { name };
    if (pokepasteItem) {
      data.item = pokepasteItem;
    }

    // Absorb a `**Species @ Item**` (or plain `Species @ Item`) sub-
    // header that sits right below the primary section heading. The
    // agent occasionally emits `### 1) Conkeldurr` and a second
    // `**Conkeldurr @ Leftovers**` line below — without this merge,
    // each becomes its own block, producing a duplicate plain-text
    // h3 + a Pokemon card.
    if (!pokepasteItem) {
      const firstBodyIdx = lines.findIndex((l) => l.trim().length > 0);
      if (firstBodyIdx !== -1) {
        const candidate = lines[firstBodyIdx].trim();
        const atAbsorb =
          candidate.match(/^\*\*(.+?)\*\*\s*$/)?.[1]?.match(/^(.+?)\s*@\s+(.+?)\s*$/) ||
          candidate.match(/^(.+?)\s*@\s+(.+?)\s*$/);
        if (atAbsorb && /^[A-Z]/.test(atAbsorb[1].trim())) {
          const absorbedItem = stripMarkdownDecorations(atAbsorb[2]).trim();
          if (absorbedItem) {
            data.item = absorbedItem;
            // Drop the absorbed line (and any blank lines before it)
            // from the body — they'd otherwise be rendered as extra.
            lines = [
              ...lines.slice(0, firstBodyIdx),
              ...lines.slice(firstBodyIdx + 1),
            ];
          }
        }
      }
    }

    const research: ResearchTeamBlock = { name };
    const extraLines: string[] = [];
    const importedSetItems = extractImportedSetItems(part);
    if (Object.keys(importedSetItems).length > 0) {
      research.setItems = importedSetItems;
    }

    // "Player — Archetype" / "Player – Archetype" / "Player - Archetype" heading.
    // Split off the subtitle for the research card header.
    const nameMatch = name.match(/^(.+?)\s+[—–-]\s+(.+)$/);
    if (nameMatch) {
      research.name = normalizeSectionTitle(nameMatch[1]);
      research.subtitle = normalizeLabelText(nameMatch[2]);
    }

    // Field-line patterns (lenient — agents emit all three):
    //   - **Source**: val    (canonical bullet)
    //   - Source: val        (bullet without bold)
    //   **Source**: val      (bold without bullet)
    //   Source: val          (plain label)
    // Bare-label keywords — when a line is JUST one of these (no value),
    // we treat it as a section marker and collect continuation lines
    // below it. Flexible enough to handle every drift seen so far:
    //   Team            — plain word
    //   Team:           — plain word + colon
    //   **Team**        — bold word
    //   **Team:**       — bold with colon INSIDE the asterisks (GPT-5.4 habit)
    //   **Team**:       — bold with colon AFTER
    //   **Pokémon:**    — accented, colon inside (also GPT-5.4)
    const BARE_TEAM_KEYWORDS =
      /^\s*(?:[-*]\s*)?\*{0,2}\s*(Team|Roster|Pok[ée]mon|Lineup)(?:\s*\([^)]*\))?\s*:?\s*\*{0,2}\s*:?\s*$/i;
    const BARE_TECH_KEYWORDS =
      /^\s*(?:[-*]\s*)?\*{0,2}\s*(Core\s*tech|Core|Tech|Strategy|Why\s*it\s*works)(?:\s*\([^)]*\))?\s*:?\s*\*{0,2}\s*:?\s*$/i;
    const BARE_IMPORTED_SET_LIST_KEYWORDS =
      /^\s*(?:[-*]\s*)?\*{0,2}\s*Imported\s+set\s+list(?:\s+from\s+source)?\s*:?\s*\*{0,2}\s*:?\s*$/i;

    function matchField(line: string): { key: string; val: string } | null {
      // Try with non-empty value first (covers almost every bullet).
      const bullet = line.match(/^\s*[-*]\s*\*\*(.+?)\*\*:\s*(.+)/);
      if (bullet) return { key: normalizeFieldKey(bullet[1]), val: bullet[2].trim() };
      const bulletPlain = line.match(/^\s*[-*]\s*([A-Z][A-Za-z ]{1,30}):\s*(.+)/);
      if (bulletPlain) return { key: normalizeFieldKey(bulletPlain[1]), val: bulletPlain[2].trim() };
      // Two bold patterns — colon AFTER (**X**: val) or colon INSIDE
      // the asterisks (**X:** val). GPT-5.4 uses the inside form a lot.
      const boldColonAfter = line.match(/^\*\*(.+?)\*\*:\s*(.+)/);
      if (boldColonAfter) return { key: normalizeFieldKey(boldColonAfter[1]), val: boldColonAfter[2].trim() };
      const boldColonInside = line.match(/^\*\*(.+?):\s*\*\*\s*(.+)/);
      if (boldColonInside) return { key: normalizeFieldKey(boldColonInside[1]), val: boldColonInside[2].trim() };
      // Fall through to empty-value patterns — "Team:" / "Roster:"
      // with the list on the following lines. Use .* so we accept
      // empty values AND trailing whitespace.
      const plain = line.match(/^([A-Z][A-Za-z ]{1,30}):\s*(.*)$/);
      if (plain) return { key: normalizeFieldKey(plain[1]), val: plain[2].trim() };
      // Bare section markers (no colon, no value on the line). These
      // fire AFTER the colon-bearing patterns above so we don't
      // accidentally eat a "**Team:** val" line.
      if (BARE_TEAM_KEYWORDS.test(line)) return { key: "team", val: "" };
      if (BARE_TECH_KEYWORDS.test(line)) return { key: "core tech", val: "" };
      if (BARE_IMPORTED_SET_LIST_KEYWORDS.test(line)) return { key: "imported set list", val: "" };
      return null;
    }

    // Research-field keys we recognise as the start of a field block.
    // When the value is empty (e.g. "Team:" followed by species on
    // subsequent lines), switch into "collect continuation lines"
    // mode — used specifically for team rosters.
    const RESEARCH_FIELD_KEYS = new Set([
      "source", "url", "source url", "team", "roster", "pokemon",
      "core tech", "core", "tech", "record", "placement",
    ]);

    type Mode = "none" | "team" | "coreTech" | "moves" | "skipImportedSetList";
    let mode: Mode = "none";
    const teamLines: string[] = [];
    const coreTechLines: string[] = [];
    const moveLines: string[] = [];

    for (const line of lines) {
      const field = matchField(line);

      if (mode === "skipImportedSetList") {
        if (!line.trim()) {
          continue;
        }
        if (!field || field.key === "imported set list") {
          continue;
        }
        mode = "none";
      }

      if (field) {
        const { key, val } = field;

        // Pokemon build fields (### Pokemon-name template)
        if (key === "role") { data.role = val; mode = "none"; }
        else if (key === "ability") { data.ability = val; mode = "none"; }
        else if (key === "item") { data.item = val; mode = "none"; }
        else if (key === "moves" || key === "attacks") {
          if (val) {
            data.moves = val;
            mode = "none";
          } else {
            // "Moves:" alone, then bullet list below — switch modes.
            mode = "moves";
          }
        }
        else if (key === "nature") { data.nature = val; mode = "none"; }
        else if (key === "points" || key === "evs") { data.points = val; mode = "none"; }
        else if (key === "spread reasoning" || key === "reasoning" || key === "ev reasoning") { data.spreadReasoning = val; mode = "none"; }
        // Research-report fields (### Player — Archetype template)
        else if (key === "source") { research.source = val; mode = "none"; }
        else if (key === "source type") { research.sourceType = val; mode = "none"; }
        else if (key === "url" || key === "source url" || key === "link") {
          research.url = val; mode = "none";
        }
        else if (key === "record" || key === "placement") {
          if (!research.subtitle) research.subtitle = normalizeLabelText(val);
          mode = "none";
        }
        else if (
          key === "team" || key === "roster" || key === "lineup" ||
          key === "pokemon" || key === "pokémon" || key === "pokemons"
        ) {
          const split = val.split(/\s*\/\s*|\s*,\s*/).map((s) => s.trim()).filter(Boolean);
          if (split.length > 0) {
            research.team = split;
            mode = "none";
          } else {
            mode = "team";
          }
        }
        else if (
          key === "core tech" || key === "core" || key === "tech" ||
          key === "strategy" || key === "why it works"
        ) {
          if (val) {
            research.coreTech = val;
            mode = "none";
          } else {
            mode = "coreTech";
          }
        }
        else if (key === "imported set list") {
          mode = "skipImportedSetList";
        }
        else {
          if (mode === "team") teamLines.push(line.trim());
          else if (mode === "coreTech") coreTechLines.push(line);
          else if (mode === "moves") moveLines.push(line.trim());
          else extraLines.push(line);
        }
      } else if (line.trim()) {
        if (!research.url && /^https?:\/\//i.test(line.trim())) {
          research.url = line.trim();
        } else if (mode === "team") {
          // Each continuation line is a species (possibly with a
          // bullet prefix or leading digit).
          const sp = line
            .trim()
            .replace(/^[-*\d.)]+\s*/, "")
            .trim();
          if (sp) teamLines.push(sp);
        } else if (mode === "moves") {
          const mv = line
            .trim()
            .replace(/^[-*\d.)]+\s*/, "")
            .replace(/\*\*/g, "")
            .trim();
          if (mv) moveLines.push(mv);
        } else if (mode === "coreTech") {
          coreTechLines.push(line);
        } else {
          extraLines.push(line);
        }
      } else {
        // blank line ends a continuation-collection block.
        mode = "none";
      }
    }

    if (teamLines.length > 0 && !research.team) {
      research.team = teamLines.filter(Boolean);
    }
    if (coreTechLines.length > 0 && !research.coreTech) {
      research.coreTech = coreTechLines.join("\n").trim();
    }
    if (moveLines.length > 0 && !data.moves) {
      data.moves = moveLines.filter(Boolean).join(" / ");
    }

    const extra = extraLines.join("\n").trim();

    if (data.ability || data.moves) {
      // Pokemon-build card.
      blocks.push({ type: "pokemon", data });
      if (extra) {
        blocks.push({ type: "text", text: extra });
      }
    } else if (
      // Research-report card — require at least ONE strong signal so
      // we don't accidentally turn a regular numbered list into a card.
      (research.team && research.team.length >= 3) ||
      (research.source && research.url) ||
      (research.url && research.coreTech) ||
      (research.subtitle && (research.source || research.team))
    ) {
      research.extra = extra || undefined;
      blocks.push({ type: "research", data: research });
    } else {
      blocks.push({ type: "text", text: part.trim() });
    }
  }

  return blocks;
}

function formatPokepaste(data: PokemonBlock): string {
  const lines: string[] = [];
  const itemPart = data.item ? ` @ ${data.item}` : "";
  lines.push(`${data.name}${itemPart}`);
  if (data.ability) lines.push(`Ability: ${data.ability}`);
  if (data.nature) lines.push(`${data.nature} Nature`);
  if (data.points) lines.push(`EVs: ${data.points}`);
  if (data.moves) {
    for (const move of data.moves.split(/\s*\/\s*/)) {
      lines.push(`- ${move.trim()}`);
    }
  }
  return lines.join("\n");
}

function PokemonCard({ data, actions }: { data: PokemonBlock; actions?: CardActions }) {
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);
  const renderedPokemon = resolveRenderedPokemon(data.name, data.item);

  // Validate the agent's claim — catches hallucinations like
  // "Mega Scovillain with Rough Skin + Dragon Claw" (Garchomp build
  // misfiled under the Scovillain header).
  const cleanAbilityName = stripMarkdownDecorations(data.ability || "")
    .split(/\s+[—–]\s+|\s+-\s+|\s+\(|\s*:\s+/)[0]
    .trim();
  const moveList = useMemo(
    () =>
      data.moves
        ? data.moves
            .split(/\s*\/\s*/)
            .map((m) =>
              stripMarkdownDecorations(m)
                .split(/\s+[—–]\s+|\s+-\s+|\s+\(/)[0]
                .trim(),
            )
            .filter(Boolean)
        : [],
    [data.moves],
  );
  const validation = useSetValidation(
    renderedPokemon.spriteSpecies,
    cleanAbilityName || undefined,
    moveList,
    "champions-reg-m-a",
  );

  const handleCopy = () => {
    const paste = formatPokepaste(data);
    navigator.clipboard.writeText(paste);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    actions?.onCopy?.(data);
  };

  // Extract just the first word/short identifier from fields that may have inline explanations
  // e.g., "Stamina — boosts defense when hit" → "Stamina"
  // Only split on spaced em/en-dashes + " - " / " : " / " (" so we
  // don't chop up legitimate hyphenated names ("Will-O-Wisp",
  // "Mental Herb", "Mega-Y").
  const cleanField = (val?: string): { short: string; long?: string } => {
    if (!val) return { short: "" };
    const stripped = stripMarkdownDecorations(val);
    const sepMatch = stripped.match(/^(.+?)(?:\s+[—–]\s+|\s+-\s+|\s+:\s+|\s+\(\s*)(.+)/);
    if (sepMatch) {
      return {
        short: sepMatch[1].trim(),
        long: sepMatch[2].replace(/\)$/, "").trim(),
      };
    }
    return { short: stripped.trim() };
  };

  const abilityField = cleanField(data.ability);
  const itemField = cleanField(data.item);
  const natureField = cleanField(data.nature);

  return (
    <div
      className={`w-full max-w-full overflow-hidden rounded-xl border bg-card/80 backdrop-blur-sm p-3 ${renderedPokemon.isMega ? "border-purple-500/30" : "border-border"} hover:border-primary/30 transition-colors`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex gap-3 items-start min-w-0">
        {/* Sprite */}
        <div className="shrink-0 flex flex-col items-center gap-1">
          <PokemonSprite species={renderedPokemon.spriteSpecies} size={56} />
          {renderedPokemon.isMega && (
            <Badge variant="info" className="text-[9px] px-1 py-0">
              MEGA
            </Badge>
          )}
        </div>

        {/* Details */}
        <div className="min-w-0 flex-1 space-y-1.5 overflow-hidden">
          {/* Name + Role */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-foreground break-words">
              {renderedPokemon.displayName}
            </span>
            {data.role && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                {data.role.split(/[—–\-]/)[0].trim()}
              </Badge>
            )}
          </div>

          {/* Ability */}
          {data.ability && (
            <div className="text-xs break-words">
              <span className="text-foreground/60">Ability: </span>
              <span className="text-foreground font-medium">{abilityField.short}</span>
              {abilityField.long && (
                <span className="text-muted-foreground"> — {abilityField.long}</span>
              )}
            </div>
          )}

          {/* Item */}
          {data.item && (
            <div className="text-xs break-words">
              <span className="text-foreground/60">Item: </span>
              <span className="text-foreground font-medium">{itemField.short}</span>
              {itemField.long && (
                <span className="text-muted-foreground"> — {itemField.long}</span>
              )}
            </div>
          )}

          {/* Nature */}
          {data.nature && (
            <div className="text-xs break-words">
              <span className="text-foreground/60">Nature: </span>
              <span className="text-foreground font-medium">{natureField.short}</span>
              {natureField.long && (
                <span className="text-muted-foreground"> — {natureField.long}</span>
              )}
            </div>
          )}

          {/* Moves */}
          {data.moves && (
            <div className="flex flex-wrap gap-1 mt-1">
              {data.moves.split(/\s*\/\s*/).map((move, i) => {
                // Only strip spaced em/en-dashes + " - " used for
                // inline annotations. Keep bare hyphens so move
                // names like "Will-O-Wisp" or "U-turn" stay intact.
                const cleanMove = stripMarkdownDecorations(move)
                  .split(/\s+[—–]\s+|\s+-\s+|\s+\(/)[0]
                  .trim();
                return (
                  <Badge
                    key={`${cleanMove}-${i}`}
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 font-normal"
                  >
                    {cleanMove}
                  </Badge>
                );
              })}
            </div>
          )}

          {/* Points/EVs */}
          {data.points && (
            <div className="text-[10px] text-muted-foreground mt-1 font-mono break-words">
              {data.points}
            </div>
          )}

          {/* Spread Reasoning */}
          {data.spreadReasoning && (
            <div className="text-[10px] text-muted-foreground mt-1 italic leading-relaxed border-l-2 border-primary/20 pl-2 break-words">
              {data.spreadReasoning}
            </div>
          )}
        </div>
      </div>

      {/* Validation warnings — fires when the agent hallucinates an
          ability the species doesn't have, a made-up move, or a
          wrong species. Visible in red so the user sees it before
          adding to team. */}
      {validation && validation.warnings.length > 0 && (
        <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1.5 flex flex-col gap-0.5">
          {validation.warnings.map((w, i) => (
            <div
              key={i}
              className="text-[11px] text-destructive-foreground/90 leading-snug"
            >
              <span className="font-semibold text-destructive">⚠ </span>
              {w.message}
            </div>
          ))}
        </div>
      )}

      {/* Action buttons — visible on hover or always on mobile */}
      {actions && (showActions || true) && (
        <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-border/50">
          {actions.onAddToTeam && (
            <Button
              size="xs"
              variant="default"
              onClick={() => actions.onAddToTeam!(data)}
            >
              + Add to Team
            </Button>
          )}
          <Button
            size="xs"
            variant="outline"
            onClick={handleCopy}
          >
            {copied ? "Copied!" : "Copy"}
          </Button>
          {actions.onResuggest && (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => actions.onResuggest!(data.name)}
            >
              Resuggest
            </Button>
          )}
          {actions.onChangeField && (
            <>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => actions.onChangeField!(data.name, "moves", `Suggest different moves for ${data.name}`)}
              >
                Change Moves
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => actions.onChangeField!(data.name, "spread", `Suggest a better EV spread for ${data.name} with specific benchmarks`)}
              >
                Change Spread
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Shared prose styling for agent responses.
 *
 * Scaled vertical rhythm so research roundups with multiple H3-
 * delimited sections read as distinct blocks rather than a dense
 * paragraph-blob. The key knobs: prose-h3:mt-6 (big gap before each
 * new section), prose-p:my-2.5, prose-li:my-1.5 (room to breathe on
 * structured lists), and a left-rule feel on H3 via border-l to
 * visually break research sections apart.
 */
const proseClasses =
  "prose prose-sm prose-invert max-w-none " +
  "prose-p:my-2.5 prose-p:leading-relaxed " +
  "prose-ul:my-2.5 prose-ol:my-2.5 prose-ul:list-disc prose-ol:list-decimal prose-ul:pl-5 prose-ol:pl-5 prose-li:my-1.5 prose-li:leading-relaxed " +
  "prose-li:marker:text-primary/70 " +
  "prose-headings:font-bold " +
  "prose-h1:text-lg prose-h1:mt-5 prose-h1:mb-3 " +
  "prose-h2:text-base prose-h2:text-primary prose-h2:mt-5 prose-h2:mb-2 prose-h2:pb-1 prose-h2:border-b prose-h2:border-border/60 " +
  "prose-h3:text-sm prose-h3:text-primary prose-h3:mt-5 prose-h3:mb-2 prose-h3:pl-2 prose-h3:border-l-2 prose-h3:border-primary/50 " +
  "prose-h4:text-sm prose-h4:font-semibold prose-h4:mt-3 prose-h4:mb-1 " +
  "prose-strong:text-foreground prose-strong:font-semibold " +
  "prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:rounded " +
  "prose-blockquote:border-primary/40 prose-blockquote:text-muted-foreground prose-blockquote:italic prose-blockquote:my-3 " +
  "prose-hr:my-5 prose-hr:border-border " +
  "prose-table:my-3 prose-table:text-xs prose-table:border-collapse " +
  "prose-th:border prose-th:border-border prose-th:bg-muted/40 prose-th:px-2 prose-th:py-1 " +
  "prose-td:border prose-td:border-border prose-td:px-2 prose-td:py-1 " +
  "prose-a:text-primary prose-a:underline prose-a:underline-offset-2 prose-a:break-all";

const compactProseClasses =
  "prose prose-sm prose-invert max-w-none " +
  "prose-p:my-1.5 prose-p:leading-relaxed prose-headings:my-1.5 " +
  "prose-ul:my-1.5 prose-ol:my-1.5 prose-ul:list-disc prose-ol:list-decimal prose-ul:pl-4 prose-ol:pl-4 " +
  "prose-li:my-0.5 prose-li:leading-relaxed prose-li:marker:text-primary/70 " +
  "prose-strong:text-foreground prose-strong:font-semibold " +
  "prose-a:text-primary prose-a:underline prose-a:underline-offset-2 prose-a:break-all";

const GFM_PLUGINS = [remarkGfm];

/**
 * Visual card for a research-report team section. Replaces the
 * paragraph-blob the markdown renderer used to produce for a
 * "### Player — Archetype" block with Source/URL/Team/Core tech
 * bullets. Narrow-chat-friendly: species sprites in a row instead
 * of a comma-joined string, source + URL as chips, coreTech in an
 * accent-bordered callout.
 */
const SOURCE_BADGE_VARIANT: Record<
  string,
  "default" | "secondary" | "info" | "success" | "warning"
> = {
  creator: "success",
  limitless: "info",
  pikalytics: "info",
  smogon: "secondary",
  reddit: "warning",
  user: "secondary",
};

function getResearchSourceKey(data: ResearchTeamBlock): string | null {
  const source = `${data.sourceType ?? ""} ${data.source ?? ""}`.toLowerCase();
  const url = (data.url ?? "").toLowerCase();

  if (
    /\bcreator\b/.test(source) ||
    /\bverified\s+team\s+reveal\b/.test(source) ||
    /\bcreator\s+reveal\b/.test(source) ||
    (/youtube\.com|youtu\.be/.test(url) && /\breveal\b|\bverified\b/.test(source))
  ) {
    return "creator";
  }
  if (/\blimitless\b/.test(source) || /limitlesstcg\.com/.test(url)) return "limitless";
  if (/\bpikalytics\b/.test(source) || /pikalytics\.com/.test(url)) return "pikalytics";
  if (/\bsmogon\b/.test(source) || /smogon\.com/.test(url)) return "smogon";
  if (/\breddit\b/.test(source) || /reddit\.com/.test(url)) return "reddit";
  if (/\buser\b/.test(source)) return "user";
  return null;
}

function ResearchTeamCard({
  data,
  actions,
}: {
  data: ResearchTeamBlock;
  actions?: CardActions;
}) {
  const sourceKey = getResearchSourceKey(data);
  const sourceVariant = sourceKey ? SOURCE_BADGE_VARIANT[sourceKey] : "secondary";
  const canUse = Boolean(actions?.onUseResearchTeam && data.team && data.team.length > 0);
  const canVariant = Boolean(actions?.onMakeVariant && data.team && data.team.length > 0);

  return (
    <div className="rounded-xl border border-primary/30 bg-card/80 backdrop-blur-sm p-3 flex flex-col gap-2">
      {/* Header */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-sm font-bold text-foreground">{data.name}</span>
        {data.subtitle && (
          <span className="text-xs text-muted-foreground">
            — {data.subtitle}
          </span>
        )}
        {sourceKey && (
          <Badge
            variant={sourceVariant}
            className="ml-auto text-[9px] uppercase tracking-wider"
          >
            {sourceKey}
          </Badge>
        )}
      </div>

      {/* Source details */}
      {(data.source || data.url) && (
        <div className="flex flex-col gap-0.5 text-[11px]">
          {data.source && !sourceKey && (
            <div>
              <span className="text-muted-foreground">Source: </span>
              <span className="text-foreground">{data.source}</span>
            </div>
          )}
          {data.url && (
            <a
              href={data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline break-all"
            >
              {data.url.replace(/^https?:\/\/(www\.)?/, "")}
            </a>
          )}
        </div>
      )}

      {/* Team — species as sprite row */}
      {data.team && data.team.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1 border-t border-border/40">
          {(() => {
            const inferredMegaSpecies = inferResearchMegaSpecies(data);
            const inferredMegaKey = inferredMegaSpecies
              ? getSpeciesLookupKey(inferredMegaSpecies)
              : null;

            return data.team.map((sp, i) => {
              const lookupKey = getSpeciesLookupKey(sp);
              const inferredMegaItem =
                inferredMegaKey && lookupKey === inferredMegaKey ? `${inferredMegaSpecies}ite` : undefined;
              const renderedPokemon = resolveRenderedPokemon(
                sp,
                data.setItems?.[lookupKey] ?? inferredMegaItem,
              );
              return (
                <div
                  key={`${sp}-${i}`}
                  className="flex items-center gap-1 rounded bg-muted/30 px-1.5 py-0.5"
                >
                  <PokemonSprite species={renderedPokemon.spriteSpecies} size={20} />
                  <span className="text-[11px] text-foreground">
                    {renderedPokemon.displayName}
                  </span>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* Core tech — accent callout */}
      {data.coreTech && (
        <div className="rounded-md border-l-2 border-primary/50 bg-primary/5 px-2 py-1.5">
          <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">
            Core tech
          </span>
          <div className={`mt-0.5 text-xs text-foreground/90 ${compactProseClasses}`}>
            <ReactMarkdown remarkPlugins={GFM_PLUGINS}>
              {normalizeDisplayMarkdown(data.coreTech)}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Any extra markdown below the structured fields */}
      {data.extra && (
        <div className="text-xs text-muted-foreground">
          <ReactMarkdown remarkPlugins={GFM_PLUGINS}>
            {normalizeDisplayMarkdown(data.extra)}
          </ReactMarkdown>
        </div>
      )}

      {/* Action buttons — let the user act on this team right from the card. */}
      {(canUse || canVariant) && (
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/50">
          {canUse && (
            <Button
              size="xs"
              variant="default"
              onClick={() => actions!.onUseResearchTeam!(data)}
            >
              + Use this team
            </Button>
          )}
          {canVariant && (
            <Button
              size="xs"
              variant="outline"
              onClick={() => actions!.onMakeVariant!(data)}
            >
              Make my version
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  question,
  onAnswer,
}: {
  question: UserQuestionBlock;
  onAnswer?: (value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 flex flex-col gap-2">
      <div className="text-xs font-semibold text-primary uppercase tracking-wider">
        Question
      </div>
      <p className="text-sm text-foreground">{question.question}</p>
      <div className="flex flex-wrap gap-1.5">
        {question.options.map((opt, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onAnswer?.(opt.value)}
            disabled={!onAnswer}
            className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground hover:border-primary/60 hover:bg-primary/10 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Split a text block on `<<__USER_QUESTION_n__>>` placeholders so the
 * renderer can interleave QuestionCard components exactly where the
 * agent emitted them.
 */
function splitOnQuestionPlaceholders(
  text: string,
): Array<{ type: "text"; text: string } | { type: "question"; index: number }> {
  const out: Array<{ type: "text"; text: string } | { type: "question"; index: number }> = [];
  const regex = /<<__USER_QUESTION_(\d+)__>>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const chunk = text.slice(lastIndex, match.index).trim();
      if (chunk) out.push({ type: "text", text: chunk });
    }
    out.push({ type: "question", index: parseInt(match[1], 10) });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    const chunk = text.slice(lastIndex).trim();
    if (chunk) out.push({ type: "text", text: chunk });
  }
  return out;
}

export function PokemonCardRenderer({
  content,
  actions,
}: {
  content: string;
  actions?: CardActions;
}) {
  if (!content) return null;

  // Pull out any ask-user-question blocks first so they interleave with
  // Pokemon cards in the right spot.
  const { stripped, questions } = extractUserQuestions(content);

  const blocks = parseContent(stripped);
  const pokemonBlocks = blocks.filter(
    (b): b is { type: "pokemon"; data: PokemonBlock } => b.type === "pokemon",
  );
  const researchBlocks = blocks.filter(
    (b): b is { type: "research"; data: ResearchTeamBlock } => b.type === "research",
  );

  const renderTextWithQuestions = (text: string, keyPrefix: string) => {
    const normalizedText = normalizeDisplayMarkdown(text);
    if (questions.length === 0 || !text.includes("<<__USER_QUESTION_")) {
      return (
        <div key={keyPrefix} className={proseClasses}>
          <ReactMarkdown remarkPlugins={GFM_PLUGINS}>{normalizedText}</ReactMarkdown>
        </div>
      );
    }
    const pieces = splitOnQuestionPlaceholders(normalizedText);
    return (
      <div key={keyPrefix} className="flex flex-col gap-2">
        {pieces.map((piece, i) => {
          if (piece.type === "question") {
            const q = questions[piece.index];
            if (!q) return null;
            return (
              <QuestionCard
                key={`${keyPrefix}-q-${i}`}
                question={q}
                onAnswer={actions?.onAnswerQuestion}
              />
            );
          }
          return (
            <div key={`${keyPrefix}-t-${i}`} className={proseClasses}>
              <ReactMarkdown remarkPlugins={GFM_PLUGINS}>{piece.text}</ReactMarkdown>
            </div>
          );
        })}
      </div>
    );
  };

  // If there are no Pokemon AND no research cards, render the whole
  // thing as plain markdown (+ any user-question blocks).
  if (pokemonBlocks.length === 0 && researchBlocks.length === 0) {
    return renderTextWithQuestions(stripped, "root");
  }

  return (
    <div className="space-y-3">
      {/* Add All button if multiple Pokemon */}
      {actions?.onAddAllToTeam && pokemonBlocks.length > 1 && (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => actions.onAddAllToTeam!(pokemonBlocks.map((b) => b.data))}
          >
            + Add All {pokemonBlocks.length} to Team
          </Button>
        </div>
      )}

      {/* Bulk "Use all" action when multiple research cards — first
          team goes to the current builder, the rest save as drafts. */}
      {actions?.onUseAllResearchTeams && researchBlocks.length > 1 && (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() =>
              actions.onUseAllResearchTeams!(researchBlocks.map((b) => b.data))
            }
          >
            + Use first, save {researchBlocks.length - 1} as drafts
          </Button>
        </div>
      )}

      {blocks.map((block, i) => {
        if (block.type === "pokemon") {
          return <PokemonCard key={i} data={block.data} actions={actions} />;
        }
        if (block.type === "research") {
          return (
            <ResearchTeamCard
              key={`research-${i}`}
              data={block.data}
              actions={actions}
            />
          );
        }
        return renderTextWithQuestions(block.text, `block-${i}`);
      })}
    </div>
  );
}
