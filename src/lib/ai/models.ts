/**
 * Model registry — providers + models the user can choose between.
 *
 * Keep this list explicit rather than auto-discovered. Every entry is
 * a model we know works with our tool-use graph; omissions are
 * deliberate (e.g. OpenAI o1 models don't support tool calling the
 * same way and are excluded from chat surfaces that rely on tools).
 */

export type ProviderId = "openai" | "openrouter" | "anthropic";

export interface ModelOption {
  /** Provider-scoped model id used in the SDK call. */
  id: string;
  /** What the user sees in the dropdown. */
  label: string;
  /** Short tier/cost hint for UI display. */
  tier?: "fast" | "balanced" | "premium";
  /** Whether this model supports native tool use (required for agent). */
  supportsTools: boolean;
}

export interface ProviderOption {
  id: ProviderId;
  label: string;
  /** Env var that must be set for this provider to be usable. */
  envKey: "OPENAI_API_KEY" | "OPENROUTER_API_KEY" | "ANTHROPIC_API_KEY";
  models: ModelOption[];
}

export const PROVIDERS: ProviderOption[] = [
  {
    id: "openai",
    label: "OpenAI (direct)",
    envKey: "OPENAI_API_KEY",
    models: [
      // GPT-5.4 family — latest flagship chat models (released after
      // GPT-5 and GPT-5.2; strongest at tool use + instruction following).
      { id: "gpt-5.4", label: "GPT-5.4", tier: "premium", supportsTools: true },
      { id: "gpt-5.4-mini", label: "GPT-5.4 mini", tier: "balanced", supportsTools: true },
      { id: "gpt-5.4-nano", label: "GPT-5.4 nano", tier: "fast", supportsTools: true },
      // GPT-5 family — previous-gen flagship.
      { id: "gpt-5", label: "GPT-5", tier: "premium", supportsTools: true },
      { id: "gpt-5-mini", label: "GPT-5 mini", tier: "balanced", supportsTools: true },
      { id: "gpt-5-nano", label: "GPT-5 nano", tier: "fast", supportsTools: true },
      // GPT-4.1 family.
      { id: "gpt-4.1", label: "GPT-4.1", tier: "premium", supportsTools: true },
      { id: "gpt-4.1-mini", label: "GPT-4.1 mini", tier: "balanced", supportsTools: true },
      { id: "gpt-4.1-nano", label: "GPT-4.1 nano", tier: "fast", supportsTools: true },
      // Reasoning models — slower, pricier, strongest at multi-step
      // logic. Native tool use supported via the Responses API.
      { id: "o3", label: "o3 (reasoning)", tier: "premium", supportsTools: true },
      { id: "o3-mini", label: "o3 mini (reasoning)", tier: "balanced", supportsTools: true },
      { id: "o4-mini", label: "o4 mini (reasoning)", tier: "balanced", supportsTools: true },
      // GPT-4o family — older but widely tested with chat + tool use.
      { id: "gpt-4o", label: "GPT-4o", tier: "balanced", supportsTools: true },
      { id: "gpt-4o-mini", label: "GPT-4o mini", tier: "fast", supportsTools: true },
    ],
  },
  {
    id: "anthropic",
    label: "Anthropic (direct)",
    envKey: "ANTHROPIC_API_KEY",
    models: [
      { id: "claude-opus-4-7", label: "Claude Opus 4.7", tier: "premium", supportsTools: true },
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", tier: "balanced", supportsTools: true },
      { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5", tier: "balanced", supportsTools: true },
      { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", tier: "fast", supportsTools: true },
    ],
  },
  {
    id: "openrouter",
    label: "OpenRouter (multi-provider)",
    envKey: "OPENROUTER_API_KEY",
    models: [
      // OpenAI via OpenRouter
      { id: "openai/gpt-5.4", label: "GPT-5.4 (via OpenRouter)", tier: "premium", supportsTools: true },
      { id: "openai/gpt-5.4-mini", label: "GPT-5.4 mini (via OpenRouter)", tier: "balanced", supportsTools: true },
      { id: "openai/gpt-5", label: "GPT-5 (via OpenRouter)", tier: "premium", supportsTools: true },
      { id: "openai/gpt-5-mini", label: "GPT-5 mini (via OpenRouter)", tier: "balanced", supportsTools: true },
      { id: "openai/gpt-4.1", label: "GPT-4.1 (via OpenRouter)", tier: "premium", supportsTools: true },
      { id: "openai/gpt-4o", label: "GPT-4o (via OpenRouter)", tier: "balanced", supportsTools: true },
      // Anthropic via OpenRouter
      { id: "anthropic/claude-opus-4.7", label: "Claude Opus 4.7 (via OpenRouter)", tier: "premium", supportsTools: true },
      { id: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6 (via OpenRouter)", tier: "balanced", supportsTools: true },
      // Other top models
      { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (via OpenRouter)", tier: "premium", supportsTools: true },
      { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B (via OpenRouter)", tier: "balanced", supportsTools: true },
      { id: "x-ai/grok-4", label: "Grok 4 (via OpenRouter)", tier: "premium", supportsTools: true },
    ],
  },
];

/** Default selection — matches detectProvider's auto-pick priority. */
export const DEFAULT_PROVIDER: ProviderId = "openai";
export const DEFAULT_MODEL_ID = "gpt-5.4";

/** Look up a specific model by provider + id. Returns null when absent. */
export function findModel(
  provider: ProviderId,
  modelId: string,
): ModelOption | null {
  const p = PROVIDERS.find((x) => x.id === provider);
  return p?.models.find((m) => m.id === modelId) ?? null;
}

/** Find the provider record. */
export function findProvider(provider: ProviderId): ProviderOption | null {
  return PROVIDERS.find((x) => x.id === provider) ?? null;
}
