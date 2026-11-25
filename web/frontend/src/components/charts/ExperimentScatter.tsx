import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_AXIS, CHART_GRID } from "@/components/features/data";
import type { ExperimentSummary } from "@/types/api";

interface Point {
  id: string;
  name: string;
  group: string;
  roc: number;
  ap: number;
}

function ScatterTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: readonly { payload?: Point }[];
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-lg border border-border bg-elevated px-3 py-2.5 shadow-md">
      <div className="font-mono text-[12px] text-foreground">{point.id}</div>
      <div className="mt-0.5 max-w-[220px] text-[12px] text-muted-foreground">{point.name}</div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
        <span className="text-muted-foreground">ROC-AUC</span>
        <span className="text-right font-mono tabular text-foreground">{point.roc.toFixed(4)}</span>
        <span className="text-muted-foreground">Average precision</span>
        <span className="text-right font-mono tabular text-foreground">{point.ap.toFixed(4)}</span>
        <span className="text-muted-foreground">Group</span>
        <span className="text-right text-foreground">{point.group}</span>
      </div>
    </div>
  );
}

export function ExperimentScatter({ experiments }: { experiments: ExperimentSummary[] }) {
  const points: Point[] = experiments
    .filter(
      (experiment) =>
        experiment.roc_auc !== null && experiment.average_precision !== null,
    )
    .map((experiment) => ({
      id: experiment.id,
      name: experiment.name,
      group: experiment.group,
      roc: experiment.roc_auc ?? 0,
      ap: experiment.average_precision ?? 0,
    }));

  const highlighted = points.filter((point) => point.id === "E2-D");
  const others = points.filter((point) => point.id !== "E2-D");

  return (
    <div className="h-[360px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 20, bottom: 12, left: 0 }}>
          <CartesianGrid {...CHART_GRID} />
          <XAxis
            type="number"
            dataKey="roc"
            name="ROC-AUC"
            domain={[0.8, 1]}
            ticks={[0.8, 0.85, 0.9, 0.95, 1]}
            {...CHART_AXIS}
            tickFormatter={(value) => Number(value).toFixed(2)}
          />
          <YAxis
            type="number"
            dataKey="ap"
            name="Average precision"
            domain={[0, 0.12]}
            ticks={[0, 0.03, 0.06, 0.09, 0.12]}
            width={42}
            {...CHART_AXIS}
            tickFormatter={(value) => Number(value).toFixed(2)}
          />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<ScatterTooltip />} />
          <Scatter name="Measured model" data={others} fill="var(--chart-1)" />
          <Scatter name="E2-D" data={highlighted} fill="var(--chart-2)" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
