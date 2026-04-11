"use client";

import { useState, useCallback, useRef } from "react";
import type {
  AgentChatMessage,
  AgentPersona,
  WriteActionProposal,
} from "@/lib/types/agent";
import { PersonaSelector } from "./PersonaSelector";
import { AgentMessageList } from "./AgentMessageList";
import { AgentComposer } from "./AgentComposer";
import { Separator } from "@/components/ui/separator";

interface AgentPanelProps {
  contextType: "match" | "team" | "general";
  contextId?: string;
}

interface StreamEvent {
  type: "text" | "tool_call" | "tool_result" | "approval_required" | "done" | "error";
  content?: string;
  name?: string;
  args?: unknown;
  result?: unknown;
  proposal?: WriteActionProposal;
  threadId?: string;
}

export function AgentPanel({ contextType, contextId }: AgentPanelProps) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<WriteActionProposal | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<AgentPersona>("default");
  const [error, setError] = useState<string | null>(null);

  // Track tool calls during streaming
  const toolCallsRef = useRef<{ name: string; args: unknown; result?: unknown }[]>([]);

  const sendMessage = useCallback(
    async (content: string) => {
      setError(null);
      const userMessage: AgentChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsStreaming(true);
      toolCallsRef.current = [];

      let assistantContent = "";
      let newThreadId = threadId;

      try {
        const body = threadId
          ? { message: content, threadId }
          : { message: content, contextType, contextId, persona: selectedPersona };

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
          const lines = buffer.split("\n");
          // Keep the last incomplete line in buffer
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            let event: StreamEvent;
            try {
              event = JSON.parse(trimmed) as StreamEvent;
            } catch {
              continue;
            }

            switch (event.type) {
              case "text":
                assistantContent += event.content ?? "";
                // Update the assistant message in real-time
                setMessages((prev) => {
                  const existing = prev.find(
                    (m) => m.id === `assistant-${newThreadId ?? "pending"}`
                  );
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
                      id: `assistant-${newThreadId ?? "pending"}`,
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

              case "tool_result":
                toolCallsRef.current = toolCallsRef.current.map((tc) =>
                  tc.name === event.name && tc.result === undefined
                    ? { ...tc, result: event.result }
                    : tc
                );
                // Update the assistant message tool calls
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === `assistant-${newThreadId ?? "pending"}`
                      ? { ...m, toolCalls: [...toolCallsRef.current] }
                      : m
                  )
                );
                break;

              case "approval_required":
                if (event.proposal) {
                  setPendingApproval(event.proposal);
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === `assistant-${newThreadId ?? "pending"}`
                        ? { ...m, pendingApproval: event.proposal }
                        : m
                    )
                  );
                }
                break;

              case "done":
                if (event.threadId) {
                  newThreadId = event.threadId;
                  setThreadId(event.threadId);
                  // Update the assistant message ID to use the real thread ID
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === "assistant-pending"
                        ? { ...m, id: `assistant-${event.threadId}-${Date.now()}` }
                        : m
                    )
                  );
                }
                break;

              case "error":
                setError(event.content ?? "An error occurred");
                break;
            }
          }
        }

        // Finalize the assistant message
        if (assistantContent || toolCallsRef.current.length > 0) {
          setMessages((prev) => {
            const assistantId = `assistant-${newThreadId ?? "pending"}`;
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
                id: `assistant-${Date.now()}`,
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
    [threadId, contextType, contextId, selectedPersona]
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
      {/* Header with persona selector */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground shrink-0">
          Persona:
        </span>
        <PersonaSelector value={selectedPersona} onChange={setSelectedPersona} />
      </div>

      <Separator />

      {/* Messages */}
      <AgentMessageList
        messages={messages}
        isStreaming={isStreaming}
        pendingApproval={pendingApproval}
        onApprove={handleApprove}
        onReject={handleReject}
        onEdit={handleEdit}
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
