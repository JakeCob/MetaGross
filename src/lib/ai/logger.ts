import { existsSync, mkdirSync, appendFileSync } from "fs";
import { join } from "path";

const LOG_DIR = join(process.cwd(), "data", "logs", "agents");
// Vercel and other read-only serverless filesystems can't host a logs
// directory. Detect once on cold-start and skip filesystem writes
// entirely there — Vercel captures console.log to its own log
// aggregator, so we lose nothing useful.
const FILE_LOGGING_DISABLED =
  process.env.VERCEL === "1" || process.env.NEXT_RUNTIME === "edge";
let fileLoggingBroken = FILE_LOGGING_DISABLED;

function ensureLogDir(): boolean {
  if (fileLoggingBroken) return false;
  try {
    if (!existsSync(LOG_DIR)) {
      mkdirSync(LOG_DIR, { recursive: true });
    }
    return true;
  } catch {
    // Read-only FS or permission error. Stop trying for the rest of
    // the process lifetime so we don't spam the console.
    fileLoggingBroken = true;
    return false;
  }
}

export interface AgentLogEntry {
  timestamp: string;
  sessionId: string;
  agent: string;
  node?: string;
  model: string;
  provider: string;
  action: "llm_call" | "tool_call" | "tool_result" | "validation" | "error" | "start" | "end" | "memory_extraction";
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
 * Get today's log file path, or null when file logging is unavailable
 * (read-only FS / serverless).
 */
function getLogFilePath(): string | null {
  if (!ensureLogDir()) return null;
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

  if (logFile) {
    try {
      appendFileSync(logFile, line, "utf-8");
    } catch {
      // Stop trying after the first failure — typically read-only FS.
      fileLoggingBroken = true;
    }
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
