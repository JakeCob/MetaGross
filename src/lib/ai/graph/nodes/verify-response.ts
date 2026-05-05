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
import {
  getLatestUserMessageText,
  hasTeamContextForPatch,
  isAssistantConfirmationLoop,
  isPatchClarificationQuestion,
  isDirectTeamEditRequest,
} from "../edit-intent";
import { extractSpeciesMentions } from "../species-mentions";

const MAX_RETRIES = 1;

/** 510/252 EV → Champions stat-point (÷8, capped 32). */
function evToChampionsPoints(raw: number): number {
  return Math.min(32, Math.round(raw / 8));
}

/**
 * Deterministic rewriter — scans the agent's response for 510/252-
 * style EV strings and converts them to Champions 66/32 format in
 * place. Runs even when the rest of the response validates cleanly,
 * because we've seen the agent emit correct abilities + wrong EV
 * format in the same response.
 *
 * Looks for common spread shapes:
 *   - "EVs: 252 HP / 252 Atk / 4 SpD"
 *   - "EVs: 244 HP / 4 Def / 252 SpA / 4 SpD / 4 Spe"
 *   - "**Points**: 252 HP / ..."
 *   - "- **Points**: 252 HP / ..."
 *
 * Leaves already-Champions-format lines alone (detected by: total
 * ≤66 AND no individual stat >32).
 */
function rewriteEvsToChampionsFormat(content: string): string {
  const STAT_NAMES = ["HP", "Atk", "Def", "SpA", "SpD", "Spe"] as const;
  type Stat = (typeof STAT_NAMES)[number];

  // Match EV-ish lines: a label (EVs / Points / Spread) then numbers
  // with stat names. Both "252 HP" and "HP 252" accepted.
  const labelRegex =
    /^(\s*[-*]?\s*\*{0,2}\s*(?:EVs?|Points?|Spread)\s*\*{0,2}\s*:\s*)(.+)$/gim;

  return content.replace(labelRegex, (full, prefix: string, body: string) => {
    // Parse all "num STAT" / "STAT num" pairs.
    const pairs: Array<{ stat: Stat; value: number }> = [];
    const statPattern =
      /(\d{1,3})\s*(HP|Atk|Def|SpA|SpD|Spe)|(HP|Atk|Def|SpA|SpD|Spe)\s*(\d{1,3})/gi;
    let match: RegExpExecArray | null;
    while ((match = statPattern.exec(body)) !== null) {
      const value = Number(match[1] ?? match[4]);
      const statRaw = (match[2] ?? match[3]) as string;
      // Normalise case to the canonical set name.
      const stat = STAT_NAMES.find(
        (s) => s.toLowerCase() === statRaw.toLowerCase(),
      );
      if (!stat || Number.isNaN(value)) continue;
      pairs.push({ stat, value });
    }

    if (pairs.length === 0) return full;

    // Already Champions-format? Total ≤66 and every value ≤32 → leave it.
    const total = pairs.reduce((a, b) => a + b.value, 0);
    const anyOver32 = pairs.some((p) => p.value > 32);
    if (total <= 66 && !anyOver32) return full;

    // Convert. Always emit all 6 stats in canonical order, zero-filled.
    const byStat: Record<Stat, number> = {
      HP: 0, Atk: 0, Def: 0, SpA: 0, SpD: 0, Spe: 0,
    };
    for (const p of pairs) {
      byStat[p.stat] = evToChampionsPoints(p.value);
    }

    const rendered = STAT_NAMES.map((s) => `${s} ${byStat[s]}`).join(" / ");
    // Keep the same prefix (label + separator) so we don't change the
    // line shape — just swap the body.
    return `${prefix}${rendered}`;
  });
}

interface ExtractedMon {
  species: string;
  ability?: string;
  moves?: string[];
}

function hasPriorPatchToolCall(state: AgentStateType): boolean {
  return state.messages.some((message) => {
    if (message._getType() !== "ai") return false;
    return (
      "tool_calls" in message &&
      Array.isArray(message.tool_calls) &&
      message.tool_calls.some((call) => call.name === "propose_pokemon_patch")
    );
  });
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

  // Deterministic rewrite of 510/252-style EVs → Champions 66/32
  // format. Runs regardless of whether there are hallucinations,
  // because this has been the most persistent bug and prompt rules
  // alone haven't fixed it.
  const rewrittenContent = rewriteEvsToChampionsFormat(content);
  const contentChanged = rewrittenContent !== content;
  const latestUserMessage = getLatestUserMessageText(state.messages);
  const patchModeActive =
    isDirectTeamEditRequest(latestUserMessage) &&
    hasTeamContextForPatch({
      loadedContext: state.loadedContext,
      draftTeam: state.draftTeam,
    });

  const mons = extractMonsFromResponse(rewrittenContent);

  // Only enforce Champions roster when context + persona is Champions-aligned.
  // If we ever add more formats, add a state flag here. For now MetaGross
  // is Champions-only.
  const format = "champions-reg-m-a";
  const violations: string[] = [];
  if (mons.length > 0) {
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
  }

  // Allowlist-based safety net. Template parsing above only sees the
  // strict build-card shape. This helper also scans prose, numbered
  // lists, and loose headings, so "Heatran is a Mega Scizor answer"
  // gets caught even when it isn't inside a `### Pokemon` block.
  const { CHAMPIONS_POKEMON, isChampionsPokemon } =
    await import("@/lib/data/champions");
  const alreadyFlagged = new Set(violations.map((v) => v.toLowerCase()));
  const mentionedSpecies = extractSpeciesMentions(rewrittenContent);
  for (const species of mentionedSpecies) {
    if (isChampionsPokemon(species)) continue;
    // Mega/form strip in case the agent writes "Scovillain-Mega"
    // explicitly — the base form is what we check.
    const baseStripped = species
      .replace(/-Mega(-[XY])?$/i, "")
      .replace(/^Mega\s+/i, "")
      .trim();
    if (baseStripped !== species && isChampionsPokemon(baseStripped)) continue;
    const msg = `• ${species}: not on the Champions roster (${CHAMPIONS_POKEMON.length} allowed species). Replace with a confirmed legal pick.`;
    if (!alreadyFlagged.has(msg.toLowerCase())) violations.push(msg);
  }

  if (
    patchModeActive &&
    !hasPriorPatchToolCall(state) &&
    !/<user-question>/i.test(rewrittenContent) &&
    !isPatchClarificationQuestion(rewrittenContent)
  ) {
    violations.push(
      "• This turn was a direct edit request against the current team. Do NOT answer with prose or a rebuilt roster. Call propose_pokemon_patch and reply with a short patch confirmation only.",
    );
  }

  if (
    patchModeActive &&
    !hasPriorPatchToolCall(state) &&
    isAssistantConfirmationLoop(rewrittenContent)
  ) {
    violations.push(
      "• Do NOT ask the user to confirm the same edit they already requested. The user already asked for the change. Propose the patch immediately with propose_pokemon_patch.",
    );
  }

  if (violations.length === 0) {
    if (contentChanged) {
      const replacement = new AIMessage({
        content: rewrittenContent,
        id: (lastMsg as AIMessage).id,
      });
      return { messages: [replacement] };
    }
    return {};
  }

  const retries = state.verificationRetries ?? 0;
  if (retries >= MAX_RETRIES) {
    // Retry cap exhausted. Check whether any remaining violation is a
    // hard NOT_IN_CHAMPIONS species — those are never acceptable to
    // ship (user asked us a real question; a team with Rillaboom or
    // Gholdengo is worse than a clear error message).
    const hasRosterViolation = violations.some((v) =>
      /CONFIRMED not in/i.test(v),
    );
    if (hasRosterViolation) {
      const errorBody = [
        "I tried to answer your question but kept drifting into Pokemon that aren't in Champions Reg M-A. Specifically:",
        "",
        ...violations,
        "",
        "Could you re-phrase your request? For single-slot changes, say something like \"change Talonflame's Protect to Quick Guard\" — I'll propose the edit without rewriting the whole team.",
      ].join("\n");
      const replacement = new AIMessage({
        content: errorBody,
        id: (lastMsg as AIMessage).id,
      });
      return { messages: [replacement] };
    }
    // Non-roster issues — let it through with render-time warnings.
    if (contentChanged) {
      const replacement = new AIMessage({
        content: rewrittenContent,
        id: (lastMsg as AIMessage).id,
      });
      return { messages: [replacement] };
    }
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
