import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_AXIS, CHART_GRID, ChartTooltip } from "@/components/features/data";
import { api } from "@/services/api";
import type { ModelRow } from "@/types/api";
import { countLabel, e2Ids, e5Ids, modelColour, percentLabel, ScientificChart, ScientificLegend, toggleSeries } from "./ScientificChart";

export const apLabel = (n: number) => n.toFixed(3);

export function MetricBars({ data, label, highlight, format = countLabel }: {
  data: { id: string; value: number }[];
  label: string;
  highlight?: string;
  format?: (number: number) => string;
}) {
  return <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, bottom: 6 }}>
      <CartesianGrid {...CHART_GRID} horizontal={false} vertical />
      <XAxis {...CHART_AXIS} type="number" domain={[0, "auto"]} tickFormatter={format} />
      <YAxis {...CHART_AXIS} type="category" dataKey="id" width={55} interval={0} />
      <Tooltip content={<ChartTooltip formatter={(value) => format(Number(value))} />} />
      <Bar dataKey="value" name={label} radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
        {data.map(({ id }) => <Cell key={id} fill={modelColour(id)} stroke={id === highlight ? "var(--foreground)" : undefined} strokeWidth={id === highlight ? 1.6 : undefined} />)}
      </Bar>
    </BarChart>
  </ResponsiveContainer>;
}

const metrics = {
  average_precision: ["Average Precision", "Summarises how effectively the model brings annotated positives towards the top of the ranking.", apLabel],
  roc_auc: ["ROC-AUC", "Measures how often a positive ranks above a negative. It can remain high when most generated alerts are false positives.", apLabel],
  recall: ["Recall", "The proportion of originally annotated positives flagged at each model’s recorded operating point.", percentLabel],
  precision: ["Precision", "The proportion of alerts that match original positive annotations at each model’s recorded operating point.", percentLabel],
  false_positives: ["False positives", "Counts negatively labelled attack-test events flagged at the recorded operating point.", countLabel],
  attack_fpr: ["False-positive rate", "The proportion of negatively labelled attack-test events incorrectly flagged at the recorded operating point.", percentLabel],
  contextual_recall: ["Contextual recall", "Counts the fraction of derived contextual positives flagged. Contextual labels are not independently annotated ground truth.", percentLabel],
} as const;

type Metric = keyof typeof metrics;
type View = "ranking" | "operating" | "roc" | "pr" | "cost";

export function ModelEvidence({ models }: { models: ModelRow[] }) {
  const [metric, setMetric] = useState<Metric>("average_precision");
  const [view, setView] = useState<View>("ranking");
  const [selected, setSelected] = useState([...e2Ids, ...e5Ids.filter((id) => id !== "B5")]);
  const [highlight, setHighlight] = useState("E2-D");
  const [order, setOrder] = useState<"high" | "low">("high");
  const [annotation, setAnnotation] = useState<"original" | "contextual">("original");
  const visible = models.filter(({ id }) => selected.includes(id));
  const [metricLabel, explanation, formatter] = metrics[metric];
  const ranked = visible.flatMap((row) => row[metric] != null ? [{ id: row.id, value: row[metric] }] : [])
    .sort((a, b) => order === "high" ? b.value - a.value : a.value - b.value);
  const curves = useQueries({ queries: visible.map(({ id }) => ({
    queryKey: ["curves", id, annotation], queryFn: () => api.curves(id, annotation), enabled: view === "roc" || view === "pr",
  })) });
  const operating = visible.filter(({ precision, recall }) => precision != null || recall != null);
  const timing = visible.flatMap(({ id, training_seconds, average_precision }) => training_seconds != null && training_seconds > 0 && average_precision != null ? [{ id, seconds: training_seconds, ap: average_precision }] : []);
  const focused = visible.find(({ id }) => id === highlight);
  const sources = visible.map(({ availability }) => availability?.artifact);
  const matrix = focused && [focused.true_positives, focused.false_positives, focused.false_negatives, focused.true_negatives].some((value) => value != null);
  const curveKind = view === "roc" ? "roc" : "pr";
  const curveSeries = curves.flatMap(({ data }) => data?.available && data[curveKind]?.length ? [{ id: data.experiment_id, points: data[curveKind], source: data.source }] : []);
  const xLabel = view === "roc" ? "False-positive rate" : "Recall";
  const yLabel = view === "roc" ? "True-positive rate" : "Precision";

  return <div className="pub-chart-suite">
    <div className="pub-chart-controls">
      <label>Chart view<select value={view} onChange={(e) => setView(e.target.value as View)}>
        <option value="ranking">Metric leaderboard</option><option value="operating">Precision and recall</option>
        <option value="roc">ROC curves</option><option value="pr">Precision–recall curves</option><option value="cost">Performance versus training time</option>
      </select></label>
      {view === "ranking" && <>
        <label>Choose a comparison metric<select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
          {Object.entries(metrics).map(([key, [label]]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <label>Sort metric<select value={order} onChange={(e) => setOrder(e.target.value as "high" | "low")}><option value="high">Highest first</option><option value="low">Lowest first</option></select></label>
      </>}
      {(view === "roc" || view === "pr") && <label>Annotation set<select value={annotation} onChange={(e) => setAnnotation(e.target.value as "original" | "contextual")}><option value="original">Original annotations</option><option value="contextual">Derived contextual labels</option></select></label>}
      <label>Highlight experiment<select value={highlight} onChange={(e) => setHighlight(e.target.value)}><option value="">None</option>{models.map(({ id }) => <option key={id}>{id}</option>)}</select></label>
    </div>
    <ScientificLegend label="Filter compared experiments" items={models} active={selected} onToggle={(id) => setSelected(toggleSeries(selected, id))} />
    {view === "ranking" && <ScientificChart title={`${metricLabel} comparison`} unit={`${metricLabel} · recorded Phase 2 attack-test results`} filename={`${metric}.csv`} sources={sources} minPlotHeight={ranked.length > 7 ? ranked.length * 26 + 38 : undefined}
      interpretation={`${explanation} Threshold-based values use each model’s recorded operating point; the ranking does not establish performance on an independent scenario.`}
      table={{ columns: ["Experiment", metricLabel], rows: ranked.map(({ id, value }) => [id, value]) }}
      chart={() => <MetricBars data={ranked} label={metricLabel} format={formatter} highlight={highlight} />} />}
    {view === "operating" && <ScientificChart title="Precision and recall at recorded operating points" unit="Percent of alerts or originally annotated positives · Phase 2 attack test" filename="precision-recall-operating-points.csv" sources={sources}
      interpretation="Recall shows the positives recovered; precision shows how often flags match original positive annotations. High recall does not mean a small review workload. The operating rules can differ by model."
      table={{ columns: ["Experiment", "Precision (fraction)", "Recall (fraction)"], rows: operating.map(({ id, precision, recall }) => [id, precision, recall]) }}
      chart={() => <ResponsiveContainer width="100%" height="100%"><BarChart data={operating} margin={{ top: 12, right: 12 }}><CartesianGrid {...CHART_GRID} />
        <XAxis {...CHART_AXIS} dataKey="id" /><YAxis {...CHART_AXIS} domain={[0, 1]} tickFormatter={percentLabel} />
        <Tooltip content={<ChartTooltip formatter={(value) => percentLabel(Number(value))} />} />
        {(["precision", "recall"] as const).map((key, i) => <Bar key={key} name={i === 0 ? "Precision" : "Recall"} dataKey={key} fill={`var(--chart-${i + 1})`} isAnimationActive={false} maxBarSize={28}>
          {operating.map(({ id }) => <Cell key={id} stroke={id === highlight ? "var(--foreground)" : undefined} />)}
        </Bar>)}
      </BarChart></ResponsiveContainer>}>
      <p className="pub-chart-key"><span style={{ color: "var(--chart-1)" }}>●</span> Precision <span style={{ color: "var(--chart-2)" }}>●</span> Recall</p>
    </ScientificChart>}
    {(view === "roc" || view === "pr") && <>
      {curves.some(({ isLoading }) => isLoading) && <p role="status">Loading saved curve points…</p>}
      <ScientificChart title={view === "roc" ? "Receiver operating characteristic" : "Precision–recall curves"} unit={`${xLabel} (x) · ${yLabel} (y) · ${annotation} labels`} filename={`${view}-${annotation}-curves.csv`} sources={curveSeries.map(({ source }) => source)}
        interpretation="Only stored samples of curves computed from per-event predictions are drawn. Intermediate points are not estimated. Original and contextual labels answer different questions; neither adds independent validation."
        table={{ columns: ["Experiment", `${xLabel} (fraction)`, `${yLabel} (fraction)`], rows: curveSeries.flatMap(({ id, points }) => points.map(({ x, y }) => [id, x, y])) }}
        chart={() => <ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 12, right: 20 }}>
          <CartesianGrid {...CHART_GRID} /><XAxis {...CHART_AXIS} dataKey="x" name={xLabel} type="number" domain={[0, 1]} tickFormatter={percentLabel} />
          <YAxis {...CHART_AXIS} dataKey="y" name={yLabel} type="number" domain={[0, 1]} tickFormatter={percentLabel} />
          <Tooltip content={<ChartTooltip formatter={(value) => percentLabel(Number(value))} />} />
          {curveSeries.map(({ id, points }) => <Scatter key={id} name={id} data={points} fill={modelColour(id)} stroke={id === highlight ? "var(--foreground)" : undefined} isAnimationActive={false} />)}
        </ScatterChart></ResponsiveContainer>} />
    </>}
    {view === "cost" && <ScientificChart title="Ranking quality versus training time" unit="Reported wall-clock training seconds (x) · Average Precision (y)" filename="performance-versus-training-time.csv" sources={visible.filter((row) => timing.some(({ id }) => id === row.id)).map(({ id }) => `Experiment ${id} · recorded training summary and evaluation metrics`)}
      interpretation="This compares recorded training duration with ranking quality for runs that report both values. It is not a controlled speed benchmark or a measure of inference latency."
      table={{ columns: ["Experiment", "Training time (s)", "Average Precision"], rows: timing.map(({ id, seconds, ap }) => [id, seconds, ap]) }}
      chart={() => <ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 12, right: 20 }}>
        <CartesianGrid {...CHART_GRID} /><XAxis {...CHART_AXIS} dataKey="seconds" name="Training seconds" type="number" domain={[0, "auto"]} />
        <YAxis {...CHART_AXIS} dataKey="ap" name="Average Precision" type="number" domain={[0, "auto"]} tickFormatter={apLabel} />
        <Tooltip content={<ChartTooltip formatter={(value, name) => name === "Average Precision" ? Number(value).toFixed(6) : countLabel(Number(value))} />} />
        {timing.map((row) => <Scatter key={row.id} name={row.id} data={[row]} fill={modelColour(row.id)} stroke={row.id === highlight ? "var(--foreground)" : undefined} isAnimationActive={false} />)}
      </ScatterChart></ResponsiveContainer>} />}
    {matrix && focused && <details className="pub-disclosure"><summary>Confusion matrix · {focused.id}</summary>
      <ConfusionHeatmap model={focused} />
    </details>}
  </div>;
}

function ConfusionHeatmap({ model }: { model: ModelRow }) {
  const pairs = [
    ["Original positive", model.true_positives, model.false_negatives],
    ["Originally negative", model.false_positives, model.true_negatives],
  ] as const;
  return <div className="pub-reading">
    <table className="pub-confusion-heatmap">
      <caption>Measured event counts · {model.id}</caption>
      <thead><tr><th scope="col">Original label</th><th scope="col">Flagged</th><th scope="col">Not flagged</th></tr></thead>
      <tbody>{pairs.map(([label, flagged, quiet]) => {
        const total = flagged != null && quiet != null ? flagged + quiet : null;
        return <tr key={label}><th scope="row">{label}</th>{[flagged, quiet].map((value, index) => {
          const share = value != null && total ? value / total : null;
          return <td key={index} style={share == null ? undefined : { background: `color-mix(in srgb, var(--primary) ${4 + 29 * share}%, var(--surface))` }}>
            <strong>{value == null ? "—" : countLabel(value)}</strong>{share != null && <small>{percentLabel(share)} of row</small>}
          </td>;
        })}</tr>;
      })}</tbody>
    </table>
    <p className="pub-chart-interpretation">Colour intensity is the share within each original-label row; counts are not shown on a log scale or normalised across both rows. Negatively labelled events are not necessarily proven benign.</p>
  </div>;
}
