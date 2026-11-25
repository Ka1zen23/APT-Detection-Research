import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_AXIS, CHART_GRID, ChartTooltip } from "@/components/features/data";
import { useAblation } from "@/hooks/queries";
import { apLabel, MetricBars } from "./ModelEvidence";
import { countLabel, e5Ids, modelColour, percentLabel, ScientificChart, ScientificLegend, ScientificLines, toggleSeries } from "./ScientificChart";
import { ProgressReveal, ResearchMotion } from "./ProgressMotion";

const modelMetrics = {
  average_precision: ["Average Precision", apLabel],
  roc_auc: ["ROC-AUC", apLabel],
  recall: ["Original recall at P99", percentLabel],
  contextual_recall: ["Contextual recall at P99", percentLabel],
  precision: ["Alert precision at P99", percentLabel],
  false_positives: ["False positives at P99", countLabel],
} as const;
type Metric = keyof typeof modelMetrics;
const variants = { "E5-A": "operation_only", "E5-B": "operation_entities", "E5-C": "full_provenance" } as const;

export function AblationEvidence() {
  const { data, isLoading, error } = useAblation();
  const [metric, setMetric] = useState<Metric>("average_precision");
  const [focus, setFocus] = useState("E5-C");
  const [selected, setSelected] = useState(e5Ids);
  const [representationMetric, setRepresentationMetric] = useState<"tokens" | "unique" | "conflicts" | "truncated" | "budgets">("tokens");
  const [label, setLabel] = useState<"original" | "contextual">("original");
  const visible = (data?.models ?? []).filter(({ id }) => selected.includes(id));
  const model = visible.find(({ id }) => id === focus);
  const [metricLabel, format] = modelMetrics[metric];
  const metrics = visible.flatMap((row) => row[metric] != null && (!["recall", "contextual_recall", "precision", "false_positives"].includes(metric) || row.threshold_percentile === 99)
    ? [{ id: row.id, value: row[metric] }] : []);
  const e5a = data?.models.find(({ id }) => id === "E5-A");
  const relative = e5a?.average_precision != null && e5a.average_precision > 0 && model?.average_precision != null ? model.average_precision / e5a.average_precision : undefined;
  const stats = Object.entries(variants).flatMap(([id, variant]) => {
    const train = data?.statistics.find((item) => item.variant === variant && item.split === "train");
    const test = data?.statistics.find((item) => item.variant === variant && item.split === "attack_test");
    const conflict = data?.conflicts[variant]?.[label]?.conflicting_records;
    return selected.includes(id) ? [{ id, train, test, conflict }] : [];
  });
  const conflict = data?.conflicts.operation_only?.original;
  const budgetRows = (data?.budgets ?? []).map((row) => ({ ...row, id: row.experiment === "B5-Frequency" ? "B5" : row.experiment })).filter(({ id }) => selected.includes(id));
  const budgets = [...new Set(budgetRows.map(({ budget }) => budget))].sort((a, b) => a - b);
  const tokens = stats.filter(({ test }) => test?.mean_tokens != null).map(({ id, test }) => ({ id, mean: test?.mean_tokens, p95: test?.p95_tokens, max: test?.maximum_tokens }));
  const relatedStats = representationMetric === "unique" ? stats.map(({ id, train }) => ({ id, value: train?.unique_descriptions }))
    : representationMetric === "truncated" ? stats.map(({ id, test }) => ({ id, value: test?.over_token_limit }))
      : stats.map(({ id, conflict }) => ({ id, value: conflict }));
  const statisticTitle = representationMetric === "unique" ? "Unique benign training descriptions" : representationMetric === "truncated" ? "Attack-test descriptions over the token limit" : "Attack-test records in conflicting descriptions";

  return <section className="pub-chart-suite" aria-label="E5 ablation evidence">
    {isLoading && <p role="status">Loading measured ablation data…</p>}
    {error && <p role="status">The shared ablation comparison could not be loaded.</p>}
    <ScientificLegend items={e5Ids.map((id) => ({ id }))} active={selected} label="Filter ablation models" onToggle={(id) => setSelected(toggleSeries(selected, id))} />
    <div className="pub-chart-controls">
      <label>Ablation performance metric<select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
        {Object.entries(modelMetrics).map(([key, [label]]) => <option value={key} key={key}>{label}</option>)}
      </select></label>
      <label>Spotlight representation<select value={focus} onChange={(e) => setFocus(e.target.value)}>{e5Ids.map((id) => <option key={id}>{id}</option>)}</select></label>
    </div>
    <ScientificChart title={`${metricLabel} by representation`} unit={`${metricLabel} · recorded Phase 2 attack-test results`} sources={data?.source_artifacts} filename={`e5-${metric}.csv`}
      interpretation="E5-A retains operations, E5-B adds entities, and E5-C retains directed relationships as well. B5 is an operation-frequency baseline, not the E5-A autoencoder. The E5 comparison changes representation configurations; it does not isolate the causal effect of graph relationships."
      table={{ columns: ["Model", metricLabel], rows: metrics.map(({ id, value }) => [id, value]) }}
      chart={() => <MetricBars data={metrics} label={metricLabel} format={format} highlight={focus} />} />
    {model && <div className="pub-chart-inspector"><ResearchMotion><ProgressReveal key={focus}>
      <p className="pub-kicker">Spotlight · {focus}</p>
      <p>{model.average_precision != null && <>Average Precision: <strong>{model.average_precision.toFixed(6)}</strong>. </>}{relative != null && focus !== "E5-A" && <>That is <strong>{relative.toFixed(2)}×</strong> the E5-A Average Precision. </>}
        {model.precision != null && model.threshold_percentile === 99 && <>At P99, <strong>{percentLabel(model.precision)}</strong> of alerts matched original positive annotations.</>}</p>
      <p>A relative improvement in Average Precision is not the absolute precision of alerts at an operating threshold.</p>
    </ProgressReveal></ResearchMotion></div>}
    {conflict && data?.derived.operation_only_conflicting_negative_events != null && <p className="pub-chart-interpretation"><strong>Exact-description ambiguity:</strong> the shared operation-only description covers {countLabel(conflict.conflicting_positives)} original positive and {countLabel(data.derived.operation_only_conflicting_negative_events)} negatively labelled events.</p>}
    <div className="pub-chart-controls">
      <label>Representation evidence<select value={representationMetric} onChange={(e) => setRepresentationMetric(e.target.value as typeof representationMetric)}>
        <option value="tokens">Token-length profile</option><option value="unique">Unique descriptions</option><option value="conflicts">Description ambiguity</option>
        <option value="truncated">Truncation</option><option value="budgets">Measured alert budgets</option>
      </select></label>
      {representationMetric === "conflicts" && <label>Conflict labels<select value={label} onChange={(e) => setLabel(e.target.value as typeof label)}><option value="original">Original annotations</option><option value="contextual">Derived contextual labels</option></select></label>}
    </div>
    {representationMetric === "tokens" ? <ScientificChart title="Token-length profile by representation" unit="Attack-test tokens per description · recorded mean, 95th percentile and maximum" filename="e5-token-length-summary.csv" sources={data?.source_artifacts?.filter((name) => name.includes("representation_statistics"))}
      interpretation="Extra context can use more of the encoder’s token budget. These are reported summary values, not a full token-length histogram. The summaries cover the three representations, not the frequency baseline."
      table={{ columns: ["Representation", "Mean tokens", "95th percentile", "Maximum tokens"], rows: tokens.map(({ id, mean, p95, max }) => [id, mean, p95, max]) }}
      chart={() => <ResponsiveContainer width="100%" height="100%"><BarChart data={tokens}><CartesianGrid {...CHART_GRID} />
        <XAxis {...CHART_AXIS} dataKey="id" /><YAxis {...CHART_AXIS} domain={[0, "auto"]} />
        <Tooltip content={<ChartTooltip formatter={(n) => countLabel(Number(n))} />} />
        <Bar dataKey="mean" name="Mean" fill="var(--chart-1)" maxBarSize={26} isAnimationActive={false} />
        <Bar dataKey="p95" name="95th percentile" fill="var(--chart-3)" maxBarSize={26} isAnimationActive={false} />
        <Bar dataKey="max" name="Maximum" fill="var(--chart-5)" maxBarSize={26} isAnimationActive={false} />
      </BarChart></ResponsiveContainer>}>
      <p className="pub-chart-key"><span style={{ color: "var(--chart-1)" }}>●</span> Mean <span style={{ color: "var(--chart-3)" }}>●</span> 95th percentile <span style={{ color: "var(--chart-5)" }}>●</span> Maximum</p>
    </ScientificChart> : representationMetric === "budgets" ? <ScientificChart title="Alert-budget recovery across representations" unit="Measured alert budget (log x-axis) · expected annotated positives (y)" filename="e5-alert-budgets.csv" sources={data?.source_artifacts?.filter((name) => name.includes("alert_budget"))}
      interpretation="The source table is tie-aware. Lines connect measured budgets for readability; no intermediate budget is estimated."
      table={{ columns: ["Model", "Alert budget", "Expected positives", "Minimum positives", "Maximum positives", "Expected precision (fraction)", "Expected recall (fraction)"], rows: budgetRows.map((row) => [row.id, row.budget, row.expected_true_positives, row.minimum_true_positives, row.maximum_true_positives, row.expected_precision, row.expected_recall]) }}
      chart={() => <ScientificLines xKey="budget" log xFormat={countLabel} rows={budgets.map((budget) => ({
        budget, ...Object.fromEntries(e5Ids.map((id) => [id, budgetRows.find((row) => row.id === id && row.budget === budget)?.expected_true_positives ?? null])),
      }))} series={selected.filter((id) => budgetRows.some((row) => row.id === id)).map((id) => ({ key: id, label: id, colour: modelColour(id) }))} />} />
      : <ScientificChart title={statisticTitle} unit={`Event/description count${representationMetric === "conflicts" ? ` · ${label} labels` : ""}`} filename={`e5-${representationMetric}.csv`} sources={data?.source_artifacts}
        interpretation={representationMetric === "conflicts" ? "These are exact-description collisions between differently labelled records, not proof that the underlying activities are identical." : "Counts are taken from the recorded summaries of the representation. No separate textual summary is assumed for B5."}
        table={{ columns: ["Representation", "Count"], rows: relatedStats.filter(({ value }) => value != null).map(({ id, value }) => [id, value]) }}
        chart={() => <MetricBars data={relatedStats.flatMap(({ id, value }) => value != null ? [{ id, value }] : [])} label="Count" />} />}
  </section>;
}
