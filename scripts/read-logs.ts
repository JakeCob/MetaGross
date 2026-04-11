/**
 * Pretty-print agent logs.
 * Usage: npx tsx scripts/read-logs.ts [date]
 * Example: npx tsx scripts/read-logs.ts 2026-04-11
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const date = process.argv[2] || new Date().toISOString().split("T")[0];
const logFile = join(process.cwd(), "data", "logs", "agents", `${date}.jsonl`);

if (!existsSync(logFile)) {
  console.error(`No log file found for ${date}`);
  console.error(`Expected: ${logFile}`);
  process.exit(1);
}

const lines = readFileSync(logFile, "utf-8").trim().split("\n");

interface LogEntry {
  timestamp: string;
  sessionId: string;
  agent: string;
  node?: string;
  model: string;
  provider: string;
  action: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  durationMs?: number;
  output?: string;
  toolName?: string;
  toolArgs?: unknown;
  toolResult?: string;
  metadata?: Record<string, unknown>;
}

const entries: LogEntry[] = lines.map((l) => JSON.parse(l));

// Group by session
const sessions = new Map<string, LogEntry[]>();
for (const entry of entries) {
  const key = entry.sessionId;
  if (!sessions.has(key)) sessions.set(key, []);
  sessions.get(key)!.push(entry);
}

let totalCost = 0;
let totalInputTokens = 0;
let totalOutputTokens = 0;

console.log(`\n📋 Agent Logs for ${date}`);
console.log(`${"═".repeat(70)}\n`);

for (const [sessionId, events] of sessions) {
  const agent = events[0].agent;
  const model = events[0].model;
  const provider = events[0].provider;
  const startEvent = events.find((e) => e.action === "start");
  const endEvent = events.find((e) => e.action === "end");

  const species = (startEvent?.metadata?.species || endEvent?.metadata?.species || "") as string;
  const duration = endEvent?.metadata?.durationMs as number | undefined;

  console.log(`┌─ Session: ${sessionId.slice(0, 20)}...`);
  console.log(`│  Agent: ${agent} | Model: ${model} | Provider: ${provider}`);
  if (species) console.log(`│  Pokemon: ${species}`);
  console.log(`│`);

  let sessionCost = 0;

  for (const event of events) {
    const time = new Date(event.timestamp).toLocaleTimeString();
    const emoji =
      event.action === "llm_call" ? "🤖" :
      event.action === "tool_call" ? "🔧" :
      event.action === "tool_result" ? "📋" :
      event.action === "validation" ? "✅" :
      event.action === "error" ? "❌" :
      event.action === "start" ? "▶️" :
      event.action === "end" ? "⏹️" : "  ";

    const cost = event.costUsd || 0;
    sessionCost += cost;
    totalCost += cost;
    totalInputTokens += event.inputTokens || 0;
    totalOutputTokens += event.outputTokens || 0;

    let detail = "";

    switch (event.action) {
      case "llm_call":
        detail = `${event.inputTokens}→${event.outputTokens} tokens | $${cost.toFixed(4)} | ${event.durationMs}ms`;
        if (event.output) detail += `\n│     Response: ${event.output.slice(0, 100)}${event.output.length > 100 ? "..." : ""}`;
        break;
      case "tool_call":
        detail = `${event.toolName}(${JSON.stringify(event.toolArgs).slice(0, 80)})`;
        break;
      case "tool_result":
        const result = event.toolResult || "";
        detail = `${event.toolName} → ${result.slice(0, 100)}${result.length > 100 ? "..." : ""}`;
        if (event.durationMs) detail += ` (${event.durationMs}ms)`;
        break;
      case "validation": {
        const meta = event.metadata || {};
        if (meta.passed) {
          detail = "PASSED ✓";
        } else {
          const issues = (meta.issues as string[]) || [];
          detail = `FAILED — ${issues.length} issue(s):\n${issues.map((i) => `│       - ${i}`).join("\n")}`;
        }
        break;
      }
      case "start":
        detail = event.metadata ? JSON.stringify(event.metadata) : "";
        break;
      case "end":
        if (event.metadata) {
          const m = event.metadata;
          const parts: string[] = [];
          if (m.iterations) parts.push(`${m.iterations} iteration(s)`);
          if (m.durationMs) parts.push(`${m.durationMs}ms total`);
          if (m.finalSpread) parts.push(`Spread: ${JSON.stringify(m.finalSpread)}`);
          detail = parts.join(" | ");
        }
        break;
      case "error":
        detail = event.output || "Unknown error";
        break;
    }

    console.log(`│  ${emoji} [${time}] ${event.node ? event.node + " → " : ""}${event.action}`);
    if (detail) console.log(`│     ${detail}`);
  }

  console.log(`│`);
  console.log(`│  💰 Session cost: $${sessionCost.toFixed(4)}${duration ? ` | Duration: ${(duration as number / 1000).toFixed(1)}s` : ""}`);
  console.log(`└${"─".repeat(69)}\n`);
}

console.log(`${"═".repeat(70)}`);
console.log(`📊 Summary for ${date}:`);
console.log(`   Sessions: ${sessions.size}`);
console.log(`   Total events: ${entries.length}`);
console.log(`   Input tokens: ${totalInputTokens.toLocaleString()}`);
console.log(`   Output tokens: ${totalOutputTokens.toLocaleString()}`);
console.log(`   Total cost: $${totalCost.toFixed(4)}`);
console.log(`${"═".repeat(70)}\n`);
