"use client";

import { useEffect, useRef } from "react";
import type { AgentChatMessage, WriteActionProposal } from "@/lib/types/agent";
import { PokemonCardRenderer, type CardActions } from "./PokemonCardRenderer";
import { AgentApprovalCard } from "./AgentApprovalCard";
import { AgentToolTrace } from "./AgentToolTrace";
import { BotIcon, UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StarterSuggestion {
  /** Short chip label shown to the user. */
  label: string;
  /** The full prompt sent to the agent when the chip is tapped. */
  prompt: string;
}

interface AgentMessageListProps {
  messages: AgentChatMessage[];
  isStreaming: boolean;
  statusLog?: string[];
  onApprove: () => void;
  onReject: () => void;
  onEdit: (editedPayload: unknown) => void;
  pendingApproval: WriteActionProposal | null;
  cardActions?: CardActions;
  /** Tappable chips shown in the empty state. Parent chooses the copy. */
  starterSuggestions?: StarterSuggestion[];
  /** Called when the user taps a starter chip — the parent forwards
   *  the prompt to the composer / agent. */
  onPickStarter?: (prompt: string) => void;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AgentMessageList({
  messages,
  isStreaming,
  onApprove,
  onReject,
  onEdit,
  pendingApproval,
  cardActions,
  statusLog = [],
  starterSuggestions,
  onPickStarter,
}: AgentMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  if (messages.length === 0 && !isStreaming) {
    const chips = starterSuggestions ?? [];
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center">
        <BotIcon className="size-10 text-muted-foreground/50" />
        <div>
          <p className="text-sm font-medium text-foreground">Ask MetaGross</p>
          <p className="text-xs text-muted-foreground mt-1">
            Get AI-powered analysis, team advice, and match insights.
          </p>
        </div>
        {chips.length > 0 && (
          <div className="flex max-w-sm flex-col gap-1.5 w-full">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Try asking
            </span>
            {chips.map((chip, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onPickStarter?.(chip.prompt)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-left text-xs text-foreground hover:border-primary/60 hover:bg-primary/10 cursor-pointer"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
      {messages.map((msg) => (
        <div key={msg.id}>
          {msg.role === "user" && (
            <div className="flex justify-end">
              <div className="flex items-end gap-2 max-w-[80%]">
                <div className="rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground">
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p className="mt-1 text-[10px] opacity-70">
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20">
                  <UserIcon className="size-3.5 text-primary" />
                </div>
              </div>
            </div>
          )}

          {msg.role === "assistant" && (
            <div className="flex justify-start">
              <div className="flex items-end gap-2 max-w-[80%]">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
                  <BotIcon className="size-3.5 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <div className="rounded-2xl rounded-bl-md bg-card ring-1 ring-foreground/10 px-3 py-2 text-sm text-card-foreground">
                    <PokemonCardRenderer content={msg.content || ""} actions={cardActions} />
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <AgentToolTrace toolCalls={msg.toolCalls} />
                  )}
                  {msg.pendingApproval && (
                    <AgentApprovalCard
                      proposal={msg.pendingApproval}
                      onApprove={onApprove}
                      onReject={onReject}
                      onEdit={onEdit}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {msg.role === "tool" && (
            <div className="flex justify-start pl-8">
              <div className="max-w-[80%]">
                <AgentToolTrace
                  toolCalls={
                    msg.toolCalls ?? [
                      { name: "tool", args: {}, result: msg.content },
                    ]
                  }
                />
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Pending approval at bottom if not attached to a message */}
      {pendingApproval &&
        !messages.some((m) => m.pendingApproval === pendingApproval) && (
          <div className="flex justify-start pl-8">
            <div className="max-w-[80%]">
              <AgentApprovalCard
                proposal={pendingApproval}
                onApprove={onApprove}
                onReject={onReject}
                onEdit={onEdit}
              />
            </div>
          </div>
        )}

      {/* Streaming indicator with status log */}
      {isStreaming && (
        <div className="flex justify-start">
          <div className="flex items-end gap-2 max-w-[80%]">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
              <BotIcon className="size-3.5 text-muted-foreground" />
            </div>
            <div className="rounded-2xl rounded-bl-md bg-card ring-1 ring-foreground/10 px-3 py-2 min-w-0">
              <div className="flex items-center gap-1 mb-1">
                <span className={cn("size-1.5 rounded-full bg-muted-foreground animate-bounce")} style={{ animationDelay: "0ms" }} />
                <span className={cn("size-1.5 rounded-full bg-muted-foreground animate-bounce")} style={{ animationDelay: "150ms" }} />
                <span className={cn("size-1.5 rounded-full bg-muted-foreground animate-bounce")} style={{ animationDelay: "300ms" }} />
              </div>
              {statusLog.length > 0 && (
                <div className="space-y-0.5">
                  {statusLog.map((msg, i) => {
                    const isLast = i === statusLog.length - 1;
                    return (
                      <div
                        key={`${i}-${msg}`}
                        className={cn(
                          "text-[11px] flex items-center gap-1.5 break-words",
                          isLast ? "text-foreground animate-pulse" : "text-muted-foreground opacity-60"
                        )}
                      >
                        <span className="shrink-0">{isLast ? "⚡" : "✓"}</span>
                        <span>{msg}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
