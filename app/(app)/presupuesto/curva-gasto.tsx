"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { formatFecha, formatMonto } from "@/lib/format";

export function CurvaGasto({
  datos,
  objetivo,
}: {
  datos: { fecha: string; acumulado: number }[];
  objetivo: number;
}) {
  return (
    <div className="mt-2 h-56 w-full rounded-xl border border-border bg-card p-2 pr-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={datos}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="fecha"
            tickFormatter={(f: string) => formatFecha(f).slice(0, 5)}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
            width={36}
          />
          {objetivo > 0 && (
            <ReferenceLine
              y={objetivo}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              label={{
                value: "objetivo",
                position: "insideTopRight",
                fontSize: 11,
                fill: "var(--muted-foreground)",
              }}
            />
          )}
          <Tooltip
            labelFormatter={(f) => formatFecha(String(f))}
            formatter={(v) => [formatMonto(Number(v), "USD"), "Acumulado"]}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--border)",
              fontSize: 13,
            }}
          />
          <Line
            type="monotone"
            dataKey="acumulado"
            stroke="var(--data)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--data)" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
