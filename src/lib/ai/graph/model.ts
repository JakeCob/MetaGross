import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";

export type AgentProvider = "openai" | "openrouter" | "anthropic";

/**
 * Default model for each provider when no override is supplied.
 * These are the same models detectProvider would pick when no user
 * selection is stored.
 */
const PROVIDER_DEFAULT_MODEL: Record<AgentProvider, string> = {
  openai: "gpt-5.5",
  openrouter: "openai/gpt-5.5",
  anthropic: "claude-sonnet-4-6",
};

/**
 * OpenAI's GPT-5 family + reasoning models only accept the default
 * temperature (1). Setting any other value returns a 400 Unsupported
 * value error. We detect those and just omit the temperature option.
 */
function supportsCustomTemperature(model: string): boolean {
  const id = model.toLowerCase();
  // GPT-5 / GPT-5.x family — temperature locked at 1.
  if (/^(openai\/)?gpt-5(\.\d+)?(-(mini|nano|pro))?$/i.test(id)) return false;
  // Reasoning models — same restriction.
  if (/^(openai\/)?o[1-9]/.test(id)) return false;
  return true;
}

/**
 * Create the LLM model instance for the given provider. An optional
 * modelName lets callers override the default — used by the user-
 * facing model selector so users can pick between Opus / Sonnet /
 * Haiku / GPT-4.1 etc. per chat thread.
 */
export function createModel(provider: AgentProvider, modelName?: string) {
  const model = modelName && modelName.trim().length > 0
    ? modelName.trim()
    : PROVIDER_DEFAULT_MODEL[provider];

  // Newer OpenAI models reject any non-default temperature, so we
  // omit the field entirely for them. Older models keep our 0.3
  // bias toward deterministic tool-use behavior.
  const tempField = supportsCustomTemperature(model)
    ? { temperature: 0.3 }
    : {};

  if (provider === "openrouter") {
    return new ChatOpenAI({
      model,
      ...tempField,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
      },
    });
  }

  if (provider === "openai") {
    return new ChatOpenAI({
      model,
      ...tempField,
    });
  }

  // Default: anthropic — Claude has no equivalent restriction.
  return new ChatAnthropic({
    model,
    temperature: 0.3,
  });
}

/**
 * Detect which provider is available based on environment variables.
 * Used when the caller didn't specify a provider (e.g. background
 * agents that run without a user-preferred model).
 */
export function detectProvider(): AgentProvider {
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  return "anthropic";
}

/**
 * Whether a provider has the credentials it needs to actually work.
 * Lets routes drop a stale provider override (e.g. a localStorage
 * cached "openai" preference after the OPENAI key was rotated out)
 * before it hits the LLM and 401s.
 */
export function providerHasCredentials(provider: AgentProvider): boolean {
  switch (provider) {
    case "openai":
      return !!process.env.OPENAI_API_KEY;
    case "openrouter":
      return !!process.env.OPENROUTER_API_KEY;
    case "anthropic":
      return !!process.env.ANTHROPIC_API_KEY;
  }
}

/**
 * Pick the right provider: honour an explicit caller override IF the
 * env for that provider is present; otherwise fall through to
 * detectProvider(). Eliminates the failure mode where the browser
 * sends provider="openai" with a model the server can't authenticate.
 */
export function resolveProvider(
  override: AgentProvider | null | undefined,
): AgentProvider {
  if (override && providerHasCredentials(override)) return override;
  return detectProvider();
}

/**
 * Get the model name for display/storage. Honours the modelName
 * override when supplied.
 */
export function getModelName(
  provider: AgentProvider,
  modelName?: string,
): string {
  if (modelName && modelName.trim().length > 0) return modelName.trim();
  return PROVIDER_DEFAULT_MODEL[provider];
}

// ---------------------------------------------------------------------------
// Runtime auth-failure fallback
//
// Even when a provider's env key is set, it may be dead at runtime — keys get
// rotated, projects get archived, accounts run out of credit. Without
// recovery, every chat 401s until a redeploy. We mark broken providers in a
// process-scope set and skip them on subsequent picks; the set resets on
// cold-start so a re-issued key recovers without code changes.
// ---------------------------------------------------------------------------

const PROVIDER_ORDER: AgentProvider[] = ["openai", "openrouter", "anthropic"];

const brokenProviders = new Set<AgentProvider>();

/**
 * Mark a provider as broken for the rest of the process. Subsequent
 * resolveProvider / pickFallbackProvider calls will skip it.
 */
export function markProviderBroken(provider: AgentProvider, reason?: string): void {
  if (brokenProviders.has(provider)) return;
  brokenProviders.add(provider);
  console.warn(
    `[model] Marking provider "${provider}" broken for the rest of this process${reason ? `: ${reason}` : ""}`,
  );
}

/**
 * Heuristic for "this error means the credentials are dead, not a transient
 * network blip." We check status codes first (most reliable across SDKs),
 * then fall back to message inspection for SDKs that wrap the response.
 */
export function isAuthError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as {
    status?: number;
    statusCode?: number;
    code?: string;
    response?: { status?: number };
    cause?: { status?: number };
    message?: string;
  };
  const status =
    anyErr.status ?? anyErr.statusCode ?? anyErr.response?.status ?? anyErr.cause?.status;
  if (status === 401 || status === 403) return true;
  const msg = (anyErr.message ?? "").toLowerCase();
  if (!msg) return false;
  return (
    msg.includes("401") ||
    msg.includes("invalid api key") ||
    msg.includes("invalid_api_key") ||
    msg.includes("incorrect api key") ||
    msg.includes("authentication") ||
    msg.includes("unauthorized") ||
    msg.includes("has been archived") ||
    msg.includes("not_authorized_invalid_project")
  );
}

/**
 * Pick the next provider to try after `current` failed. Walks
 * PROVIDER_ORDER, skips broken providers, requires env credentials.
 * Returns null when nothing is left to try.
 */
export function pickFallbackProvider(
  current: AgentProvider,
): AgentProvider | null {
  for (const candidate of PROVIDER_ORDER) {
    if (candidate === current) continue;
    if (brokenProviders.has(candidate)) continue;
    if (!providerHasCredentials(candidate)) continue;
    return candidate;
  }
  return null;
}

// Override resolveProvider + detectProvider so they also skip broken
// providers. We re-implement them here instead of mutating the exported
// functions above so the lower-level helpers stay simple/testable.
const _detectProviderRaw = detectProvider;
const _resolveProviderRaw = resolveProvider;

export function detectProviderHealthy(): AgentProvider {
  for (const candidate of PROVIDER_ORDER) {
    if (brokenProviders.has(candidate)) continue;
    if (providerHasCredentials(candidate)) return candidate;
  }
  // Nothing healthy — fall back to the raw default and let the
  // caller surface a clean "no AI provider" error.
  return _detectProviderRaw();
}

export function resolveProviderHealthy(
  override: AgentProvider | null | undefined,
): AgentProvider {
  if (override && !brokenProviders.has(override) && providerHasCredentials(override)) {
    return override;
  }
  return detectProviderHealthy();
}

// Quiet "unused" warnings — these are kept for explicit raw access if
// a future caller wants pre-broken-filter behaviour (e.g. status pages).
void _detectProviderRaw;
void _resolveProviderRaw;
