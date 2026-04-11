"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDownIcon, ChevronRightIcon, WrenchIcon } from "lucide-react";

interface ToolCall {
  name: string;
  args: unknown;
  result?: unknown;
  durationMs?: number;
}

interface AgentToolTraceProps {
  toolCalls: ToolCall[];
}

// Read tools are informational, write tools modify state
const WRITE_TOOLS = [
  "update_match_notes",
  "update_team_notes",
  "create_team_variant",
  "patch_team_pokemon",
];

function isWriteTool(name: string): boolean {
  return WRITE_TOOLS.some((t) => name.toLowerCase().includes(t));
}

function ToolCallItem({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const isWrite = isWriteTool(toolCall.name);

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors"
      >
        {expanded ? (
          <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <WrenchIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="font-mono text-xs flex-1 truncate">{toolCall.name}</span>
        <Badge variant={isWrite ? "warning" : "info"} className="text-[10px]">
          {isWrite ? "write" : "read"}
        </Badge>
        {toolCall.durationMs != null && (
          <span className="text-[10px] text-muted-foreground">
            {toolCall.durationMs}ms
          </span>
        )}
      </button>
      {expanded && (
        <div className="border-t border-border bg-muted/30 px-3 py-2 space-y-2">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground font-medium mb-1">
              Input
            </p>
            <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all text-foreground/80 font-mono">
              {JSON.stringify(toolCall.args, null, 2)}
            </pre>
          </div>
          {toolCall.result !== undefined && (
            <div>
              <p className="text-[10px] uppercase text-muted-foreground font-medium mb-1">
                Output
              </p>
              <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all text-foreground/80 font-mono">
                {typeof toolCall.result === "string"
                  ? toolCall.result
                  : JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AgentToolTrace({ toolCalls }: AgentToolTraceProps) {
  const [expanded, setExpanded] = useState(false);

  if (toolCalls.length === 0) return null;

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? (
          <ChevronDownIcon className="size-3.5" />
        ) : (
          <ChevronRightIcon className="size-3.5" />
        )}
        <WrenchIcon className="size-3.5" />
        <span>
          {toolCalls.length} tool call{toolCalls.length !== 1 ? "s" : ""}
        </span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {toolCalls.map((tc, i) => (
            <ToolCallItem key={`${tc.name}-${i}`} toolCall={tc} />
          ))}
        </div>
      )}
    </div>
  );
}
