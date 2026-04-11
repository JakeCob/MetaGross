"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import type { AgentChatMessage, WriteActionProposal } from "@/lib/types/agent";
import { AgentApprovalCard } from "./AgentApprovalCard";
import { AgentToolTrace } from "./AgentToolTrace";
import { BotIcon, UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentMessageListProps {
  messages: AgentChatMessage[];
  isStreaming: boolean;
  onApprove: () => void;
  onReject: () => void;
  onEdit: (editedPayload: unknown) => void;
  pendingApproval: WriteActionProposal | null;
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
}: AgentMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-12 text-center">
        <BotIcon className="size-10 text-muted-foreground/50" />
        <div>
          <p className="text-sm font-medium text-foreground">Ask MetaGross</p>
          <p className="text-xs text-muted-foreground mt-1">
            Get AI-powered analysis, team advice, and match insights.
          </p>
        </div>
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
                    <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:mt-4 prose-headings:mb-1 prose-headings:first:mt-0 prose-h3:text-base prose-h3:font-bold prose-h3:text-primary prose-h3:border-b prose-h3:border-primary/20 prose-h3:pb-1 prose-h4:text-sm prose-h4:font-semibold prose-h4:text-foreground prose-strong:text-foreground prose-strong:font-semibold prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:rounded">
                      <ReactMarkdown>{msg.content || ""}</ReactMarkdown>
                    </div>
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

      {/* Streaming indicator */}
      {isStreaming && (
        <div className="flex justify-start">
          <div className="flex items-end gap-2">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
              <BotIcon className="size-3.5 text-muted-foreground" />
            </div>
            <div className="rounded-2xl rounded-bl-md bg-card ring-1 ring-foreground/10 px-3 py-2">
              <div className="flex items-center gap-1">
                <span className={cn("size-1.5 rounded-full bg-muted-foreground animate-bounce")} style={{ animationDelay: "0ms" }} />
                <span className={cn("size-1.5 rounded-full bg-muted-foreground animate-bounce")} style={{ animationDelay: "150ms" }} />
                <span className={cn("size-1.5 rounded-full bg-muted-foreground animate-bounce")} style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
