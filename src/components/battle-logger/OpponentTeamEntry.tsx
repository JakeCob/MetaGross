"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SpeciesSearch } from "@/components/team-builder/SpeciesSearch";
import { PokemonSprite } from "@/components/pokemon-sprite";
import { useMetaTeamMatch } from "@/hooks/use-meta-team-match";
import { useCommonTeammates } from "@/hooks/use-common-teammates";
import type { SpeciesData } from "@/lib/pokemon/species";
import type { TeamPokemon } from "@/lib/types/pokemon";
import type { MetaTeamMatch, MetaTeamPokemon } from "@/lib/meta-teams/types";

interface OpponentSlot {
  species: string;
  item: string;
  ability: string;
}

const emptySlot = (): OpponentSlot => ({
  species: "",
  item: "",
  ability: "",
});

export interface OpponentTeamEntryProps {
  onComplete: (team: Partial<TeamPokemon>[]) => void;
}

export function OpponentTeamEntry({ onComplete }: OpponentTeamEntryProps) {
  const [slots, setSlots] = useState<OpponentSlot[]>(() =>
    Array.from({ length: 6 }, emptySlot),
  );

  const filledSpecies = useMemo(
    () => slots.map((s) => s.species).filter(Boolean),
    [slots],
  );
  const filledCount = filledSpecies.length;
  const allFilled = filledCount === 6;

  const updateSlot = useCallback(
    (index: number, patch: Partial<OpponentSlot>) => {
      setSlots((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], ...patch };
        return next;
      });
    },
    [],
  );

  const handleSpeciesSelect = useCallback(
    (index: number, species: SpeciesData) => {
      updateSlot(index, {
        species: species.name,
        ability: species.abilities[0] ?? "",
      });
    },
    [updateSlot],
  );

  const clearSlot = useCallback((index: number) => {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = emptySlot();
      return next;
    });
  }, []);

  /** Add a species to the next empty slot. No-op if team is full or
   *  the species is already on the team. */
  const addSpeciesToNextEmpty = useCallback(
    (species: string, perMon?: MetaTeamPokemon) => {
      setSlots((prev) => {
        if (prev.some((s) => s.species.toLowerCase() === species.toLowerCase())) {
          return prev;
        }
        const nextIndex = prev.findIndex((s) => !s.species);
        if (nextIndex === -1) return prev;
        const next = [...prev];
        next[nextIndex] = {
          species,
          ability: perMon?.ability ?? "",
          item: perMon?.item ?? "",
        };
        return next;
      });
    },
    [],
  );

  const fillFromMetaTeam = useCallback(
    (match: MetaTeamMatch) => {
      setSlots((prev) => {
        const next = [...prev];
        const alreadyEntered = new Set(
          next
            .map((s) => s.species.toLowerCase())
            .filter(Boolean),
        );

        let slotIdx = next.findIndex((s) => !s.species);
        for (const sp of match.team.species) {
          if (slotIdx === -1 || slotIdx >= 6) break;
          if (alreadyEntered.has(sp.toLowerCase())) continue;
          const perMon = match.team.pokemon.find(
            (p) => p.species.toLowerCase() === sp.toLowerCase(),
          );
          next[slotIdx] = {
            species: sp,
            ability: perMon?.ability ?? "",
            item: perMon?.item ?? "",
          };
          alreadyEntered.add(sp.toLowerCase());
          // advance to next empty slot
          do {
            slotIdx++;
          } while (slotIdx < 6 && next[slotIdx]?.species);
        }
        return next;
      });
    },
    [],
  );

  const handleContinue = useCallback(() => {
    const team: Partial<TeamPokemon>[] = slots
      .filter((s) => s.species)
      .map((s) => ({
        species: s.species,
        item: s.item || undefined,
        ability: s.ability || undefined,
      })) as Partial<TeamPokemon>[];
    onComplete(team);
  }, [slots, onComplete]);

  return (
    <div className="space-y-4">
      <div className="mb-2">
        <h2 className="text-xl font-semibold text-foreground">
          Opponent Team (OTS)
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the 6 Pokemon visible on your opponent&apos;s team sheet.
        </p>
      </div>

      {/* Known meta-team matches — fires once 2+ species are entered. */}
      <MetaTeamMatchSection
        species={filledSpecies}
        onFill={fillFromMetaTeam}
      />

      {/* Common-teammates chips — shows who's typically paired with what's
          already entered, even when no full meta team matches. */}
      <CommonTeammatesSection
        species={filledSpecies}
        onPick={(s) => addSpeciesToNextEmpty(s)}
      />

      <div className="space-y-3">
        {slots.map((slot, i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-card p-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-background text-xs font-medium text-muted-foreground">
                {i + 1}
              </span>
              {slot.species ? (
                <div className="flex items-center gap-2 flex-1">
                  <PokemonSprite species={slot.species} size={22} />
                  <span className="font-medium text-sm text-foreground">
                    {slot.species}
                  </span>
                  <button
                    type="button"
                    onClick={() => clearSlot(i)}
                    className="ml-auto text-xs text-muted-foreground hover:text-destructive cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <div className="flex-1">
                  <SpeciesSearch
                    onChange={(species) => handleSpeciesSelect(i, species)}
                    placeholder={`Pokemon ${i + 1}...`}
                  />
                </div>
              )}
            </div>

            {slot.species && (
              <div className="grid grid-cols-2 gap-2 pl-8">
                <Input
                  placeholder="Item (optional)"
                  value={slot.item}
                  onChange={(e) => updateSlot(i, { item: e.target.value })}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Ability (optional)"
                  value={slot.ability}
                  onChange={(e) => updateSlot(i, { ability: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <span className="text-sm text-muted-foreground">
          {filledCount}/6 Pokemon entered
        </span>
        <Button onClick={handleContinue} disabled={!allFilled}>
          Continue
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MetaTeamMatchSection
// ---------------------------------------------------------------------------

function MetaTeamMatchSection({
  species,
  onFill,
}: {
  species: string[];
  onFill: (match: MetaTeamMatch) => void;
}) {
  const { matches, status } = useMetaTeamMatch(species);

  if (species.length < 2) return null;
  if (status === "idle") return null;

  return (
    <section className="rounded-xl border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
          Known meta teams
        </span>
        {status === "loading" && (
          <Badge variant="info" className="text-[9px] animate-pulse">
            Matching…
          </Badge>
        )}
        {status === "done" && matches.length === 0 && (
          <span className="text-[10px] text-muted-foreground">
            No known team matches these {species.length} species yet.
          </span>
        )}
        {status === "done" && matches.length > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {matches.length} match
            {matches.length === 1 ? "" : "es"} — tap to fill remaining slots.
          </span>
        )}
      </div>

      {matches.length > 0 && (
        <ul className="flex flex-col gap-2">
          {matches.slice(0, 4).map((match) => (
            <li
              key={match.team.id}
              className="rounded-lg border border-border bg-background p-2 flex items-center gap-2 flex-wrap"
            >
              <Badge
                variant="outline"
                className="text-[10px] uppercase tracking-wider"
              >
                {match.team.source}
              </Badge>
              {match.team.author && (
                <span className="text-[11px] font-semibold text-foreground">
                  {match.team.author}
                </span>
              )}
              {match.team.record && (
                <span className="text-[10px] text-muted-foreground">
                  {match.team.record}
                </span>
              )}
              {match.team.archetype && (
                <span className="text-[10px] text-muted-foreground italic">
                  {match.team.archetype}
                </span>
              )}
              <span className="text-[10px] text-primary ml-auto">
                {match.overlap}/{match.team.species.length} match
              </span>

              <div className="basis-full flex flex-wrap gap-1 mt-1">
                {match.team.species.map((sp) => {
                  const inQuery = species.some(
                    (q) => q.toLowerCase() === sp.toLowerCase(),
                  );
                  return (
                    <div
                      key={sp}
                      className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] ${
                        inQuery
                          ? "bg-primary/20 text-foreground"
                          : "bg-muted/30 text-muted-foreground"
                      }`}
                    >
                      <PokemonSprite species={sp} size={16} />
                      <span>{sp}</span>
                    </div>
                  );
                })}
              </div>

              <Button
                size="sm"
                variant="default"
                className="h-6 text-[10px] ml-auto"
                onClick={() => onFill(match)}
              >
                Fill remaining ({match.missing.length})
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// CommonTeammatesSection
// ---------------------------------------------------------------------------

function CommonTeammatesSection({
  species,
  onPick,
}: {
  species: string[];
  onPick: (species: string) => void;
}) {
  const { suggestions, status } = useCommonTeammates(species, 10);

  if (species.length === 0) return null;
  if (status === "idle") return null;
  if (status === "done" && suggestions.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-card/70 p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Common teammates
        </span>
        {status === "loading" && (
          <Badge variant="info" className="text-[9px] animate-pulse">
            Fetching…
          </Badge>
        )}
        <span className="text-[10px] text-muted-foreground">
          Tap to add to the next empty slot.
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button
            key={s.species}
            type="button"
            onClick={() => onPick(s.species)}
            className="flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1 text-[11px] text-foreground hover:border-primary/60 hover:bg-primary/10 cursor-pointer"
            title={`Cited by ${s.sources.join(", ")} (${Math.round(s.usage)}% usage)`}
          >
            <PokemonSprite species={s.species} size={18} />
            <span>{s.species}</span>
            <span className="text-[9px] text-muted-foreground">
              {Math.round(s.usage)}%
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
