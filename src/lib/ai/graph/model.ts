import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";

export type AgentProvider = "openai" | "openrouter" | "anthropic";

/**
 * Create the LLM model instance based on the configured provider.
 */
export function createModel(provider: AgentProvider) {
  if (provider === "openrouter") {
    return new ChatOpenAI({
      model: "openai/gpt-4o",
      temperature: 0.3,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
      },
    });
  }

  if (provider === "openai") {
    return new ChatOpenAI({
      model: "gpt-4o",
      temperature: 0.3,
    });
  }

  // Default: anthropic
  return new ChatAnthropic({
    model: "claude-sonnet-4-5-20250929",
    temperature: 0.3,
  });
}

/**
 * Detect which provider is available based on environment variables.
 */
export function detectProvider(): AgentProvider {
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  return "anthropic";
}

/**
 * Get the model name for display/storage, given a provider.
 */
export function getModelName(provider: AgentProvider): string {
  switch (provider) {
    case "openai":
      return "gpt-4o";
    case "openrouter":
      return "openai/gpt-4o";
    case "anthropic":
      return "claude-sonnet-4-5-20250929";
  }
}
