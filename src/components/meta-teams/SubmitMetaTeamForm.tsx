"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SpeciesSearch } from "@/components/team-builder/SpeciesSearch";
import { PokemonSprite } from "@/components/pokemon-sprite";
import type { SpeciesData } from "@/lib/pokemon/species";

/**
 * Browser form for submitting a meta team to the shared pool.
 * Keeps it light — species + optional attribution. Item/moves are
 * skipped here; users can add those later from the team browser.
 */
export function SubmitMetaTeamForm({
  onSubmitted,
}: {
  onSubmitted?: () => void;
}) {
  const [species, setSpecies] = useState<string[]>(Array(6).fill(""));
  const [author, setAuthor] = useState("");
  const [record, setRecord] = useState("");
  const [archetype, setArchetype] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectSpecies = useCallback((index: number, s: SpeciesData) => {
    setSpecies((prev) => {
      const next = [...prev];
      next[index] = s.name;
      return next;
    });
  }, []);

  const clearSlot = useCallback((index: number) => {
    setSpecies((prev) => {
      const next = [...prev];
      next[index] = "";
      return next;
    });
  }, []);

  const filledSpecies = species.filter(Boolean);
  const canSubmit = filledSpecies.length >= 3 && status !== "sending";

  const submit = useCallback(async () => {
    setStatus("sending");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/meta-teams/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          species: filledSpecies,
          author: author || undefined,
          record: record || undefined,
          archetype: archetype || undefined,
          sourceUrl: sourceUrl || undefined,
          description: description || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data?.error ?? `submit failed with HTTP ${res.status}`,
        );
      }
      setStatus("done");
      // Reset
      setSpecies(Array(6).fill(""));
      setAuthor("");
      setRecord("");
      setArchetype("");
      setSourceUrl("");
      setDescription("");
      onSubmitted?.();
      // Clear the "done" banner after a moment
      setTimeout(() => setStatus("idle"), 2500);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }, [
    author,
    record,
    archetype,
    sourceUrl,
    description,
    filledSpecies,
    onSubmitted,
  ]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          Contribute a Meta Team
        </h3>
        <p className="text-xs text-muted-foreground">
          Seen a team at a tournament / stream / VGC Twitter? Drop the 6
          species so the coach can match future opponents against it.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {species.map((sp, i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-background p-2 min-h-[64px]"
          >
            {sp ? (
              <div className="flex items-center gap-2">
                <PokemonSprite species={sp} size={28} />
                <span className="text-xs font-medium text-foreground flex-1 min-w-0">
                  {sp}
                </span>
                <button
                  type="button"
                  onClick={() => clearSlot(i)}
                  className="text-[10px] text-muted-foreground hover:text-destructive cursor-pointer"
                >
                  ×
                </button>
              </div>
            ) : (
              <SpeciesSearch
                onChange={(s) => selectSpecies(i, s)}
                placeholder={`Pokemon ${i + 1}…`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="Player / creator (optional)"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
        />
        <Input
          placeholder='Record (e.g. "Top 8 @ Regional")'
          value={record}
          onChange={(e) => setRecord(e.target.value)}
        />
        <Input
          placeholder="Archetype (e.g. Rain HO)"
          value={archetype}
          onChange={(e) => setArchetype(e.target.value)}
        />
        <Input
          placeholder="Source URL (optional)"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
        />
      </div>
      <textarea
        placeholder="Strategy / notes (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="min-h-[60px] rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {filledSpecies.length}/6 species —{" "}
          {filledSpecies.length >= 3
            ? "ready to submit"
            : "need at least 3"}
        </span>
        <Button onClick={submit} disabled={!canSubmit}>
          {status === "sending" ? "Sending…" : "Submit"}
        </Button>
      </div>

      {status === "done" && (
        <p className="text-[11px] text-emerald-400">
          ✓ Thanks — team added to the pool.
        </p>
      )}
      {status === "error" && errorMsg && (
        <p className="text-[11px] text-destructive">{errorMsg}</p>
      )}
    </div>
  );
}
