"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  calculatePokemonUsage,
  type PokemonUsageStat,
} from "@/lib/utils/stats";

interface MatchData {
  myBrought: string[];
  myLeads: string[];
  result: string;
}

interface PokemonUsageTableProps {
  matches: MatchData[];
}

type SortKey = keyof Pick<
  PokemonUsageStat,
  | "species"
  | "timesBrought"
  | "timesLed"
  | "winRateWhenBrought"
  | "winRateWhenLed"
>;

export function PokemonUsageTable({ matches }: PokemonUsageTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("timesBrought");
  const [sortAsc, setSortAsc] = useState(false);

  const usage = useMemo(() => calculatePokemonUsage(matches), [matches]);

  const sorted = useMemo(() => {
    const list = [...usage];
    list.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortAsc
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return sortAsc
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
    return list;
  }, [usage, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const columns: { key: SortKey; label: string; className?: string }[] = [
    { key: "species", label: "Pokemon", className: "text-left" },
    { key: "timesBrought", label: "Brought" },
    { key: "timesLed", label: "Led" },
    { key: "winRateWhenBrought", label: "WR (Brought)" },
    { key: "winRateWhenLed", label: "WR (Led)" },
  ];

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return "";
    return sortAsc ? " \u25B2" : " \u25BC";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pokemon Usage</CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted">
            No Pokemon usage data available yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`px-3 py-2 text-xs font-medium text-muted uppercase tracking-wide cursor-pointer select-none hover:text-foreground transition-colors ${col.className ?? "text-right"}`}
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label}
                      {sortIndicator(col.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr
                    key={row.species}
                    className="border-b border-card-border/50 hover:bg-card-border/20 transition-colors"
                  >
                    <td className="px-3 py-2 font-medium text-foreground">
                      {row.species}
                    </td>
                    <td className="px-3 py-2 text-right text-foreground">
                      {row.timesBrought}
                    </td>
                    <td className="px-3 py-2 text-right text-foreground">
                      {row.timesLed}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <WinRateBadge value={row.winRateWhenBrought} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <WinRateBadge value={row.winRateWhenLed} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WinRateBadge({ value }: { value: number }) {
  let textColor = "text-foreground";
  if (value >= 60) textColor = "text-emerald-400";
  else if (value >= 50) textColor = "text-foreground";
  else if (value > 0) textColor = "text-red-400";

  return <span className={`font-medium ${textColor}`}>{value}%</span>;
}
