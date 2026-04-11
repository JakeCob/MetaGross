"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetaSpreadList } from "@/components/ev/MetaSpreadList";
import { BenchmarkList } from "@/components/ev/BenchmarkList";
import { SpreadComparison } from "@/components/ev/SpreadComparison";
import { getMetaSpreads, getMetaThreats } from "@/lib/ev/meta-lookup";
import { calculateBenchmarks } from "@/lib/ev/benchmark";
import type { TeamPokemon, EVSpread } from "@/lib/types/pokemon";
import type { MetaSpread, BenchmarkReport } from "@/lib/types/ev";

export interface EVSuggestionsPanelProps {
  pokemon: TeamPokemon;
  onApplySpread: (evs: EVSpread, nature: string) => void;
}

export function EVSuggestionsPanel({
  pokemon,
  onApplySpread,
}: EVSuggestionsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "meta" | "benchmarks" | "comparison"
  >("meta");

  const metaSpreads = useMemo(
    () => getMetaSpreads(pokemon.species),
    [pokemon.species],
  );

  const benchmarkReport: BenchmarkReport | null = useMemo(() => {
    if (!isOpen || !pokemon.species) return null;
    try {
      const threats = getMetaThreats();
      return calculateBenchmarks(pokemon, threats);
    } catch {
      return null;
    }
  }, [isOpen, pokemon]);

  const handleSelectMetaSpread = useCallback(
    (spread: MetaSpread) => {
      onApplySpread(spread.evs, spread.nature);
    },
    [onApplySpread],
  );

  if (!pokemon.species || metaSpreads.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-accent-foreground transition-colors cursor-pointer"
      >
        <span
          className={`text-xs transition-transform ${isOpen ? "rotate-90" : ""}`}
        >
          ▶
        </span>
        EV Suggestions
        <Badge variant="info" className="text-[10px]">
          {metaSpreads.length} spreads
        </Badge>
      </button>

      {isOpen && (
        <div className="flex flex-col gap-3 pl-4 border-l-2 border-border">
          {/* Tab navigation */}
          <div className="flex gap-1.5">
            {(
              [
                { key: "meta", label: "Meta Spreads" },
                { key: "benchmarks", label: "Benchmarks" },
                { key: "comparison", label: "Compare" },
              ] as const
            ).map((tab) => (
              <Button
                key={tab.key}
                type="button"
                variant={activeTab === tab.key ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab(tab.key)}
                className="text-xs h-7 px-2"
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === "meta" && (
            <MetaSpreadList
              species={pokemon.species}
              spreads={metaSpreads}
              onSelect={handleSelectMetaSpread}
            />
          )}

          {activeTab === "benchmarks" && benchmarkReport && (
            <BenchmarkList report={benchmarkReport} />
          )}

          {activeTab === "comparison" && benchmarkReport && (
            <SpreadComparison
              current={pokemon.evs}
              suggested={benchmarkReport.suggestedSpread}
              currentNature={pokemon.nature}
              suggestedNature={benchmarkReport.suggestedNature}
            />
          )}

          {activeTab === "comparison" && benchmarkReport && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onApplySpread(
                  benchmarkReport.suggestedSpread,
                  benchmarkReport.suggestedNature,
                )
              }
              className="text-xs h-8"
            >
              Apply Suggested Spread
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
