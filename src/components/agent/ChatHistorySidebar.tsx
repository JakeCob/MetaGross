"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export interface ThreadSummary {
  id: string;
  title: string | null;
  contextType: string | null;
  contextId: string | null;
  persona: string | null;
  provider: string | null;
  model: string | null;
  createdAt: number | null;
  updatedAt: number | null;
}

interface ChatHistorySidebarProps {
  contextType?: string;
  contextId?: string;
  /** Thread that's currently loaded in the panel. Highlighted in the list. */
  activeThreadId: string | null;
  /** Called when the user clicks a thread — parent rehydrates the panel. */
  onSelectThread: (threadId: string) => void;
  /** Called when the user taps "New chat" — parent resets to a blank state. */
  onNewChat: () => void;
  /** A monotonic counter — bump to force a refetch (e.g. after sending a
   *  message so the new thread shows up immediately). */
  refreshKey?: number;
}

function formatRelative(ts: number | null): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function ChatHistorySidebar({
  contextType,
  contextId,
  activeThreadId,
  onSelectThread,
  onNewChat,
  refreshKey = 0,
}: ChatHistorySidebarProps) {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (contextType) params.set("contextType", contextType);
      if (contextId) params.set("contextId", contextId);
      const qs = params.toString();
      const res = await fetch(`/api/threads${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { threads: ThreadSummary[] };
      setThreads(data.threads ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load threads");
    } finally {
      setLoading(false);
    }
  }, [contextType, contextId]);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Delete this chat? This can't be undone.")) return;
      try {
        const res = await fetch(`/api/agent/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // If the deleted thread was active, clear it so the panel resets.
        if (activeThreadId === id) onNewChat();
        await reload();
      } catch (err) {
        console.error("[ChatHistorySidebar] delete failed", err);
      }
    },
    [activeThreadId, onNewChat, reload],
  );

  const handleRenameStart = useCallback((thread: ThreadSummary) => {
    setEditingId(thread.id);
    setEditValue(thread.title ?? "");
  }, []);

  const handleRenameSubmit = useCallback(
    async (id: string) => {
      const title = editValue.trim();
      setEditingId(null);
      if (!title) return;
      try {
        const res = await fetch(`/api/agent/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await reload();
      } catch (err) {
        console.error("[ChatHistorySidebar] rename failed", err);
      }
    },
    [editValue, reload],
  );

  return (
    <div className="flex h-full w-full flex-col gap-2 p-2">
      <Button
        size="sm"
        variant="outline"
        onClick={onNewChat}
        className="w-full justify-start"
      >
        + New chat
      </Button>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="px-2 py-4 text-xs text-muted-foreground">
            Loading chats…
          </div>
        )}
        {error && (
          <div className="px-2 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
        {!loading && !error && threads.length === 0 && (
          <div className="px-2 py-4 text-xs text-muted-foreground">
            No chats yet. Say something below to start one.
          </div>
        )}
        <ul className="flex flex-col gap-0.5">
          {threads.map((t) => {
            const active = t.id === activeThreadId;
            const isEditing = editingId === t.id;
            return (
              <li
                key={t.id}
                className={`group rounded-md px-2 py-1.5 transition-colors ${
                  active
                    ? "bg-primary/10 ring-1 ring-primary/30"
                    : "hover:bg-muted/40"
                }`}
              >
                {isEditing ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleRenameSubmit(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleRenameSubmit(t.id);
                      } else if (e.key === "Escape") {
                        setEditingId(null);
                      }
                    }}
                    className="w-full rounded border border-border bg-background px-1 text-xs"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectThread(t.id)}
                    className="flex w-full flex-col items-start text-left"
                  >
                    <span className="line-clamp-2 text-xs font-medium text-foreground">
                      {t.title || "Untitled chat"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatRelative(t.updatedAt ?? t.createdAt)}
                    </span>
                  </button>
                )}
                {!isEditing && (
                  <div className="mt-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => handleRenameStart(t)}
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                      title="Rename"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(t.id)}
                      className="text-[10px] text-muted-foreground hover:text-destructive"
                      title="Delete"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
