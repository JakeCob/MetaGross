import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { checkRateLimit, recordUsage } from "./rate-limiter";

type AIProvider = "openai" | "openrouter" | "anthropic";

let anthropicClient: Anthropic | null = null;
let openaiClient: OpenAI | null = null;
let openrouterClient: OpenAI | null = null;

function getProvider(): AIProvider | null {
  // Priority: personal OpenAI first, then OpenRouter, then Anthropic
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic();
  }
  return anthropicClient;
}

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI();
  }
  return openaiClient;
}

function getOpenRouterClient(): OpenAI {
  if (!openrouterClient) {
    openrouterClient = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }
  return openrouterClient;
}

const MODELS: Record<AIProvider, string> = {
  openai: "gpt-4o",
  openrouter: "openai/gpt-4o",       // OpenRouter uses provider/model format
  anthropic: "claude-sonnet-4-5-20250929",
};

export interface AIMessage {
  system: string;
  user: string;
}

export interface AIResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  provider: AIProvider;
  model: string;
}

/**
 * Unified AI completion. Priority: OpenAI (personal) > OpenRouter > Anthropic.
 * Rate limits enforced for non-OpenAI providers.
 */
export async function aiComplete(
  message: AIMessage,
  maxTokens: number = 2048,
  usageType: "ai_analysis" | "pre_match" | "ev_optimize" = "ai_analysis",
): Promise<AIResponse> {
  const provider = getProvider();
  if (!provider) {
    throw new Error(
      "No AI API key configured. Set OPENAI_API_KEY, OPENROUTER_API_KEY, or ANTHROPIC_API_KEY in .env",
    );
  }

  // Check rate limit for company keys
  const limit = checkRateLimit(usageType, provider);
  if (!limit.allowed) {
    throw new Error(
      `Daily limit reached for ${provider} (${limit.used}/${limit.limit}). Try again tomorrow or use your personal OpenAI key.`,
    );
  }

  let response: AIResponse;
  if (provider === "anthropic") {
    response = await callAnthropic(message, maxTokens);
  } else if (provider === "openrouter") {
    response = await callOpenRouter(message, maxTokens);
  } else {
    response = await callOpenAI(message, maxTokens);
  }

  // Record usage for tracking
  recordUsage(usageType, {
    provider: response.provider,
    model: response.model,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
  });

  return response;
}

export function isAIAvailable(): boolean {
  return getProvider() !== null;
}

export function getActiveProvider(): string {
  const provider = getProvider();
  if (!provider) return "None";
  return `${provider} (${MODELS[provider]})`;
}

async function callAnthropic(
  message: AIMessage,
  maxTokens: number,
): Promise<AIResponse> {
  const client = getAnthropicClient();
  const model = MODELS.anthropic;
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: message.system,
    messages: [{ role: "user", content: message.user }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in Anthropic response");
  }

  return {
    text: textBlock.text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    provider: "anthropic",
    model,
  };
}

async function callOpenAI(
  message: AIMessage,
  maxTokens: number,
): Promise<AIResponse> {
  const client = getOpenAIClient();
  const model = MODELS.openai;
  const response = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: message.system },
      { role: "user", content: message.user },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("No text content in OpenAI response");

  return {
    text,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
    provider: "openai",
    model,
  };
}

async function callOpenRouter(
  message: AIMessage,
  maxTokens: number,
): Promise<AIResponse> {
  const client = getOpenRouterClient();
  const model = MODELS.openrouter;
  const response = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: message.system },
      { role: "user", content: message.user },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("No text content in OpenRouter response");

  return {
    text,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
    provider: "openrouter",
    model,
  };
}
