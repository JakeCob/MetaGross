"use client";

import { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PokemonSprite } from "@/components/pokemon-sprite";
import type { SpeciesData } from "@/lib/pokemon/species";
import { CHAMPIONS_POKEMON, ACTIVE_REGULATION_LABEL } from "@/lib/data/champions";

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
  format?: string;
}

interface UsageEntry {
  species: string;
  combinedUsage: number;
}

const ARCHETYPE_HINTS = [
  "rain",
  "sun",
  "sand",
  "trick room",
  "hyper offense",
  "bulky",
  "fast",
  "tailwind",
  "fake out",
  "intimidate",
];

const CHAMPIONS_SPECIES_SET = new Set(
  CHAMPIONS_POKEMON.map((name) => name.toLowerCase()),
);

export function SpeciesSearch({
  onChange,
  placeholder = "Search Pokemon or type archetype (e.g. 'rain')...",
  format = "",
}: SpeciesSearchProps) {
  const isChampions = format.toLowerCase().startsWith("champions");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpeciesData[]>([]);
  const [suggestions, setSuggestions] = useState<SpeciesData[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [loadedSuggestions, setLoadedSuggestions] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setLoadedSuggestions(false);
    setSuggestions([]);
    setResults([]);
    setHighlightIndex(-1);
  }, [format]);

  // Calculate dropdown position (for portal rendering)
  const updateDropdownPos = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  }, []);

  // Load top meta Pokemon as suggestions on first focus
  const loadSuggestions = useCallback(() => {
    if (loadedSuggestions) return;
    setLoadedSuggestions(true);

    fetch("/api/pokemon/usage?format=championspreview&top=20")
      .then((res) => res.json())
      .then((data) => {
        const entries: UsageEntry[] = data.pokemon || data.topUsage || [];
        if (entries.length === 0) return;

        const names = entries
          .slice(0, 15)
          .map((e) => e.species)
          .filter((name) => !isChampions || CHAMPIONS_SPECIES_SET.has(name.toLowerCase()));
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
  }, [isChampions, loadedSuggestions]);

  const performSearch = useCallback((q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const params = new URLSearchParams({
      q,
      limit: "25",
    });
    if (format) params.set("format", format);

    fetch(`/api/pokemon/search?${params.toString()}`)
      .then((res) => res.json())
      .then((data: SpeciesData[]) => {
        setResults(Array.isArray(data) ? data : []);
        setHighlightIndex(-1);
      })
      .catch(() => {
        setResults([]);
      });
  }, [format]);

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

  const displayItems = query.trim() ? results : suggestions;
  const showDropdown = isOpen && mounted && dropdownPos !== null;
  const showingSearchResults = query.trim().length > 0;

  // Update position when the dropdown opens, on scroll, or on resize
  useLayoutEffect(() => {
    if (!isOpen) return;
    updateDropdownPos();

    const handle = () => updateDropdownPos();
    window.addEventListener("scroll", handle, true);
    window.addEventListener("resize", handle);
    return () => {
      window.removeEventListener("scroll", handle, true);
      window.removeEventListener("resize", handle);
    };
  }, [isOpen, updateDropdownPos]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || displayItems.length === 0) return;

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
    [isOpen, displayItems, highlightIndex, handleSelect],
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
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

  const onHintClick = (hint: string) => {
    setQuery(hint);
    performSearch(hint);
    inputRef.current?.focus();
  };

  const dropdownContent = showDropdown && dropdownPos && (
    <div
      ref={dropdownRef}
      style={{
        position: "absolute",
        top: `${dropdownPos.top}px`,
        left: `${dropdownPos.left}px`,
        width: `${dropdownPos.width}px`,
        zIndex: 9999,
      }}
      className="max-h-80 overflow-y-auto rounded-lg border border-border bg-popover shadow-xl"
    >
      {!showingSearchResults && (
        <>
          <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border">
            Popular in {ACTIVE_REGULATION_LABEL}
          </div>
          <div className="px-3 pt-2 pb-1 border-b border-border/50">
            <div className="text-[10px] text-muted-foreground mb-1">
              Try an archetype:
            </div>
            <div className="flex flex-wrap gap-1">
              {ARCHETYPE_HINTS.map((hint) => (
                <button
                  key={hint}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onHintClick(hint);
                  }}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-accent hover:bg-primary/20 cursor-pointer"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      {showingSearchResults && results.length === 0 && (
        <div className="px-4 py-3 text-sm text-muted-foreground">
          No results — try an archetype like &quot;rain&quot; or &quot;bulky&quot;
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
  );

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          loadSuggestions();
          updateDropdownPos();
          setIsOpen(true);
        }}
        placeholder={placeholder}
        autoComplete="off"
      />

      {/* Render dropdown via portal to escape Dialog's overflow clipping */}
      {showDropdown && mounted && createPortal(dropdownContent, document.body)}
    </div>
  );
}
