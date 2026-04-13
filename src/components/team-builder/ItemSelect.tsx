"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  CHAMPIONS_ITEMS_CONFIRMED,
  CHAMPIONS_ITEMS_UNCERTAIN,
} from "@/lib/data/champions";

export interface ItemSelectProps {
  value: string;
  onChange: (item: string) => void;
  /** When true, suggestions are restricted to Champions-legal items. */
  championsOnly?: boolean;
  placeholder?: string;
}

export function ItemSelect({
  value,
  onChange,
  championsOnly = false,
  placeholder = "e.g., Choice Band",
}: ItemSelectProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setHighlight(-1);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pool = useMemo(() => {
    if (!championsOnly) return null;
    return {
      confirmed: CHAMPIONS_ITEMS_CONFIRMED,
      uncertain: CHAMPIONS_ITEMS_UNCERTAIN,
    };
  }, [championsOnly]);

  const filtered = useMemo(() => {
    if (!pool) return { confirmed: [], uncertain: [] };
    const q = value.trim().toLowerCase();
    const match = (n: string) => (q ? n.toLowerCase().includes(q) : true);
    return {
      confirmed: pool.confirmed.filter(match).slice(0, 40),
      uncertain: pool.uncertain.filter(match).slice(0, 10),
    };
  }, [pool, value]);

  const flatList = useMemo(
    () => [...filtered.confirmed, ...filtered.uncertain],
    [filtered],
  );

  const notLegal =
    championsOnly &&
    value.trim().length > 0 &&
    !CHAMPIONS_ITEMS_CONFIRMED.some(
      (i) => i.toLowerCase() === value.toLowerCase(),
    ) &&
    !CHAMPIONS_ITEMS_UNCERTAIN.some(
      (i) => i.toLowerCase() === value.toLowerCase(),
    );

  function pick(item: string) {
    onChange(item);
    setOpen(false);
    setHighlight(-1);
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || flatList.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((p) => (p < flatList.length - 1 ? p + 1 : 0));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((p) => (p > 0 ? p - 1 : flatList.length - 1));
          } else if (e.key === "Enter" && highlight >= 0) {
            e.preventDefault();
            pick(flatList[highlight]);
          } else if (e.key === "Escape") {
            setOpen(false);
            setHighlight(-1);
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
      />

      {notLegal && (
        <span className="text-[10px] text-amber-400 mt-1 block">
          ⚠ Not a confirmed Champions item
        </span>
      )}

      {open && championsOnly && flatList.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-border bg-popover shadow-xl">
          {filtered.confirmed.length > 0 && (
            <>
              <div className="px-3 py-1 text-[10px] font-medium text-muted-foreground border-b border-border/50">
                Champions-legal
              </div>
              {filtered.confirmed.map((item, i) => (
                <button
                  key={`c-${item}`}
                  type="button"
                  onClick={() => pick(item)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`flex w-full px-3 py-1.5 text-left text-sm cursor-pointer ${
                    i === highlight
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50"
                  }`}
                >
                  {item}
                </button>
              ))}
            </>
          )}
          {filtered.uncertain.length > 0 && (
            <>
              <div className="px-3 py-1 text-[10px] font-medium text-amber-400 border-b border-t border-border/50">
                Showdown-listed — may not exist on cartridge
              </div>
              {filtered.uncertain.map((item, i) => {
                const idx = filtered.confirmed.length + i;
                return (
                  <button
                    key={`u-${item}`}
                    type="button"
                    onClick={() => pick(item)}
                    onMouseEnter={() => setHighlight(idx)}
                    className={`flex w-full px-3 py-1.5 text-left text-sm cursor-pointer ${
                      idx === highlight
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50"
                    }`}
                  >
                    {item}
                    <span className="ml-auto text-[10px] text-amber-400">?</span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
