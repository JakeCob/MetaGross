import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync, appendFileSync } from "fs";
import { join } from "path";
import "server-only";

const KNOWLEDGE_DIR = join(process.cwd(), "docs", "agent-knowledge");
const FEEDBACK_LOG = join(KNOWLEDGE_DIR, "feedback-log.jsonl");

export interface FeedbackEntry {
  timestamp: string;
  type: "correction" | "preference" | "insight" | "bug";
  topic: string;
  content: string;
  source?: string;
}

// Reading from docs/agent-knowledge works on Vercel (the dir is in the
// deployment bundle), but writing doesn't — the serverless FS is
// read-only outside /tmp. ensureDir() is best-effort: it creates the
// dir locally and silently no-ops on serverless. saveFeedback /
// appendToKnowledge then become no-ops on Vercel — feedback that
// matters is also mirrored into agent_memories which IS persistent.
let writesDisabled = process.env.VERCEL === "1";

function ensureDir(): boolean {
  if (writesDisabled) return false;
  try {
    if (!existsSync(KNOWLEDGE_DIR)) {
      mkdirSync(KNOWLEDGE_DIR, { recursive: true });
    }
    return true;
  } catch {
    writesDisabled = true;
    return false;
  }
}

/**
 * Load ALL knowledge files and concatenate them as RAG context for the agent.
 */
export function loadKnowledgeContext(): string {
  // Reads from the bundled dir — no need to mkdir.
  const parts: string[] = ["# Agent Knowledge Base\n"];

  if (!existsSync(KNOWLEDGE_DIR)) return parts.join("");

  try {
    const files = readdirSync(KNOWLEDGE_DIR).filter(
      (f) => f.endsWith(".md") && !f.startsWith("."),
    );

    for (const file of files.sort()) {
      const content = readFileSync(join(KNOWLEDGE_DIR, file), "utf-8");
      parts.push(`\n## From: ${file}\n\n${content}\n`);
    }

    // Also include recent feedback log entries
    if (existsSync(FEEDBACK_LOG)) {
      const lines = readFileSync(FEEDBACK_LOG, "utf-8").trim().split("\n").filter(Boolean);
      if (lines.length > 0) {
        parts.push("\n## Recent User Feedback\n\n");
        // Last 30 entries
        for (const line of lines.slice(-30)) {
          try {
            const entry = JSON.parse(line) as FeedbackEntry;
            parts.push(`- **[${entry.type}]** ${entry.topic}: ${entry.content}\n`);
          } catch {
            // skip malformed
          }
        }
      }
    }
  } catch (err) {
    console.error("[knowledge] Failed to load:", err);
  }

  return parts.join("");
}

/**
 * Save a feedback entry to the persistent log.
 */
export function saveFeedback(entry: Omit<FeedbackEntry, "timestamp">): void {
  if (!ensureDir()) return; // serverless / read-only FS — feedback already
                            // captured in agent_memories (Turso).
  const full: FeedbackEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };
  try {
    appendFileSync(FEEDBACK_LOG, JSON.stringify(full) + "\n", "utf-8");
  } catch {
    writesDisabled = true;
  }
}

/**
 * Append a new section to a named knowledge file (or create it).
 */
export function appendToKnowledge(fileName: string, content: string): void {
  if (!ensureDir()) return;
  const path = join(KNOWLEDGE_DIR, fileName.endsWith(".md") ? fileName : `${fileName}.md`);
  const separator = existsSync(path) ? "\n---\n\n" : "";
  try {
    appendFileSync(path, separator + content + "\n", "utf-8");
  } catch {
    try {
      writeFileSync(path, content, "utf-8");
    } catch {
      writesDisabled = true;
    }
  }
}
