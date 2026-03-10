"use client";

import * as React from "react";
import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface SubscaleScore {
  id: string;
  score: number;
  maxScore?: number;
}

interface ScoreRadarChartProps {
  subscales: SubscaleScore[];
  /** Display labels for subscale IDs, e.g. { depression: "Depresyon" } */
  labels?: Record<string, string>;
  totalScore?: number;
  maxTotalScore?: number;
  className?: string;
}

export function ScoreRadarChart({
  subscales,
  labels = {},
  totalScore,
  maxTotalScore,
  className,
}: ScoreRadarChartProps) {
  const displayLabel = (id: string) => {
    const k = id.toLowerCase().replace(/\s/g, "_");
    return labels[k] ?? labels[id] ?? id;
  };

  if (!subscales || subscales.length === 0) {
    if (totalScore != null) {
      const max = maxTotalScore ?? Math.max(totalScore * 1.2, 30);
      return (
        <div className={className}>
          <div className="flex items-center justify-center rounded-lg border bg-muted/30 p-6">
            <BarChart
              width={280}
              height={200}
              data={[{ name: "Toplam", score: totalScore }]}
              margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, max]} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => [v ?? 0, "Skor"]} />
              <Bar dataKey="score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </div>
        </div>
      );
    }
    return (
      <div className={className}>
        <div className="flex items-center justify-center rounded-lg border bg-muted/30 p-8 text-muted-foreground">
          Alt ölçek verisi yok
        </div>
      </div>
    );
  }

  const data = subscales.map((s) => ({
    subject: displayLabel(s.id),
    score: s.score,
    fullMark: s.maxScore ?? 42,
  }));

  const maxVal = Math.max(
    ...data.map((d) => d.fullMark),
    ...data.map((d) => d.score),
    1
  );

  return (
    <div className={className}>
      <div className="h-[280px] w-full min-w-0 sm:h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsRadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, maxVal]}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            />
            <Radar
              name="Skor"
              dataKey="score"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.4}
              strokeWidth={2}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--background))",
              }}
              formatter={(value) => [value ?? 0, "Skor"]}
            />
          </RechartsRadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
