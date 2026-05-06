import type { BaseMessage } from "@langchain/core/messages";

const DIRECT_EDIT_PATTERNS: RegExp[] = [
  /\bchange\s+.+\s+to\s+.+/i,
  /\bupdate\s+.+\s+to\s+.+/i,
  /\bswap\s+.+\s+for\s+.+/i,
  /\breplace\s+.+\s+with\s+.+/i,
  /\blet'?s\s+(?:swap|replace|change|update)\b/i,
  /\bkeep\s+[A-Za-z0-9-]+/i,
  /\buse\s+.+\s+instead of\s+.+/i,
  /\badd\s+wide guard\b/i,
  /\badd\s+[A-Za-z0-9-]+\s+to\s+my\s+pokemon\b/i,
  /\bmake\s+[A-Za-z0-9-]+'?s\s+\w+/i,
  /\bset\s+[A-Za-z0-9-]+'?s\s+\w+/i,
  /\bfix\s+[A-Za-z0-9-]+'?s\s+\w+/i,
];

const DIRECT_EDIT_HINTS: RegExp[] = [
  /\breplace\b/i,
  /\bswap\b/i,
  /\bchange\b/i,
  /\bupdate\b/i,
  /\bkeep\b/i,
  /\badd\s+wide guard\b/i,
];

const ACTION_EDIT_QUESTION_PATTERNS: RegExp[] = [
  /^\s*can you\b/i,
  /^\s*could you\b/i,
];

const ANALYSIS_EDIT_QUESTION_PATTERNS: RegExp[] = [
  /^\s*do you agree\b/i,
  /^\s*do you think\b/i,
  /^\s*what do you think\b/i,
  /^\s*should\s+(?:i|we|it|that)\b/i, // should I / should we / should it / should that
  /^\s*would\s+(?:it|replacing|swapping|using|changing)\b/i,
  /^\s*is\s+(?:it|that)\s+(?:worth|better|good)\b/i,
  /^\s*is\s+this\s+(?:a\s+)?good\s+(?:idea|move|swap|choice)\b/i,
  /^\s*is\b.+\bbetter\b/i,
  /^\s*how\s+(?:about|do you feel|good)\b/i, // "how about Quick Guard?", "how good is X?"
  /\bworth\s+(?:it|trying|considering)\b/i,
  /\bgood idea\b/i,
];

const TENTATIVE_EDIT_OPTION_PATTERNS: RegExp[] = [
  /^\s*or\b/i,
  /^\s*what about\b/i,
  /^\s*how about\b/i,
  /^\s*instead\b/i,
];

const NON_EDIT_QUESTION_PATTERNS: RegExp[] = [
  /^\s*why\b/i,
  /^\s*did you\b/i,
  /^\s*what\b/i,
  /^\s*how\b/i,
];

const ASSISTANT_CONFIRMATION_PATTERNS: RegExp[] = [
  /^\s*do you agree\b/i,
  /^\s*do you want me to\b/i,
  /^\s*would you like me to\b/i,
  /^\s*should i\b/i,
  /^\s*can i\b/i,
  /\bapprove\b/i,
];

const PATCH_CLARIFICATION_PATTERNS: RegExp[] = [
  /^\s*which\b/i,
  /^\s*what\b/i,
  /^\s*did you mean\b/i,
  /^\s*when you say\b/i,
];

/**
 * Phrases that signal "deliberate first, don't patch yet". When these
 * appear in a message that ALSO has direct-edit phrasing, the agent
 * should suppress patch mode and use research tools (search_meta_teams,
 * get_smogon_analysis, search_web) to validate the user's claims
 * against tournament data before proposing any change.
 *
 * Why this matters: Karpathy's verifiability lens — applying a patch
 * is verifiable, holding a deliberative discussion isn't, so without
 * an explicit signal the router defaults to the verifiable path. These
 * patterns are that explicit signal.
 */
const RESEARCH_INTENT_PATTERNS: RegExp[] = [
  /\blet'?s\s+(?:discuss|talk|think|chat)\b/i,
  /\bwe\s+(?:could|should|can)\s+discuss\b/i,
  /\bcould\s+(?:we\s+)?discuss\b/i,
  /\bdiscuss\s+(?:about|this|first)\b/i,
  /\bgather\s+(?:more\s+)?info\b/i,
  /\bdo\s+(?:more\s+)?research\b/i,
  /\b(?:more|further)\s+research\b/i,
  /\blook\s+(?:on|at|in|into)\s+(?:limitless|smogon|pikalytics|the\s+meta|tournament)/i,
  /\bcheck\s+(?:on|the|with)\s+(?:limitless|smogon|pikalytics|the\s+meta|tournament|reference)/i,
  /\bsearch\s+(?:limitless|smogon|pikalytics|the\s+web|the\s+meta)/i,
  /\bnot\s+(?:fully\s+)?sure\s+(?:yet|about)/i,
  /\bbefore\s+(?:applying|changing|patching|updating)/i,
  /\bcan\s+we\s+(?:think|discuss|talk)\b/i,
  /\bthink\s+(?:about|this|it)\s+(?:through|over|more)\b/i,
];

/**
 * The user wants deliberation/research before a patch is applied,
 * even if they also used edit verbs ("X should be Y"). Agent should
 * call read tools first and discuss tradeoffs in plain text.
 */
export function hasResearchIntent(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  return RESEARCH_INTENT_PATTERNS.some((pattern) => pattern.test(text));
}

export function getLatestUserMessageText(messages: BaseMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message._getType() !== "human") continue;
    const content =
      typeof message.content === "string"
        ? message.content
        : Array.isArray(message.content)
          ? message.content
              .filter((block): block is { type: "text"; text: string } =>
                typeof block === "object" &&
                block !== null &&
                "type" in block &&
                block.type === "text" &&
                "text" in block)
              .map((block) => block.text)
              .join("")
          : "";
    if (!content.trim()) continue;
    if (content.startsWith("[VERIFIER]")) continue;
    return content.trim();
  }
  return "";
}

/**
 * Detect direct "patch this existing team" requests, not explanatory
 * follow-ups like "why did you replace Milotic?".
 */
export function isDirectTeamEditRequest(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  const mentionsEdit =
    DIRECT_EDIT_PATTERNS.some((pattern) => pattern.test(text)) ||
    DIRECT_EDIT_HINTS.some((pattern) => pattern.test(text));

  if (
    mentionsEdit &&
    TENTATIVE_EDIT_OPTION_PATTERNS.some((pattern) => pattern.test(text))
  ) {
    return false;
  }

  if (
    mentionsEdit &&
    ANALYSIS_EDIT_QUESTION_PATTERNS.some((pattern) => pattern.test(text))
  ) {
    return false;
  }

  if (
    mentionsEdit &&
    ACTION_EDIT_QUESTION_PATTERNS.some((pattern) => pattern.test(text))
  ) {
    return true;
  }

  if (NON_EDIT_QUESTION_PATTERNS.some((pattern) => pattern.test(text))) {
    return false;
  }
  if (DIRECT_EDIT_PATTERNS.some((pattern) => pattern.test(text))) {
    return true;
  }
  return (
    DIRECT_EDIT_HINTS.some((pattern) => pattern.test(text)) &&
    !text.endsWith("?")
  );
}

export function isTentativeTeamEditSuggestion(message: string): boolean {
  const text = message.trim();
  if (!text) return false;

  const mentionsEdit =
    DIRECT_EDIT_PATTERNS.some((pattern) => pattern.test(text)) ||
    DIRECT_EDIT_HINTS.some((pattern) => pattern.test(text)) ||
    /\badd\b/i.test(text);

  if (!mentionsEdit) return false;

  return TENTATIVE_EDIT_OPTION_PATTERNS.some((pattern) => pattern.test(text));
}

export function hasTeamContextForPatch(input: {
  loadedContext?: Record<string, unknown> | null;
  draftTeam?: { pokemon?: Array<{ species?: string }> } | null;
}): boolean {
  const loadedPokemon = input.loadedContext?.type === "team" &&
    Array.isArray(input.loadedContext.pokemon)
      ? input.loadedContext.pokemon
      : [];
  if (loadedPokemon.length > 0) return true;

  const draftPokemon = Array.isArray(input.draftTeam?.pokemon)
    ? input.draftTeam?.pokemon ?? []
    : [];
  return draftPokemon.some((pokemon) => (pokemon.species ?? "").trim().length > 0);
}

export function isAssistantConfirmationLoop(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  return ASSISTANT_CONFIRMATION_PATTERNS.some((pattern) =>
    pattern.test(text),
  );
}

export function isPatchClarificationQuestion(message: string): boolean {
  const text = message.trim();
  if (!text || !text.endsWith("?")) return false;
  if (isAssistantConfirmationLoop(text)) return false;
  if (/^#{1,3}\s/m.test(text) || /^-\s+\*\*/m.test(text)) return false;
  if ((text.match(/\?/g) ?? []).length > 1) return false;
  return PATCH_CLARIFICATION_PATTERNS.some((pattern) => pattern.test(text));
}
