import { existsSync, mkdirSync, appendFileSync } from "fs";
import { join } from "path";

const LOG_DIR = join(process.cwd(), "data", "logs", "agents");

// Ensure log directory exists
function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

export interface AgentLogEntry {
  timestamp: string;
  sessionId: string;
  agent: string;
  node?: string;
  model: string;
  provider: string;
  action: "llm_call" | "tool_call" | "tool_result" | "validation" | "error" | "start" | "end";
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  durationMs?: number;
  input?: string;
  output?: string;
  toolName?: string;
  toolArgs?: unknown;
  toolResult?: string;
  metadata?: Record<string, unknown>;
}

function formatCost(tokens: { input?: number; output?: number }, provider: string): number {
  const inputRate = provider === "openai" ? 2.5 / 1_000_000 : 3.0 / 1_000_000;
  const outputRate = provider === "openai" ? 10.0 / 1_000_000 : 15.0 / 1_000_000;
  return (tokens.input ?? 0) * inputRate + (tokens.output ?? 0) * outputRate;
}

/**
 * Get today's log file path.
 */
function getLogFilePath(): string {
  ensureLogDir();
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return join(LOG_DIR, `${date}.jsonl`);
}

/**
 * Log an agent event to today's log file.
 */
export function logAgentEvent(entry: Omit<AgentLogEntry, "timestamp">) {
  const full: AgentLogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
    costUsd: entry.costUsd ?? formatCost(
      { input: entry.inputTokens, output: entry.outputTokens },
      entry.provider,
    ),
  };

  const logFile = getLogFilePath();
  const line = JSON.stringify(full) + "\n";

  try {
    appendFileSync(logFile, line, "utf-8");
  } catch (err) {
    console.error("[AgentLogger] Failed to write log:", err);
  }

  // Also log to console in dev
  const emoji =
    entry.action === "llm_call" ? "🤖" :
    entry.action === "tool_call" ? "🔧" :
    entry.action === "tool_result" ? "📋" :
    entry.action === "validation" ? "✅" :
    entry.action === "error" ? "❌" :
    entry.action === "start" ? "▶️" : "⏹️";

  const cost = full.costUsd ? ` ($${full.costUsd.toFixed(4)})` : "";
  const tokens = (entry.inputTokens || entry.outputTokens)
    ? ` [${entry.inputTokens ?? 0}→${entry.outputTokens ?? 0}]`
    : "";
  const duration = entry.durationMs ? ` ${entry.durationMs}ms` : "";

  console.log(
    `${emoji} [${entry.agent}${entry.node ? "/" + entry.node : ""}] ${entry.action}${tokens}${cost}${duration}${entry.toolName ? " tool=" + entry.toolName : ""}`,
  );
}

/**
 * Create a session logger for a specific agent run.
 */
export function createSessionLogger(agent: string, provider: string, model: string) {
  const sessionId = `${agent}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  return {
    sessionId,

    start(metadata?: Record<string, unknown>) {
      logAgentEvent({ sessionId, agent, model, provider, action: "start", metadata });
    },

    llmCall(node: string, inputTokens: number, outputTokens: number, durationMs: number, output?: string) {
      logAgentEvent({
        sessionId, agent, node, model, provider,
        action: "llm_call",
        inputTokens, outputTokens, durationMs,
        output: output?.slice(0, 500),
      });
    },

    toolCall(toolName: string, args: unknown) {
      logAgentEvent({
        sessionId, agent, model, provider,
        action: "tool_call",
        toolName,
        toolArgs: args,
      });
    },

    toolResult(toolName: string, result: string, durationMs?: number) {
      logAgentEvent({
        sessionId, agent, model, provider,
        action: "tool_result",
        toolName,
        toolResult: result.slice(0, 500),
        durationMs,
      });
    },

    validation(issues: string[]) {
      logAgentEvent({
        sessionId, agent, model, provider,
        action: "validation",
        metadata: { issues },
      });
    },

    error(message: string) {
      logAgentEvent({
        sessionId, agent, model, provider,
        action: "error",
        output: message,
      });
    },

    end(metadata?: Record<string, unknown>) {
      logAgentEvent({ sessionId, agent, model, provider, action: "end", metadata });
    },
  };
}
