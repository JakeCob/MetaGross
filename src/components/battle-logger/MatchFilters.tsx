"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

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
      <div className="min-w-[180px] flex flex-col gap-1.5">
        <Label>Pokemon</Label>
        <Input
          placeholder="Filter by Pokemon..."
          value={filters.pokemon}
          onChange={(e) =>
            onFilterChange({ ...filters, pokemon: e.target.value })
          }
        />
      </div>

      {/* Date range */}
      <div className="min-w-[150px] flex flex-col gap-1.5">
        <Label>Date Range</Label>
        <Select
          value={filters.dateRange}
          onValueChange={(val: string | null) => {
            if (val) onFilterChange({
              ...filters,
              dateRange: val as MatchFilterState["dateRange"],
            });
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="7">Last 7 Days</SelectItem>
            <SelectItem value="30">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Format filter */}
      {formats.length > 0 && (
        <div className="min-w-[180px] flex flex-col gap-1.5">
          <Label>Format</Label>
          <Select
            value={filters.format}
            onValueChange={(val: string | null) => {
              if (val) onFilterChange({ ...filters, format: val });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Formats</SelectItem>
              {formats.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
