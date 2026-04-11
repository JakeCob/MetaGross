"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
  ResponsiveContainer,
} from "recharts";

interface WinProbChartProps {
  data: { turn: number; probability: number }[];
  turningPoints: number[];
}

export function WinProbChart({ data, turningPoints }: WinProbChartProps) {
  const turningPointSet = new Set(turningPoints);

  // Split data into segments above and below 50% for coloring
  // We use a gradient approach with a single line + custom dot rendering
  const turningPointData = data.filter((d) => turningPointSet.has(d.turn));

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
        >
          <defs>
            <linearGradient id="winProbGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.8} />
              <stop offset="50%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
              <stop offset="50%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.8} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            opacity={0.3}
          />

          <XAxis
            dataKey="turn"
            label={{ value: "Turn", position: "insideBottom", offset: -5, style: { fill: "hsl(var(--muted-foreground))" } }}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            stroke="hsl(var(--border))"
          />

          <YAxis
            domain={[0, 100]}
            label={{ value: "Win %", angle: -90, position: "insideLeft", style: { fill: "hsl(var(--muted-foreground))" } }}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            stroke="hsl(var(--border))"
            ticks={[0, 25, 50, 75, 100]}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              color: "hsl(var(--foreground))",
              fontSize: "12px",
            }}
            formatter={(value) => [`${value}%`, "Win Probability"]}
            labelFormatter={(label) => `Turn ${label}`}
          />

          {/* 50% reference line */}
          <ReferenceLine
            y={50}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="6 4"
            opacity={0.5}
            label={{
              value: "50%",
              position: "left",
              style: { fill: "hsl(var(--muted-foreground))", fontSize: 11 },
            }}
          />

          {/* Win probability line */}
          <Line
            type="monotone"
            dataKey="probability"
            stroke="url(#winProbGradient)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{
              r: 5,
              fill: "hsl(var(--foreground))",
              stroke: "hsl(var(--background))",
              strokeWidth: 2,
            }}
          />

          {/* Turning point markers */}
          {turningPointData.map((point) => (
            <ReferenceDot
              key={`tp-${point.turn}`}
              x={point.turn}
              y={point.probability}
              r={6}
              fill={point.probability >= 50 ? "hsl(217, 91%, 60%)" : "hsl(0, 84%, 60%)"}
              stroke="hsl(var(--background))"
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
