"use client";

import type { BenchmarkReport, Benchmark } from "@/lib/types/ev";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function BenchmarkItem({ benchmark }: { benchmark: Benchmark }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-border/50 last:border-0">
      <Badge
        variant={benchmark.met ? "success" : "error"}
        className="mt-0.5 shrink-0 text-[10px]"
      >
        {benchmark.met ? "PASS" : "FAIL"}
      </Badge>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-xs text-foreground leading-tight">
          {benchmark.description}
        </span>
        {benchmark.damageRange && (
          <span className="text-[10px] text-muted-foreground font-mono">
            {benchmark.damageRange[0]}% - {benchmark.damageRange[1]}%
          </span>
        )}
        {!benchmark.met &&
          benchmark.evRequired &&
          Object.keys(benchmark.evRequired).length > 0 && (
            <span className="text-[10px] text-muted-foreground">
              Needs:{" "}
              {Object.entries(benchmark.evRequired)
                .filter(([, v]) => v !== undefined && v > 0)
                .map(([k, v]) => `${v} ${k.toUpperCase()}`)
                .join(", ")}
            </span>
          )}
      </div>
    </div>
  );
}

function BenchmarkSection({
  title,
  benchmarks,
  icon,
}: {
  title: string;
  benchmarks: Benchmark[];
  icon: string;
}) {
  const passCount = benchmarks.filter((b) => b.met).length;

  if (benchmarks.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{icon}</span>
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          {passCount}/{benchmarks.length}
        </span>
      </div>
      <div className="flex flex-col">
        {benchmarks.map((b, i) => (
          <BenchmarkItem key={`${b.threat}-${b.move}-${i}`} benchmark={b} />
        ))}
      </div>
    </div>
  );
}

export interface BenchmarkListProps {
  report: BenchmarkReport;
}

export function BenchmarkList({ report }: BenchmarkListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Benchmarks: {report.pokemon}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <BenchmarkSection
            title="Survival"
            benchmarks={report.survivalBenchmarks}
            icon="🛡"
          />
          <BenchmarkSection
            title="KO Potential"
            benchmarks={report.koBenchmarks}
            icon="⚔"
          />
          <BenchmarkSection
            title="Speed"
            benchmarks={report.speedBenchmarks}
            icon="⚡"
          />

          {/* Suggested spread */}
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <div className="text-xs font-medium text-foreground mb-1.5">
              Suggested Spread
            </div>
            <div className="text-xs font-mono text-muted-foreground">
              {report.suggestedNature}{" "}
              {Object.entries(report.suggestedSpread)
                .filter(([, v]) => v > 0)
                .map(([k, v]) => `${v} ${k.toUpperCase()}`)
                .join(" / ")}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
