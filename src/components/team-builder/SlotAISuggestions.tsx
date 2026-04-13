"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PokemonSprite } from "@/components/pokemon-sprite";
import type { TeamPokemon } from "@/lib/types/pokemon";

interface SlotSuggestion {
  species: string;
  reason: string;
  category: string;
}

interface SlotAISuggestionsProps {
  currentTeam: string[]; // filled species names
  slot: number;
  format: string;
  onSelect: (species: string) => void; // called when user picks a suggestion
}

export function SlotAISuggestions({
  currentTeam,
  slot,
  format,
  onSelect,
}: SlotAISuggestionsProps) {
  const [suggestions, setSuggestions] = useState<SlotSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAskAI, setShowAskAI] = useState(false);
  const fetchedRef = useRef<string>("");

  // Fetch slot-specific suggestions
  useEffect(() => {
    const key = currentTeam.sort().join(",") + ":" + format;
    if (key === fetchedRef.current || currentTeam.length === 0) return;
    fetchedRef.current = key;

    setLoading(true);
    fetch("/api/teams/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team: currentTeam, format }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.suggestions) {
          setSuggestions(data.suggestions.slice(0, 5));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentTeam, format]);

  // Ask AI for a specific recommendation
  const runAskAI = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) return;
    setAiLoading(true);
    setAiResponse(null);

    try {
      const teamContext = currentTeam.length > 0
        ? `My current team: ${currentTeam.join(", ")}. Format: ${format}.`
        : `Format: ${format}. I'm building a new team.`;

      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `${teamContext} For slot ${slot}, ${q}. Suggest ONE specific Pokemon with a brief reason why. Be concise (2-3 sentences max).`,
          contextType: "team",
          persona: "default",
        }),
      });

      if (!res.ok || !res.body) {
        setAiResponse("AI assistant unavailable. Try the suggestions above.");
        return;
      }

      // Read SSE stream. Each event is: "event: <name>\ndata: <json>\n\n"
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Split on double-newline (SSE event delimiter)
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? ""; // keep incomplete trailing event

        for (const rawEvent of events) {
          if (!rawEvent.trim()) continue;
          let eventName = "message";
          let dataLine = "";
          for (const line of rawEvent.split("\n")) {
            if (line.startsWith("event: ")) eventName = line.slice(7).trim();
            else if (line.startsWith("data: ")) dataLine += line.slice(6);
          }
          if (!dataLine) continue;
          try {
            const data = JSON.parse(dataLine);
            if (eventName === "text" && typeof data.content === "string") {
              fullText = data.content; // final text is sent once at the end
            } else if (eventName === "error") {
              setAiResponse(`AI error: ${data.message ?? "unknown"}`);
              return;
            }
          } catch {
            // skip malformed data
          }
        }
      }

      setAiResponse(fullText || "No response from AI.");
    } catch {
      setAiResponse("Failed to reach AI assistant.");
    } finally {
      setAiLoading(false);
    }
  }, [currentTeam, format, slot]);

  const askAI = useCallback(() => {
    runAskAI(aiQuery);
  }, [runAskAI, aiQuery]);

  if (currentTeam.length === 0) return null;

  return (
    <div className="mb-4 space-y-3">
      {/* Slot-specific suggestions */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Suggested for Slot {slot}
        </p>
        {loading ? (
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-14 w-28 animate-pulse rounded-lg bg-muted"
              />
            ))}
          </div>
        ) : suggestions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s.species}
                type="button"
                onClick={() => onSelect(s.species)}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm transition-colors hover:border-primary hover:bg-accent/50 cursor-pointer"
                title={s.reason}
              >
                <PokemonSprite species={s.species} size={28} />
                <div className="min-w-0">
                  <span className="font-medium text-foreground">
                    {s.species}
                  </span>
                  <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                    {s.reason}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Add more Pokemon to get suggestions
          </p>
        )}
      </div>

      {/* Ask AI section */}
      <div>
        <button
          type="button"
          onClick={() => setShowAskAI(!showAskAI)}
          className="text-xs font-medium text-primary hover:underline cursor-pointer"
        >
          {showAskAI ? "Hide AI assistant" : "Ask AI for help..."}
        </button>

        {showAskAI && (
          <div className="mt-2 space-y-2">
            <div className="flex gap-2">
              <Input
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                placeholder="e.g., I need a Trick Room counter"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    askAI();
                  }
                }}
                className="text-sm"
              />
              <Button
                size="sm"
                onClick={askAI}
                disabled={aiLoading || !aiQuery.trim()}
              >
                {aiLoading ? "..." : "Ask"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                "I need a mega good with rain weather",
                "I need speed control",
                "I need a Fake Out user",
                "Counter Water types",
                "Trick Room setter",
              ].map((q) => (
                <Badge
                  key={q}
                  variant="secondary"
                  className="cursor-pointer text-[10px] hover:bg-primary/20"
                  onClick={() => {
                    setAiQuery(q);
                    setShowAskAI(true);
                    runAskAI(q);
                  }}
                >
                  {q}
                </Badge>
              ))}
            </div>
            {aiResponse && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-foreground">
                {aiResponse}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
