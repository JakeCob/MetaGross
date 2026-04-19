"use client";

import { useState, useCallback, useRef } from "react";
import type {
  AgentChatMessage,
  AgentPersona,
  WriteActionProposal,
} from "@/lib/types/agent";
import type { CardActions } from "./PokemonCardRenderer";
import { PersonaSelector } from "./PersonaSelector";
import { ModelSelector } from "./ModelSelector";
import { AgentMessageList, type StarterSuggestion } from "./AgentMessageList";
import { AgentComposer } from "./AgentComposer";
import { Separator } from "@/components/ui/separator";
import { useModelPreference } from "@/stores/use-model-preference";

interface AgentPanelProps {
  contextType: "match" | "team" | "general";
  contextId?: string;
  cardActions?: CardActions;
  onSendMessage?: (message: string) => void;
  /** Starter chips shown in the empty state. Parent controls copy
   *  so each surface (team builder vs match analysis) can have its
   *  own nudges. */
  starterSuggestions?: StarterSuggestion[];
}

interface StreamEvent {
  type: "text" | "tool_call" | "tool_calls" | "tool_result" | "approval_required" | "pending_approval" | "done" | "error" | "thread" | "interrupted" | "status";
  content?: string;
  name?: string;
  args?: unknown;
  result?: unknown;
  calls?: { name: string; args: unknown; id?: string }[];
  proposal?: WriteActionProposal;
  threadId?: string;
  message?: string;
}

export function AgentPanel({
  contextType,
  contextId,
  cardActions,
  starterSuggestions,
}: AgentPanelProps) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const [pendingApproval, setPendingApproval] = useState<WriteActionProposal | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<AgentPersona>("default");
  const [error, setError] = useState<string | null>(null);

  // User's LLM choice — forwarded with every /api/agent POST.
  const provider = useModelPreference((s) => s.provider);
  const modelId = useModelPreference((s) => s.modelId);

  // Track tool calls during streaming
  const toolCallsRef = useRef<{ name: string; args: unknown; result?: unknown }[]>([]);

  const sendMessage = useCallback(
    async (content: string) => {
      setError(null);
      // Unique per-turn id. The previous design used
      // `assistant-${threadId}` which collided across turns in the same
      // thread — streaming updates would overwrite the PREVIOUS
      // assistant message instead of creating a new one, making the
      // new response appear before the user's latest message.
      const assistantId = `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const userMessage: AgentChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsStreaming(true);
      setStatusLog([]);
      toolCallsRef.current = [];

      let assistantContent = "";
      let newThreadId = threadId;

      try {
        const body = threadId
          ? { message: content, threadId, provider, modelName: modelId }
          : {
              message: content,
              contextType,
              contextId,
              persona: selectedPersona,
              provider,
              modelName: modelId,
            };

        const response = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.error || `Request failed (${response.status})`);
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          // SSE format: "event: X\ndata: Y\n\n"
          // Split on double newlines to get complete events
          const blocks = buffer.split("\n\n");
          // Keep last incomplete block in buffer
          buffer = blocks.pop() ?? "";

          for (const block of blocks) {
            const blockLines = block.split("\n");
            let eventType = "";
            let dataStr = "";

            for (const line of blockLines) {
              if (line.startsWith("event: ")) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith("data: ")) {
                dataStr = line.slice(6);
              }
            }

            if (!eventType || !dataStr) continue;

            let data: Record<string, unknown>;
            try {
              data = JSON.parse(dataStr);
            } catch {
              continue;
            }

            // Map SSE event name to StreamEvent type
            const event: StreamEvent = { type: eventType as StreamEvent["type"], ...data } as StreamEvent;

            switch (event.type) {
              case "thread":
                if (data.threadId) {
                  newThreadId = data.threadId as string;
                  setThreadId(newThreadId);
                }
                break;

              case "interrupted":
                break;
              case "text":
                assistantContent += event.content ?? "";
                // Update the assistant message in real-time
                setMessages((prev) => {
                  const existing = prev.find((m) => m.id === assistantId);
                  if (existing) {
                    return prev.map((m) =>
                      m.id === existing.id
                        ? { ...m, content: assistantContent }
                        : m
                    );
                  }
                  return [
                    ...prev,
                    {
                      id: assistantId,
                      role: "assistant" as const,
                      content: assistantContent,
                      toolCalls: toolCallsRef.current,
                      timestamp: Date.now(),
                    },
                  ];
                });
                break;

              case "tool_call":
                toolCallsRef.current = [
                  ...toolCallsRef.current,
                  { name: event.name ?? "unknown", args: event.args },
                ];
                break;

              case "tool_calls":
                // Server sends tool_calls with a calls array
                if (event.calls && Array.isArray(event.calls)) {
                  for (const tc of event.calls) {
                    toolCallsRef.current = [
                      ...toolCallsRef.current,
                      { name: tc.name, args: tc.args },
                    ];
                  }
                }
                break;

              case "tool_result":
                toolCallsRef.current = toolCallsRef.current.map((tc) =>
                  tc.name === event.name && tc.result === undefined
                    ? { ...tc, result: event.result }
                    : tc
                );
                // Update the assistant message tool calls
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, toolCalls: [...toolCallsRef.current] }
                      : m
                  )
                );
                break;

              case "approval_required":
              case "pending_approval":
                {
                  // Server sends pending_approval with the proposal directly as data
                  const proposal = event.proposal ?? (data as unknown as WriteActionProposal);
                  if (proposal && typeof proposal === "object" && "actionType" in proposal) {
                    setPendingApproval(proposal as WriteActionProposal);
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantId
                          ? { ...m, pendingApproval: proposal as WriteActionProposal }
                          : m
                      )
                    );
                  }
                }
                break;

              case "status":
                {
                  const msg = (event as unknown as { message?: string }).message;
                  if (msg) {
                    setStatusLog((prev) => [...prev, msg].slice(-5)); // keep last 5
                  }
                }
                break;

              case "done":
                setStatusLog([]);
                if (event.threadId) {
                  newThreadId = event.threadId;
                  setThreadId(event.threadId);
                }
                break;

              case "error":
                setStatusLog([]);
                setError(event.content ?? event.message ?? "An error occurred");
                break;
            }
          }
        }

        // Finalize the assistant message — target the same id used
        // throughout streaming so we don't duplicate or clobber earlier
        // turns.
        if (assistantContent || toolCallsRef.current.length > 0) {
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === assistantId);
            if (exists) {
              return prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: assistantContent,
                      toolCalls: [...toolCallsRef.current],
                    }
                  : m
              );
            }
            return [
              ...prev,
              {
                id: assistantId,
                role: "assistant" as const,
                content: assistantContent,
                toolCalls: [...toolCallsRef.current],
                timestamp: Date.now(),
              },
            ];
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send message");
      } finally {
        setIsStreaming(false);
      }
    },
    [threadId, contextType, contextId, selectedPersona, provider, modelId]
  );

  const handleApprove = useCallback(async () => {
    if (!threadId) return;
    setPendingApproval(null);
    try {
      const res = await fetch(`/api/agent/${threadId}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Approval failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    }
  }, [threadId]);

  const handleReject = useCallback(async () => {
    if (!threadId) return;
    setPendingApproval(null);
    try {
      const res = await fetch(`/api/agent/${threadId}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Rejection failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rejection failed");
    }
  }, [threadId]);

  const handleEdit = useCallback(
    async (editedPayload: unknown) => {
      if (!threadId) return;
      setPendingApproval(null);
      try {
        const res = await fetch(`/api/agent/${threadId}/resume`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "edit", editedPayload }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error || "Edit submission failed");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Edit submission failed");
      }
    },
    [threadId]
  );

  return (
    <div className="flex h-full flex-col rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
      {/* Header — persona + model selectors */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border flex-wrap">
        <span className="text-xs font-medium text-muted-foreground shrink-0">
          Persona:
        </span>
        <PersonaSelector value={selectedPersona} onChange={setSelectedPersona} />
        <span className="text-xs font-medium text-muted-foreground shrink-0 ml-auto">
          Model:
        </span>
        <ModelSelector />
      </div>

      <Separator />

      {/* Messages */}
      <AgentMessageList
        messages={messages}
        isStreaming={isStreaming}
        statusLog={statusLog}
        pendingApproval={pendingApproval}
        onApprove={handleApprove}
        onReject={handleReject}
        onEdit={handleEdit}
        starterSuggestions={starterSuggestions}
        onPickStarter={(prompt) => sendMessage(prompt)}
        cardActions={{
          ...cardActions,
          onResuggest: cardActions?.onResuggest ?? ((species: string) => {
            sendMessage(`Suggest a different Pokemon to replace ${species} on the team`);
          }),
          onChangeField: cardActions?.onChangeField ?? ((species: string, _field: string, prompt: string) => {
            sendMessage(prompt);
          }),
          onAnswerQuestion:
            cardActions?.onAnswerQuestion ??
            ((value: string) => {
              // Tapping an ask-user-question chip sends the answer as
              // the next user message so the agent keeps rolling
              // without the user having to type.
              sendMessage(value);
            }),
        }}
      />

      {/* Error display */}
      {error && (
        <div className="px-3 py-2 text-xs text-destructive bg-destructive/5 border-t border-destructive/20">
          {error}
        </div>
      )}

      {/* Composer */}
      <AgentComposer
        onSend={sendMessage}
        disabled={isStreaming || pendingApproval !== null}
        contextType={contextType}
      />
    </div>
  );
}
