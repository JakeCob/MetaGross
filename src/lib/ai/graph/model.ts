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
