import type { AgentStateType, AgentStateUpdate } from "../state";
import {
  isChampionsPokemon,
  isConfirmedNotInChampions,
  isMoveBlockedForSpecies,
  getUnavailableMovesFor,
  CHAMPIONS_ITEMS_UNCERTAIN,
  CHAMPIONS_ITEMS_BANNED,
  ACTIVE_REGULATION_LABEL,
} from "@/lib/data/champions";
import { AIMessage } from "@langchain/core/messages";
import { detectProvider, getModelName } from "../model";
import { logAgentEvent } from "@/lib/ai/logger";
import { saveFeedback } from "@/lib/ai/knowledge";
import {
  getLatestUserMessageText,
  hasTeamContextForPatch,
  isAssistantConfirmationLoop,
  isPatchClarificationQuestion,
  isDirectTeamEditRequest,
} from "../edit-intent";
import { extractSpeciesMentions } from "../species-mentions";

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

function looksLikeFullTeamResponse(content: string, pokemonCount: number): boolean {
  const headingCount = (content.match(/^###\s+/gm) ?? []).length;
  const numberedCount = (content.match(/^\d+[.)]\s+/gm) ?? []).length;
  const explicitTeamMarkers =
    /(^|\n)##\s*Team\b/im.test(content) ||
    /\bhere(?:'|’)s\s+(?:a\s+)?6[- ](?:mon|pokemon)\s+team\b/i.test(content) ||
    /\brecommended\s+6\b/i.test(content) ||
    /\bteam summary\b/i.test(content);

  return (
    explicitTeamMarkers ||
    headingCount >= 4 ||
    numberedCount >= 4 ||
    (pokemonCount >= 6 && /\bteam\b/i.test(content))
  );
}

/**
 * Did the user's latest message look like a team-build request? Used
 * to gate the "you only proposed N Pokemon" check — a yes/no question
 * about a single slot (e.g. "is Pelipper's Focus Sash ok?") should
 * NOT trigger a "you need 6 Pokemon" complaint just because the
 * agent's prose answer mentioned several species in its explanation.
 */
function userAskedForFullTeam(message: string): boolean {
  const text = message.toLowerCase();
  // Direct team-build phrasings.
  if (/\b(?:build|make|design|propose|generate|give\s+me|recommend)\s+(?:a\s+|an\s+|me\s+a\s+|me\s+an\s+|the\s+)?(?:full\s+|new\s+|6[- ]?mon\s+|6\s*pokemon\s+)?(?:vgc\s+)?team\b/i.test(text)) return true;
  if (/\bnew\s+team\b/.test(text)) return true;
  if (/\bfull\s+(?:team|build|6[- ]?mon|6\s*pokemon)\b/.test(text)) return true;
  if (/\b6[- ]?mon\s+team\b/.test(text)) return true;
  if (/\bcounter[- ]team\b/.test(text)) return true;
  // "rebuild", "redo the team", etc.
  if (/\b(?:rebuild|redo)\s+(?:the\s+)?team\b/.test(text)) return true;
  return false;
}

/**
 * Validation node that checks the agent's response for accuracy issues
 * BEFORE it reaches the user. If problems are found, it REPLACES the
 * response with a corrected version (removes the bad one, adds the fix).
 */
export async function validateResponseNode(
  state: AgentStateType,
): Promise<Partial<AgentStateUpdate>> {
  const messages = state.messages ?? [];
  const lastMsg = messages[messages.length - 1];

  if (!lastMsg || lastMsg._getType() !== "ai") {
    return {};
  }

  const aiMsg = lastMsg as AIMessage;

  // Skip validation if there are tool calls (agent is still working)
  if (aiMsg.tool_calls && aiMsg.tool_calls.length > 0) {
    return {};
  }

  const content = typeof aiMsg.content === "string"
    ? aiMsg.content
    : Array.isArray(aiMsg.content)
      ? aiMsg.content
          .filter((b): b is { type: "text"; text: string } =>
            typeof b === "object" && b !== null && "type" in b && b.type === "text")
          .map((b) => b.text)
          .join("")
      : "";

  if (!content) return {};

  const issues: string[] = [];
  const latestUserMessage = getLatestUserMessageText(state.messages);
  const patchModeActive =
    isDirectTeamEditRequest(latestUserMessage) &&
    hasTeamContextForPatch({
      loadedContext: state.loadedContext,
      draftTeam: state.draftTeam,
    });

  const mentionedSpecies = new Set(extractSpeciesMentions(content));

  // Flipped policy: use the CHAMPIONS_POKEMON ALLOWLIST as the source
  // of truth. Anything that looks like a species heading but ISN'T on
  // the allowed roster gets flagged. Previously we relied on
  // NOT_IN_CHAMPIONS blocklist and missed every species we hadn't
  // explicitly named (Gholdengo, etc.). The allowlist is authoritative
  // — 187 species, verified against Bulbapedia.
  const { CHAMPIONS_POKEMON } = await import(
    "@/lib/data/champions"
  );

  const pokemonMentions = Array.from(mentionedSpecies);
  for (const species of pokemonMentions) {
    // Allowlist check first — species IS in the Champions roster → ok.
    if (isChampionsPokemon(species)) continue;

    // Second-chance for Mega forms (`-Mega`, `-Mega-X`, etc.). The
    // roster stores the base species; `isChampionsPokemon` does the
    // normalisation, but if someone types "Scovillain-Mega" explicitly
    // we still want to accept it.
    const baseStripped = species
      .replace(/-Mega(-[XY])?$/i, "")
      .replace(/-(Alola|Hisui|Galar|Paldea|Eternal|Therian|Origin)$/i, "$&");
    if (isChampionsPokemon(baseStripped)) continue;

    // Allowlist miss — now we flag. Include a specific hint when the
    // species is on the known-blocked list.
    const isKnownBad = isConfirmedNotInChampions(species);
    const msg = isKnownBad
      ? `${species} is NOT available in ${ACTIVE_REGULATION_LABEL}. Remove it and suggest an alternative.`
      : `${species} is not on the ${ACTIVE_REGULATION_LABEL} roster (${CHAMPIONS_POKEMON.length} allowed species). Replace with a confirmed legal pick.`;
    issues.push(msg);
    try {
      saveFeedback({
        type: "correction",
        topic: `${species} not in Champions`,
        content: isKnownBad
          ? `Agent proposed ${species} in a response, but ${species} is confirmed NOT in Pokemon ${ACTIVE_REGULATION_LABEL}. Do not include it in any team or recommendation.`
          : `Agent proposed ${species} but it is not on the authoritative CHAMPIONS_POKEMON allowlist. If you think it IS in the game, add it to src/lib/data/champions.ts; otherwise pick a confirmed legal alternative.`,
        source: "validate-response node",
      });
    } catch {
      // Non-fatal.
    }
  }

  // Check for BANNED items — hard reject. These are VGC staples that Game8
  // confirms are NOT in Champions (Weakness Policy, Life Orb, etc.).
  // Context-aware: skip when the agent is correctly NOTING the item is
  // illegal (e.g. "Weakness Policy isn't in Champions"). We look at a
  // small window of text around each match for negation phrases.
  const isMentionLegitimate = (text: string, match: number, len: number): boolean => {
    const before = text.slice(Math.max(0, match - 80), match).toLowerCase();
    const after = text.slice(match + len, match + len + 80).toLowerCase();
    const window = `${before} ${after}`;
    return /\b(?:not|isn'?t|no|cut|removed|unavailable|banned|illegal|n[''’]t in|not in|not available|don'?t (?:have|use)|cannot use|can'?t use|not legal)\b/.test(
      window,
    );
  };
  for (const item of CHAMPIONS_ITEMS_BANNED) {
    const itemRegex = new RegExp(
      `\\b${item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i",
    );
    const m = itemRegex.exec(content);
    if (m && !isMentionLegitimate(content, m.index, m[0].length)) {
      issues.push(`${item} is NOT in Pokemon Champions. Remove it and pick an item from the ALLOWED list.`);
      // Persist the correction so the next conversation's knowledge context
      // sees it and reinforces the rule.
      try {
        saveFeedback({
          type: "correction",
          topic: `${item} not in Champions`,
          content: `Agent proposed ${item} but it's not in Pokemon ${ACTIVE_REGULATION_LABEL} (source: Game8 items list). Pick a held item from CHAMPIONS_ITEMS_CONFIRMED instead.`,
          source: "validate-response node",
        });
      } catch {
        // Non-fatal — feedback persistence is best-effort.
      }
    }
  }

  // Check for uncertain items being recommended
  for (const item of CHAMPIONS_ITEMS_UNCERTAIN) {
    if (content.includes(item)) {
      issues.push(`${item} may NOT be available in Champions (unverified). Suggest a confirmed alternative.`);
    }
  }

  // Check for known wrong abilities. Tightened to require species +
  // bad ability to appear in the SAME per-Pokemon section, not
  // anywhere in the response. Previously a contextual mention like
  // "this is better than Archaludon" combined with a different
  // Pokemon's `**Ability**: Levitate` line would false-positive.
  const wrongAbilities: Record<string, string[]> = {
    "Archaludon": ["Levitate"],
    "Incineroar": ["Blaze"],
    "Pelipper": ["Keen Eye", "Rain Dish"],
  };
  // Per-mon section blocks: split on `### Heading` or `1. Heading`
  // boundaries so a bad ability under one species can't taint
  // another's mention.
  const sections = content.split(/(?=^(?:#{1,3}\s+|\d+[.)]\s+))/m);
  for (const section of sections) {
    for (const [species, badAbilities] of Object.entries(wrongAbilities)) {
      // Species must appear in this section's HEADING (start of
      // section) — passing-mentions in prose don't count.
      const headingPattern = new RegExp(
        `^(?:#{1,3}|\\d+[.)])\\s+\\*{0,2}${species.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&",
        )}\\b`,
        "i",
      );
      if (!headingPattern.test(section.trim())) continue;
      for (const bad of badAbilities) {
        if (section.includes(`**Ability**: ${bad}`)) {
          issues.push(
            `${species} should NOT use ${bad} in competitive VGC. Use the correct competitive ability.`,
          );
        }
      }
    }
  }

  // Check stat point totals (must equal 66, max 32 per stat)
  // Also catch if the model output EVs (252/510) instead of Points (32/66)
  const pointMatches = content.matchAll(/\*\*(?:Points|EVs)\*\*:\s*HP\s*(\d+)\s*\/\s*Atk\s*(\d+)\s*\/\s*Def\s*(\d+)\s*\/\s*SpA\s*(\d+)\s*\/\s*SpD\s*(\d+)\s*\/\s*Spe\s*(\d+)/g);
  for (const match of pointMatches) {
    const stats = [1, 2, 3, 4, 5, 6].map((i) => parseInt(match[i]));
    const total = stats.reduce((sum, v) => sum + v, 0);
    const maxStat = Math.max(...stats);

    // Detect if model used traditional EVs (252/510) instead of Champions Points (32/66)
    if (total > 100 || maxStat > 32) {
      issues.push(
        `WRONG SYSTEM: You used traditional EVs (total=${total}, max=${maxStat}). Champions uses STAT POINTS: 66 total, 32 max per stat. COPY the spread from the optimize_ev_spread tool result EXACTLY.`
      );
      break;
    }

    if (total !== 66) {
      issues.push(`A Pokemon has ${total}/66 stat points. Must be EXACTLY 66. COPY the spread from the optimize_ev_spread tool result.`);
    }
  }

  // Check for nature/stat mismatches (e.g., Adamant with max SpA, or special attacker with max Atk)
  // Split into per-Pokemon sections. Accept either "### Species"
  // headings OR "1. Species" / "1) Species" numbered-list headings so
  // the move/nature validators below see the same shapes the species
  // detector above now catches.
  const pokemonSections = content
    .split(/(?=^(?:#{1,3}\s+|\d+[.)]\s+))/m)
    .filter(
      (s) =>
        /^#{1,3}\s+\S/.test(s) || /^\d+[.)]\s+\*{0,2}[A-Z]/.test(s),
    );
  for (const section of pokemonSections) {
    const natureMatch = section.match(/\*\*Nature\*\*:\s*(\w+)/);
    const pointsMatch = section.match(/\*\*Points\*\*:\s*HP\s*(\d+)\s*\/\s*Atk\s*(\d+)\s*\/\s*Def\s*(\d+)\s*\/\s*SpA\s*(\d+)\s*\/\s*SpD\s*(\d+)\s*\/\s*Spe\s*(\d+)/);
    const roleMatch = section.match(/\*\*Role\*\*:\s*(.+)/);
    // Accept `### Name`, `## Name`, or `1. Name` / `1) Name` (with
    // optional `**` wrappers) — matches the broader split rule above.
    const speciesMatch =
      section.match(/^#{1,3}\s+(.+)/) ??
      section.match(/^\d+[.)]\s+\*{0,2}(.+?)\*{0,2}\s*$/m);

    if (natureMatch && pointsMatch && roleMatch && speciesMatch) {
      const nature = natureMatch[1];
      const atk = parseInt(pointsMatch[2]);
      const spa = parseInt(pointsMatch[4]);
      const role = roleMatch[1].toLowerCase();
      const species = speciesMatch[1].trim();

      const isSpecialRole = role.includes("special") || role.includes("rain setter");
      const isPhysicalRole = role.includes("physical");

      // Special attacker with Adamant (boosts Atk, reduces SpA) and max Atk = wrong
      if (isSpecialRole && (nature === "Adamant" || nature === "Jolly") && atk > spa) {
        issues.push(`${species}: ${nature} nature with ${atk} Atk is wrong for a special attacker. Use Modest/Timid and invest in SpA, not Atk. COPY the spread from optimize_ev_spread.`);
      }
      // Physical attacker with Modest (boosts SpA, reduces Atk) and max SpA = wrong
      if (isPhysicalRole && (nature === "Modest" || nature === "Timid") && spa > atk) {
        issues.push(`${species}: ${nature} nature with ${spa} SpA is wrong for a physical attacker. Use Adamant/Jolly and invest in Atk, not SpA.`);
      }
    }

    // Check for duplicate moves
    const movesMatch = section.match(/\*\*Moves\*\*:\s*(.+)/);
    if (movesMatch && speciesMatch) {
      const moves = movesMatch[1]
        .split(/\s*\/\s*/)
        .map((m) => m.split(/[—–\-]/)[0].trim())
        .filter(Boolean);
      const speciesName = speciesMatch[1].trim();
      const uniqueMoves = new Set(moves.map((m) => m.toLowerCase()));
      if (moves.length !== uniqueMoves.size) {
        const lower = moves.map((m) => m.toLowerCase());
        const dupes = lower.filter((m, i) => lower.indexOf(m) !== i);
        issues.push(`${speciesName}: has duplicate moves (${[...new Set(dupes)].join(", ")}). Each move must be unique. Pick 4 different moves from the Pikalytics data.`);
      }

      // Champions-specific blocked moves (e.g. Incineroar has no Knock Off).
      const blocked = moves.filter((m) =>
        isMoveBlockedForSpecies(speciesName, m),
      );
      if (blocked.length > 0) {
        const allBlocked = getUnavailableMovesFor(speciesName).join(", ");
        issues.push(
          `${speciesName} cannot use ${blocked.join(", ")} in ${ACTIVE_REGULATION_LABEL} (cut from its movepool). Blocked moves for this species: ${allBlocked}. Pick a different move.`,
        );
        try {
          saveFeedback({
            type: "correction",
            topic: `${speciesName} missing move ${blocked[0]} in Champions`,
            content: `Agent proposed ${blocked.join(", ")} on ${speciesName}, but ${speciesName} loses ${allBlocked} in Pokemon ${ACTIVE_REGULATION_LABEL}. Pick from the species' actual Champions movepool.`,
            source: "validate-response node",
          });
        } catch {
          // Non-fatal.
        }
      }
    }
  }

  // Check if fewer than 6 Pokemon were suggested when the user
  // ACTUALLY asked for a full team. Both signals must align:
  //   1. The user's latest message looks like a team-build request
  //   2. The agent's response also looks team-shaped
  // Without (1) we get false positives on yes/no questions where the
  // agent explained an answer using 3-4 Pokemon for context.
  if (
    pokemonMentions.length > 0 &&
    pokemonMentions.length < 6 &&
    userAskedForFullTeam(latestUserMessage) &&
    looksLikeFullTeamResponse(content, pokemonMentions.length)
  ) {
    issues.push(`Only ${pokemonMentions.length} Pokemon suggested. A VGC team needs exactly 6. Add ${6 - pokemonMentions.length} more.`);
  }

  if (
    patchModeActive &&
    !hasPriorPatchToolCall(state) &&
    !/<user-question>/i.test(content) &&
    !isPatchClarificationQuestion(content)
  ) {
    issues.push(
      "Direct edit request detected for the current team, but the response did not stay in patch mode. Use propose_pokemon_patch and confirm only the requested slot change.",
    );
  }

  if (
    patchModeActive &&
    !hasPriorPatchToolCall(state) &&
    isAssistantConfirmationLoop(content)
  ) {
    issues.push(
      "Do not ask the user to confirm the same edit they already requested. The user already asked for the change. Use propose_pokemon_patch immediately.",
    );
  }

  if (issues.length === 0) {
    logAgentEvent({
      sessionId: state.threadId || "unknown",
      agent: "metagross-main",
      node: "validate",
      model: getModelName(detectProvider()),
      provider: detectProvider(),
      action: "validation",
      metadata: { passed: true, issueCount: 0 },
    });
    return {}; // No issues, response is fine
  }

  // Log validation failures
  logAgentEvent({
    sessionId: state.threadId || "unknown",
    agent: "metagross-main",
    node: "validate",
    model: getModelName(detectProvider()),
    provider: detectProvider(),
    action: "validation",
    metadata: { passed: false, issues },
  });

  // Final validation is terminal in the graph. Do NOT run an
  // ungrounded free-form rewrite here — that path lacks the full
  // system prompt, draft-team context, and tool loop, and can invent
  // new illegal Pokemon while "fixing" the old ones.
  const replacement = new AIMessage({
    id: aiMsg.id,
    content: [
      `I need to correct the previous answer before it is safe to use for Pokemon ${ACTIVE_REGULATION_LABEL}.`,
      "",
      "Problems still detected:",
      ...issues.map((issue) => `- ${issue}`),
      "",
      "Please retry the request. If you want a single change, ask for the exact slot edit and I'll keep the rest of the roster intact.",
    ].join("\n"),
  });

  return {
    messages: [replacement],
  };
}
