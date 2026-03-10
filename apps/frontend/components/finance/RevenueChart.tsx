"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface RevenueChartDataPoint {
  month: string;
  monthLabel: string;
  totalRevenue: number;
  collected: number;
  pending: number;
}

interface RevenueChartProps {
  data: RevenueChartDataPoint[];
  className?: string;
}

export function RevenueChart({ data, className }: RevenueChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className={
          className
            ? `flex h-[280px] items-center justify-center rounded-lg border bg-muted/30 text-muted-foreground ${className}`
            : "flex h-[280px] items-center justify-center rounded-lg border bg-muted/30 text-muted-foreground"
        }
      >
        Henüz veri yok
      </div>
    );
  }

  return (
    <div className={className ?? "h-[280px] w-full min-w-0"}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="monthLabel"
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(v) => `₺${v}`}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--background))",
            }}
            formatter={(value: number | undefined) => [
              `₺${(value ?? 0).toLocaleString("tr-TR")}`,
              "",
            ]}
            labelFormatter={(label) => label}
          />
          <Line
            type="monotone"
            dataKey="collected"
            name="Tahsil"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="pending"
            name="Bekleyen"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
