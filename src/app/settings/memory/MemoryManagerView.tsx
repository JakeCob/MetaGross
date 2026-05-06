"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Memory {
  id: string;
  scope: string | null;
  kind: string | null;
  summary: string | null;
  content: string | null;
  confidence: number | null;
  sourceThreadId: string | null;
  createdAt: number | null;
  updatedAt: number | null;
}

interface Counts {
  total: number;
  byScope: Record<string, number>;
}

const KIND_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  preference: "secondary",
  strategy: "default",
  correction: "destructive",
  team_style: "secondary",
  opponent_pattern: "outline",
};

function formatDate(ts: number | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString();
}

export function MemoryManagerView() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [counts, setCounts] = useState<Counts>({ total: 0, byScope: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState({ summary: "", content: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/memories?limit=200");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { memories: Memory[]; counts: Counts };
      setMemories(Array.isArray(data.memories) ? data.memories : []);
      setCounts({
        total: data.counts?.total ?? 0,
        byScope: data.counts?.byScope ?? {},
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load memories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Forget this memory? The agent will no longer reference it.")) return;
      try {
        const res = await fetch(`/api/memories/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed");
      }
    },
    [load],
  );

  const handleEditStart = useCallback((m: Memory) => {
    setEditingId(m.id);
    setEditValue({ summary: m.summary ?? "", content: m.content ?? "" });
  }, []);

  const handleEditSubmit = useCallback(
    async (id: string) => {
      const summary = editValue.summary.trim();
      const content = editValue.content.trim();
      setEditingId(null);
      if (!summary || !content) return;
      try {
        const res = await fetch(`/api/memories/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ summary, content }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Update failed");
      }
    },
    [editValue, load],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Summary row */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          <strong className="text-foreground">{counts.total}</strong> total
        </span>
        {Object.entries(counts.byScope).map(([scope, n]) => (
          <Badge key={scope} variant="outline" className="text-[10px]">
            {scope}: {n}
          </Badge>
        ))}
      </div>

      {loading && (
        <div className="rounded-md border border-border p-6 text-center text-sm text-muted-foreground">
          Loading memories…
        </div>
      )}
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {!loading && memories.length === 0 && !error && (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No memories stored yet. The agent will start remembering preferences,
          corrections, and team-building style as you chat.
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {memories.map((m) => {
          const isEditing = editingId === m.id;
          const kindVariant = KIND_COLORS[m.kind ?? ""] ?? "outline";
          return (
            <li
              key={m.id}
              className="rounded-lg border border-border bg-card p-3"
            >
              <div className="flex items-start gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {m.kind && (
                      <Badge variant={kindVariant} className="text-[10px]">
                        {m.kind}
                      </Badge>
                    )}
                    {m.scope && (
                      <Badge variant="outline" className="text-[10px]">
                        {m.scope}
                      </Badge>
                    )}
                    {typeof m.confidence === "number" && (
                      <Badge variant="outline" className="text-[10px]">
                        confidence {Math.round(m.confidence * 100)}%
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(m.updatedAt ?? m.createdAt)}
                    </span>
                  </div>
                  {isEditing ? (
                    <div className="flex flex-col gap-1">
                      <input
                        value={editValue.summary}
                        onChange={(e) =>
                          setEditValue((v) => ({ ...v, summary: e.target.value }))
                        }
                        className="rounded border border-border bg-background px-2 py-1 text-sm font-medium"
                        placeholder="Summary"
                      />
                      <textarea
                        value={editValue.content}
                        onChange={(e) =>
                          setEditValue((v) => ({ ...v, content: e.target.value }))
                        }
                        rows={3}
                        className="rounded border border-border bg-background px-2 py-1 text-xs"
                        placeholder="Content"
                      />
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-foreground">
                        {m.summary}
                      </p>
                      {m.content && m.content !== m.summary && (
                        <p className="text-xs text-muted-foreground">
                          {m.content}
                        </p>
                      )}
                    </>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  {isEditing ? (
                    <>
                      <Button
                        size="xs"
                        variant="default"
                        onClick={() => void handleEditSubmit(m.id)}
                      >
                        Save
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => handleEditStart(m)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => void handleDelete(m.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        Forget
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
