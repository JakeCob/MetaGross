/**
 * Small helpers shared by the team-debate persona nodes: a single text-in /
 * text-out model call, and a tolerant JSON-team parser that legalises picks.
 */
import { createModel, detectProvider } from "@/lib/ai/graph/model";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import {
  isChampionsPokemon,
  isConfirmedNotInChampions,
} from "@/lib/data/champions";
import { describeMember } from "@/lib/team-analysis/team-context";
import type { DraftMember } from "./state";

/** Render the current draft as a numbered, mega-aware list for prompts. */
export function renderDraft(draft: DraftMember[], format: string): string {
  if (draft.length === 0) return "(empty)";
  return draft
    .map((m, i) => {
      const base = describeMember(m, format);
      const role = m.role ? ` — role: ${m.role}` : "";
      return `${i + 1}. ${base}${role}`;
    })
    .join("\n");
}

/** One persona turn: system + user prompt → plain text. */
export async function runModel(system: string, user: string): Promise<string> {
  const model = createModel(detectProvider());
  const res = await model.invoke([
    new SystemMessage(system),
    new HumanMessage(user),
  ]);
  const c = res.content;
  if (typeof c === "string") return c.trim();
  if (Array.isArray(c)) {
    return c
      .filter(
        (b): b is { type: "text"; text: string } =>
          typeof b === "object" &&
          b !== null &&
          "type" in b &&
          (b as { type?: string }).type === "text" &&
          "text" in b,
      )
      .map((b) => b.text)
      .join("")
      .trim();
  }
  return "";
}

/** Pull the first JSON array out of a possibly fenced / prose-wrapped reply. */
export function extractJsonArray(text: string): string {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  return start >= 0 && end > start ? t.slice(start, end + 1) : t;
}

/**
 * Parse an LLM team reply into legal, de-duplicated DraftMembers (max 6).
 * Drops hallucinated / out-of-format species so downstream audit only ever
 * sees plausible picks. Returns null when nothing parseable is found.
 */
export function parseDraftJson(
  text: string,
  format: string,
): DraftMember[] | null {
  let raw: unknown;
  try {
    raw = JSON.parse(extractJsonArray(text));
  } catch {
    return null;
  }
  if (!Array.isArray(raw)) return null;

  const seen = new Set<string>();
  const out: DraftMember[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const species = typeof o.species === "string" ? o.species.trim() : "";
    if (!species) continue;
    const key = species.toLowerCase();
    if (seen.has(key)) continue;
    if (!isChampionsPokemon(species, format)) continue;
    if (isConfirmedNotInChampions(species, format)) continue;
    seen.add(key);

    const moves = Array.isArray(o.moves)
      ? o.moves
          .filter((m): m is string => typeof m === "string")
          .map((m) => m.trim())
          .filter(Boolean)
          .slice(0, 4)
      : undefined;

    out.push({
      species,
      role: typeof o.role === "string" ? o.role.trim() : undefined,
      item: typeof o.item === "string" ? o.item.trim() : undefined,
      ability: typeof o.ability === "string" ? o.ability.trim() : undefined,
      moves,
      note: typeof o.note === "string" ? o.note.trim() : undefined,
    });
    if (out.length >= 6) break;
  }
  return out.length ? out : null;
}
