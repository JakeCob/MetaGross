/**
 * Response-verifier node.
 *
 * Runs AFTER the agent produces a final (tool-call-free) response,
 * BEFORE the response is streamed to the UI. Scans the response for
 * Pokemon names mentioned in build-card format and cross-checks each
 * against the Champions roster + the ability/move validator.
 *
 * If any violations are found, it appends a system-style correction
 * message to the thread and routes control back to the agent for
 * exactly ONE revision pass. If the agent still hallucinates on the
 * retry, the response is allowed through — the render-time ⚠ warnings
 * in PokemonCardRenderer will still surface the issue to the user.
 *
 * This is the "stop hallucinations BEFORE they reach the user" layer.
 * Render-time validation is the last line; this is one line earlier.
 */
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { validateSet } from "@/lib/pokemon/validate-set";
import type { AgentStateType, AgentStateUpdate } from "../state";

const MAX_RETRIES = 1;

interface ExtractedMon {
  species: string;
  ability?: string;
  moves?: string[];
}

/**
 * Pull Pokemon blocks out of an agent response in the format
 * PokemonCardRenderer expects. Matches ### Name / **Name** headings,
 * then reads "- **Ability**: ..." / "- **Moves**: a / b / c / d"
 * lines until the next heading or blank line pair.
 */
function extractMonsFromResponse(content: string): ExtractedMon[] {
  const mons: ExtractedMon[] = [];
  const NON_POKEMON_HEADINGS = [
    "additional", "team summary", "team members", "summary",
    "key synergies", "lead combinations", "matchup", "notes",
    "overview", "strategy", "tips", "principles", "game plan",
    "team composition", "core tech", "next steps", "results",
    "deliverables",
  ];

  // Split on ### headers OR **Bold Name** at start of line
  const parts = content.split(
    /(?=^### )|(?=^\*\*[A-Z][a-z]+(?:[- ][A-Za-z]+)*(?:\s*\(Mega\))?\*\*\s*$)/m,
  );
  for (const part of parts) {
    const headerMatch =
      part.match(/^### (.+?)$/m) ||
      part.match(/^\*\*([A-Z][a-z]+(?:[- ][A-Za-z]+)*(?:\s*\(Mega\))?)\*\*/m);
    if (!headerMatch) continue;
    const rawName = headerMatch[1].trim();
    // "Scovillain — Burn Wall" → "Scovillain"
    const name = rawName.split(/\s+[—–-]\s+/)[0].trim();
    if (NON_POKEMON_HEADINGS.some((h) => name.toLowerCase().includes(h))) {
      continue;
    }

    const mon: ExtractedMon = { species: name };
    for (const line of part.split("\n")) {
      const m = line.match(/^\s*[-*]\s*\*\*(.+?)\*\*:\s*(.+)/);
      if (!m) continue;
      const key = m[1].toLowerCase().trim();
      const val = m[2].trim();
      if (key === "ability") {
        // Strip inline annotations ("— note" / ": note" / " ( note)")
        // but keep bare hyphens so e.g. "Own Tempo" stays intact.
        mon.ability = val
          .split(/\s+[—–]\s+|\s+-\s+|\s*\(|\s*:\s+/)[0]
          .trim();
      } else if (key === "moves") {
        mon.moves = val
          .split(/\s*\/\s*/)
          .map((s) =>
            s.split(/\s+[—–]\s+|\s+-\s+|\s*\(/)[0].trim(),
          )
          .filter(Boolean);
      }
    }
    // Only flag as a real Pokemon block when we have at least ability
    // OR moves — prevents false-positive bold-heading matches.
    if (mon.ability || (mon.moves && mon.moves.length > 0)) {
      mons.push(mon);
    }
  }

  return mons;
}

export async function verifyResponseNode(
  state: AgentStateType,
): Promise<Partial<AgentStateUpdate>> {
  const lastMsg = state.messages[state.messages.length - 1];
  if (!lastMsg || lastMsg._getType() !== "ai") return {};

  const content =
    typeof (lastMsg as AIMessage).content === "string"
      ? ((lastMsg as AIMessage).content as string)
      : "";
  if (!content.trim()) return {};

  const mons = extractMonsFromResponse(content);
  if (mons.length === 0) return {};

  // Only enforce Champions roster when context + persona is Champions-aligned.
  // If we ever add more formats, add a state flag here. For now MetaGross
  // is Champions-only.
  const format = "champions-reg-m-a";
  const violations: string[] = [];
  for (const mon of mons) {
    const result = validateSet({
      species: mon.species,
      ability: mon.ability,
      moves: mon.moves,
      format,
    });
    for (const w of result.warnings) {
      // Drop the soft "verify via Bulbapedia" warning — that's fine to
      // leave to the render-time layer. We only short-circuit on hard
      // violations: confirmed-not-in-format, ability-invalid, or a
      // species the dex doesn't know.
      if (w.kind === "not-in-format" && !/CONFIRMED not in/.test(w.message)) continue;
      violations.push(`• ${mon.species}: ${w.message}`);
    }
  }

  if (violations.length === 0) return {};

  const retries = state.verificationRetries ?? 0;
  if (retries >= MAX_RETRIES) {
    // Let it through — render-time warnings will surface the issue.
    return {};
  }

  const correction = new HumanMessage(
    [
      "[VERIFIER] Your previous response has Pokemon-build issues I need you to fix before the user sees it:",
      "",
      ...violations,
      "",
      "Rewrite the response using only species valid in Champions Reg M-A, with abilities and moves that actually exist. Do NOT re-apologise or explain the verifier — just produce the corrected response as if this were your first attempt. If a violating species was central to the build, swap it for a legal Champions alternative (e.g. Landorus-Therian → Garchomp or Rillaboom → Sinistcha).",
    ].join("\n"),
  );

  return {
    messages: [correction],
    verificationRetries: retries + 1,
  };
}
