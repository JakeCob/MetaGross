"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type {
  AgentChatMessage,
  AgentPersona,
  WriteActionProposal,
} from "@/lib/types/agent";
import type { PokemonPatchPayload } from "@/lib/ai/graph/team-patch";
import type { CardActions } from "./PokemonCardRenderer";
import { PersonaSelector } from "./PersonaSelector";
import { ModelSelector } from "./ModelSelector";
import { AgentMessageList, type StarterSuggestion } from "./AgentMessageList";
import { AgentComposer, type AgentAttachment } from "./AgentComposer";
import { ChatHistorySidebar } from "./ChatHistorySidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useModelPreference } from "@/stores/use-model-preference";

export interface DraftTeamSnapshot {
  name: string;
  format: string;
  pokemon: Array<{
    species?: string;
    ability?: string;
    item?: string;
    nature?: string;
    moves?: string[];
    evs?: Record<string, number>;
    ivs?: Record<string, number>;
    level?: number;
    teraType?: string;
  }>;
}

interface AgentPanelProps {
  contextType: "match" | "team" | "general";
  contextId?: string;
  cardActions?: CardActions;
  onSendMessage?: (message: string) => void;
  /** Starter chips shown in the empty state. Parent controls copy
   *  so each surface (team builder vs match analysis) can have its
   *  own nudges. */
  starterSuggestions?: StarterSuggestion[];
  /** Called once with the panel's internal sendMessage function so
   *  the parent can trigger follow-up prompts (e.g. "Make my version"
   *  from a ResearchTeamCard button) without mounting its own
   *  composer. */
  onSendMessageRef?: (fn: (message: string) => void) => void;
  /** Called right before every POST to /api/agent to capture the
   *  user's current draft team. Lets the agent patch the team the
   *  user is actively editing instead of generating new ones. */
  getDraftTeam?: () => DraftTeamSnapshot | null;
  /** Apply an approved patch proposal to the live TeamBuilder draft. */
  onApplyDraftPatch?: (payload: PokemonPatchPayload) => void;
}

interface SavedMemory {
  summary: string;
  kind: string;
  merged: boolean;
}

interface StreamEvent {
  type: "text" | "tool_call" | "tool_calls" | "tool_result" | "approval_required" | "pending_approval" | "done" | "error" | "thread" | "interrupted" | "status" | "memory_saved";
  content?: string;
  name?: string;
  args?: unknown;
  result?: unknown;
  calls?: { name: string; args: unknown; id?: string }[];
  proposal?: WriteActionProposal;
  threadId?: string;
  message?: string;
  memories?: SavedMemory[];
}

export function AgentPanel({
  contextType,
  contextId,
  cardActions,
  starterSuggestions,
  onSendMessageRef,
  getDraftTeam,
  onApplyDraftPatch,
}: AgentPanelProps) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const [pendingApproval, setPendingApproval] = useState<WriteActionProposal | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<AgentPersona>("default");
  const [error, setError] = useState<string | null>(null);
  // ChatGPT-style history sidebar state.
  const [historyOpen, setHistoryOpen] = useState(false);
  // Bumped after each successful send so the sidebar refetches and the
  // freshly-created thread shows up with its derived title.
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  // Most recent set of memories the extract_memory node persisted.
  // Rendered as a small toast at the bottom of the message list and
  // auto-clears after a few seconds.
  const [savedMemoriesToast, setSavedMemoriesToast] = useState<
    SavedMemory[] | null
  >(null);

  // User's LLM choice — forwarded with every /api/agent POST.
  const provider = useModelPreference((s) => s.provider);
  const modelId = useModelPreference((s) => s.modelId);

  // Track tool calls during streaming
  const toolCallsRef = useRef<{ name: string; args: unknown; result?: unknown }[]>([]);

  const sendMessage = useCallback(
    async (content: string, attachments: AgentAttachment[] = []) => {
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
        attachments: attachments.length > 0
          ? attachments.map((a) => ({
              name: a.name,
              mimeType: a.mimeType,
              dataUrl: a.dataUrl,
            }))
          : undefined,
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsStreaming(true);
      setStatusLog([]);
      toolCallsRef.current = [];

      let assistantContent = "";
      let newThreadId = threadId;

      // Snapshot the user's current draft team (if any) so the agent
      // can patch THIS team instead of inventing a new one. Filters
      // out empty slots so the agent sees only real Pokemon.
      let draftTeam: DraftTeamSnapshot | null = null;
      if (getDraftTeam) {
        const raw = getDraftTeam();
        if (raw) {
          const filled = raw.pokemon.filter(
            (p) => p.species && p.species.trim().length > 0,
          );
          if (filled.length > 0) {
            draftTeam = { name: raw.name, format: raw.format, pokemon: filled };
          }
        }
      }

      // Send images as inline data URLs. The /api/agent route forwards
      // them to invokeAgent, which wraps the user message in a
      // multimodal HumanMessage that both OpenAI and Anthropic vision
      // models accept directly.
      const attachmentPayload =
        attachments.length > 0
          ? attachments.map((a) => ({
              name: a.name,
              mimeType: a.mimeType,
              dataUrl: a.dataUrl,
            }))
          : undefined;

      try {
        const body = threadId
          ? {
              message: content,
              threadId,
              provider,
              modelName: modelId,
              ...(draftTeam ? { draftTeam } : {}),
              ...(attachmentPayload ? { attachments: attachmentPayload } : {}),
            }
          : {
              message: content,
              contextType,
              contextId,
              persona: selectedPersona,
              provider,
              modelName: modelId,
              ...(draftTeam ? { draftTeam } : {}),
              ...(attachmentPayload ? { attachments: attachmentPayload } : {}),
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

              case "memory_saved":
                if (Array.isArray(event.memories) && event.memories.length > 0) {
                  setSavedMemoriesToast(event.memories);
                  // Auto-clear after 8s so it doesn't linger across turns.
                  setTimeout(() => {
                    setSavedMemoriesToast((prev) =>
                      prev === event.memories ? null : prev,
                    );
                  }, 8000);
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
        // Refresh the sidebar after a successful send so the newly-titled
        // thread (or bumped updatedAt on an existing one) reorders.
        setHistoryRefreshKey((k) => k + 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send message");
      } finally {
        setIsStreaming(false);
      }
    },
    [threadId, contextType, contextId, selectedPersona, provider, modelId, getDraftTeam]
  );

  /**
   * Hydrate the panel from a saved thread. Fetches message history from
   * the checkpointer via GET /api/agent/[threadId] and replaces whatever
   * is currently in state.
   */
  const loadThread = useCallback(async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/agent/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        thread: { persona: string | null };
        messages: { role: string; content: string; toolCalls?: unknown[] }[];
        interrupted: boolean;
        pendingApproval: WriteActionProposal | null;
      };
      const now = Date.now();
      const replay: AgentChatMessage[] = data.messages
        // Tool messages are internal scratch; keep them out of the UI.
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m, i) => ({
          id: `${m.role}-${id}-${i}`,
          role: m.role as "user" | "assistant",
          content: m.content,
          toolCalls: Array.isArray(m.toolCalls)
            ? (m.toolCalls as { name: string; args: unknown; result?: unknown }[])
            : undefined,
          timestamp: now,
        }));
      setThreadId(id);
      setMessages(replay);
      setPendingApproval(data.pendingApproval);
      setStatusLog([]);
      if (data.thread.persona) {
        setSelectedPersona(data.thread.persona as AgentPersona);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load thread");
    }
  }, []);

  const handleNewChat = useCallback(() => {
    setThreadId(null);
    setMessages([]);
    setPendingApproval(null);
    setStatusLog([]);
    setError(null);
  }, []);

  // Expose sendMessage to the parent (if it passed onSendMessageRef) so
  // it can trigger follow-up prompts from UI actions like ResearchTeamCard
  // "Make my version".
  useEffect(() => {
    if (onSendMessageRef) onSendMessageRef(sendMessage);
  }, [onSendMessageRef, sendMessage]);

  const handleApprove = useCallback(async () => {
    if (!threadId) return;
    const proposal = pendingApproval;
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
      } else if (
        proposal?.actionType === "patch_team_pokemon" &&
        proposal.payload &&
        typeof proposal.payload === "object"
      ) {
        onApplyDraftPatch?.(proposal.payload as PokemonPatchPayload);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    }
  }, [threadId, pendingApproval, onApplyDraftPatch]);

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
        } else if (
          editedPayload &&
          typeof editedPayload === "object" &&
          "patch" in (editedPayload as Record<string, unknown>)
        ) {
          onApplyDraftPatch?.(editedPayload as PokemonPatchPayload);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Edit submission failed");
      }
    },
    [threadId, onApplyDraftPatch]
  );

  return (
    <div className="flex h-full flex-row rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
      {/* Chat history sidebar — collapsible on the left. */}
      {historyOpen && (
        <div className="hidden md:flex md:w-56 md:shrink-0 md:border-r md:border-border md:bg-muted/20">
          <ChatHistorySidebar
            contextType={contextType}
            contextId={contextId}
            activeThreadId={threadId}
            onSelectThread={(id) => void loadThread(id)}
            onNewChat={handleNewChat}
            refreshKey={historyRefreshKey}
          />
        </div>
      )}

      <div className="flex h-full min-w-0 flex-1 flex-col">
      {/* Header — history toggle + persona + model selectors. On
          phones we keep this strictly one row (no flex-wrap) so the
          header height stays predictable; selectors share the row by
          truncating their labels. */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border overflow-x-auto sm:gap-3 sm:flex-wrap sm:overflow-visible">
        <Button
          size="xs"
          variant="ghost"
          onClick={() => setHistoryOpen((o) => !o)}
          className="shrink-0"
          title={historyOpen ? "Hide chat history" : "Show chat history"}
          aria-label="Toggle chat history"
        >
          ☰
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={handleNewChat}
          className="shrink-0"
          title="Start a new chat"
        >
          + New chat
        </Button>
        <span className="hidden text-xs font-medium text-muted-foreground shrink-0 sm:inline">
          Persona:
        </span>
        <PersonaSelector value={selectedPersona} onChange={setSelectedPersona} />
        <span className="hidden text-xs font-medium text-muted-foreground shrink-0 sm:ml-auto sm:inline">
          Model:
        </span>
        <ModelSelector />
      </div>

      {/* Mobile history drawer — opens above the messages when toggled. */}
      {historyOpen && (
        <div className="md:hidden max-h-64 overflow-hidden border-b border-border bg-muted/20">
          <ChatHistorySidebar
            contextType={contextType}
            contextId={contextId}
            activeThreadId={threadId}
            onSelectThread={(id) => {
              void loadThread(id);
              setHistoryOpen(false);
            }}
            onNewChat={() => {
              handleNewChat();
              setHistoryOpen(false);
            }}
            refreshKey={historyRefreshKey}
          />
        </div>
      )}

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

      {/* Memory-saved toast — shows what the extract_memory node
          persisted on the last turn so users can confirm the
          cross-thread learning is working. Auto-dismisses in 8s. */}
      {savedMemoriesToast && savedMemoriesToast.length > 0 && (
        <div
          className="group flex items-start gap-2 border-t border-primary/20 bg-primary/5 px-3 py-2 text-xs"
          title={savedMemoriesToast
            .map(
              (m) =>
                `[${m.kind}${m.merged ? " · updated" : " · new"}] ${m.summary}`,
            )
            .join("\n")}
        >
          <span aria-hidden>💭</span>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-primary">
              Remembered {savedMemoriesToast.length}{" "}
              {savedMemoriesToast.length === 1 ? "thing" : "things"} from this chat
            </div>
            <div className="mt-0.5 truncate text-muted-foreground">
              {savedMemoriesToast.map((m) => m.summary).join(" · ")}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSavedMemoriesToast(null)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Composer */}
      <AgentComposer
        onSend={sendMessage}
        disabled={isStreaming || pendingApproval !== null}
        contextType={contextType}
      />
      </div>
    </div>
  );
}
