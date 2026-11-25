import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_AXIS, CHART_GRID, ChartTooltip } from "@/components/features/data";
import { formatDecimal } from "@/lib/format";
import type { AlertBudgetRow, ModelRow } from "@/types/api";

export function ModelRankingChart({ rows }: { rows: ModelRow[] }) {
  const data = rows
    .filter((row) => row.average_precision !== null)
    .map((row) => ({
      id: row.id,
      name: row.name,
      ap: row.average_precision ?? 0,
    }))
    .sort((a, b) => b.ap - a.ap);

  return (
    <div className="h-[360px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 28, bottom: 8, left: 8 }}>
          <CartesianGrid {...CHART_GRID} horizontal={false} />
          <XAxis
            type="number"
            {...CHART_AXIS}
            tickFormatter={(value) => Number(value).toFixed(2)}
            domain={[0, "dataMax"]}
          />
          <YAxis type="category" dataKey="id" width={52} {...CHART_AXIS} />
          <Tooltip
            cursor={{ fill: "var(--elevated)" }}
            content={
              <ChartTooltip
                formatter={(value) => formatDecimal(Number(value), 4)}
                labelFormatter={(label) => `${label} average precision`}
              />
            }
          />
          <Bar dataKey="ap" barSize={15} radius={[0, 3, 3, 0]}>
            {data.map((row) => (
              <Cell
                key={row.id}
                fill={row.id === "E2-D" ? "var(--chart-2)" : "var(--chart-1)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BudgetRecoveryChart({
  primary,
  baseline,
}: {
  primary: AlertBudgetRow[];
  baseline: AlertBudgetRow[];
}) {
  const baselineByBudget = new Map(baseline.map((row) => [row.budget, row.expected_true_positives]));
  const data = primary
    .filter((row) => row.budget <= 5000)
    .map((row) => ({
      budget: row.budget,
      e2d: row.expected_true_positives,
      e2a: baselineByBudget.get(row.budget) ?? 0,
    }));

  return (
    <div className="h-[360px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 20, bottom: 8, left: 0 }}>
          <CartesianGrid {...CHART_GRID} />
          <XAxis
            type="number"
            dataKey="budget"
            {...CHART_AXIS}
            domain={[0, 5000]}
            ticks={[100, 500, 1000, 2000, 5000]}
            tickFormatter={(value) => (Number(value) >= 1000 ? `${Number(value) / 1000}k` : String(value))}
          />
          <YAxis {...CHART_AXIS} domain={[0, 70]} width={36} />
          <Tooltip
            content={
              <ChartTooltip
                formatter={(value) => `${Number(value)} of 70`}
                labelFormatter={(label) => `Budget ${Number(label).toLocaleString()}`}
              />
            }
          />
          <ReferenceLine
            x={500}
            stroke="var(--chart-2)"
            strokeDasharray="4 4"
            label={{ value: "500", position: "top", fill: "var(--chart-2)", fontSize: 12 }}
          />
          <Line
            type="stepAfter"
            dataKey="e2d"
            name="E2-D"
            stroke="var(--chart-1)"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "var(--chart-1)" }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="stepAfter"
            dataKey="e2a"
            name="E2-A"
            stroke="var(--chart-5)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={{ r: 2.5, fill: "var(--chart-5)" }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
