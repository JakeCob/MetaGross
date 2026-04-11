"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PokemonSprite } from "@/components/pokemon-sprite";
import type { SpeciesData } from "@/lib/pokemon/species";

const TYPE_COLORS: Record<string, string> = {
  Normal: "bg-gray-500 text-white",
  Fire: "bg-orange-600 text-white",
  Water: "bg-blue-500 text-white",
  Electric: "bg-yellow-400 text-black",
  Grass: "bg-green-500 text-white",
  Ice: "bg-cyan-300 text-black",
  Fighting: "bg-red-700 text-white",
  Poison: "bg-purple-600 text-white",
  Ground: "bg-amber-700 text-white",
  Flying: "bg-indigo-300 text-black",
  Psychic: "bg-pink-500 text-white",
  Bug: "bg-lime-600 text-white",
  Rock: "bg-yellow-800 text-white",
  Ghost: "bg-purple-800 text-white",
  Dragon: "bg-violet-700 text-white",
  Dark: "bg-gray-800 text-white",
  Steel: "bg-gray-400 text-black",
  Fairy: "bg-pink-300 text-black",
};

export interface SpeciesSearchProps {
  onChange: (species: SpeciesData) => void;
  placeholder?: string;
}

interface UsageEntry {
  species: string;
  combinedUsage: number;
}

export function SpeciesSearch({
  onChange,
  placeholder = "Search Pokemon...",
}: SpeciesSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpeciesData[]>([]);
  const [suggestions, setSuggestions] = useState<SpeciesData[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [loadedSuggestions, setLoadedSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load top meta Pokemon as suggestions on first focus
  const loadSuggestions = useCallback(() => {
    if (loadedSuggestions) return;
    setLoadedSuggestions(true);

    fetch("/api/pokemon/usage?format=championspreview&top=20")
      .then((res) => res.json())
      .then((data) => {
        const entries: UsageEntry[] = data.pokemon || data.topUsage || [];
        if (entries.length === 0) return;

        // Fetch species data for top Pokemon
        const names = entries.slice(0, 15).map((e) => e.species);
        return Promise.all(
          names.map((name) =>
            fetch(`/api/pokemon/${encodeURIComponent(name)}`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null),
          ),
        ).then((speciesData) => {
          const valid = speciesData.filter(Boolean) as SpeciesData[];
          setSuggestions(valid);
        });
      })
      .catch(() => {});
  }, [loadedSuggestions]);

  const performSearch = useCallback((q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    fetch(`/api/pokemon/search?q=${encodeURIComponent(q)}&limit=20`)
      .then((res) => res.json())
      .then((data: SpeciesData[]) => {
        setResults(data);
        setHighlightIndex(-1);
      })
      .catch(() => {
        setResults([]);
      });
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        performSearch(value);
      }, 200);
    },
    [performSearch],
  );

  const handleSelect = useCallback(
    (species: SpeciesData) => {
      onChange(species);
      setQuery("");
      setResults([]);
      setIsOpen(false);
      setHighlightIndex(-1);
    },
    [onChange],
  );

  // Items to display: search results if typing, else suggestions
  const displayItems = query.trim() ? results : suggestions;
  const showDropdown = isOpen && displayItems.length > 0;
  const showingSearchResults = query.trim().length > 0;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showDropdown) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev < displayItems.length - 1 ? prev + 1 : 0,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev > 0 ? prev - 1 : displayItems.length - 1,
        );
      } else if (e.key === "Enter" && highlightIndex >= 0) {
        e.preventDefault();
        handleSelect(displayItems[highlightIndex]);
      } else if (e.key === "Escape") {
        setIsOpen(false);
        setHighlightIndex(-1);
      }
    },
    [showDropdown, displayItems, highlightIndex, handleSelect],
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setHighlightIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          loadSuggestions();
          setIsOpen(true);
        }}
        placeholder={placeholder}
        autoComplete="off"
      />

      {showDropdown && (
        <div className="absolute z-[100] mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-border bg-popover shadow-xl">
          {!showingSearchResults && (
            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border">
              Popular in Champions Reg M-A
            </div>
          )}
          {showingSearchResults && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              No results
            </div>
          )}
          {displayItems.map((species, i) => (
            <button
              key={species.name}
              type="button"
              onClick={() => handleSelect(species)}
              onMouseEnter={() => setHighlightIndex(i)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                i === highlightIndex
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground hover:bg-accent/50"
              }`}
            >
              <PokemonSprite species={species.name} size={32} />
              <span className="font-medium">{species.name}</span>
              <div className="ml-auto flex gap-1">
                {species.types.map((type) => (
                  <Badge
                    key={type}
                    className={`text-[10px] px-1.5 py-0 ${TYPE_COLORS[type] ?? "bg-gray-600 text-white"}`}
                  >
                    {type}
                  </Badge>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
