"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export interface MatchFilterState {
  result: "all" | "win" | "loss";
  pokemon: string;
  dateRange: "all" | "7" | "30";
  format: string;
}

export const defaultFilters: MatchFilterState = {
  result: "all",
  pokemon: "",
  dateRange: "all",
  format: "all",
};

interface MatchFiltersProps {
  filters: MatchFilterState;
  onFilterChange: (filters: MatchFilterState) => void;
  /** Available format options extracted from match data */
  formats: string[];
}

export function MatchFilters({
  filters,
  onFilterChange,
  formats,
}: MatchFiltersProps) {
  const resultOptions: { value: MatchFilterState["result"]; label: string }[] =
    [
      { value: "all", label: "All" },
      { value: "win", label: "Wins" },
      { value: "loss", label: "Losses" },
    ];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
      {/* Result toggle */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Result</span>
        <div className="flex gap-1">
          {resultOptions.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              size="sm"
              variant={filters.result === opt.value ? "default" : "outline"}
              onClick={() =>
                onFilterChange({ ...filters, result: opt.value })
              }
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Pokemon filter */}
      <div className="min-w-[180px]">
        <Input
          label="Pokemon"
          placeholder="Filter by Pokemon..."
          value={filters.pokemon}
          onChange={(e) =>
            onFilterChange({ ...filters, pokemon: e.target.value })
          }
        />
      </div>

      {/* Date range */}
      <div className="min-w-[150px]">
        <Select
          label="Date Range"
          value={filters.dateRange}
          onChange={(e) =>
            onFilterChange({
              ...filters,
              dateRange: e.target.value as MatchFilterState["dateRange"],
            })
          }
        >
          <option value="all">All Time</option>
          <option value="7">Last 7 Days</option>
          <option value="30">Last 30 Days</option>
        </Select>
      </div>

      {/* Format filter */}
      {formats.length > 0 && (
        <div className="min-w-[180px]">
          <Select
            label="Format"
            value={filters.format}
            onChange={(e) =>
              onFilterChange({ ...filters, format: e.target.value })
            }
          >
            <option value="all">All Formats</option>
            {formats.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </div>
      )}
    </div>
  );
}
