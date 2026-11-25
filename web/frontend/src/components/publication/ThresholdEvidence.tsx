import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_AXIS, CHART_GRID, ChartTooltip } from "@/components/features/data";
import { useScoreHistogram, useThresholds } from "@/hooks/queries";
import type { ScoreHistogram, ThresholdRow } from "@/types/api";
import { countLabel, e2Ids, percentLabel, scientificNumber, ScientificChart, ScientificLegend, ScientificLines, toggleSeries, type LineSeries } from "./ScientificChart";

const rate = (value: number) => percentLabel(value);
const point = (value: number) => `P${value}`;
const output = [
  ["total_alerts", "All alerts", countLabel], ["false_positives", "False positives", countLabel], ["true_positives", "True positives", countLabel],
  ["precision", "Precision", rate], ["recall", "Original recall", rate], ["contextual_recall", "Contextual recall", rate], ["benign_fpr", "Benign-test false-positive rate", rate],
] as const;
const series = (indexes: readonly number[]): LineSeries[] => indexes.map((index, i) => ({
  key: output[index][0], label: output[index][1], colour: `var(--chart-${i + 1})`, dashed: i === 1,
}));

export function ThresholdEvidence() {
  const [model, setModel] = useState("E2-D");
  const [percentile, setPercentile] = useState(99);
  const [plot, setPlot] = useState<"counts" | "rates" | "pr" | "distribution">("counts");
  const [visible, setVisible] = useState<string[]>(output.map(([key]) => key));
  const sweep = useThresholds(model);
  const scores = useScoreHistogram(plot === "distribution" ? model : "");
  const rows = sweep.data?.rows ?? [];
  const primary = sweep.data?.primary_percentile ?? 99;
  const selected = rows.find((row) => row.percentile === percentile) ?? rows.find((row) => row.percentile === primary) ?? rows[0];
  const baseline = rows.find(({ percentile }) => percentile === primary);
  const lineSeries = series(plot === "counts" ? [0, 1, 2] : [3, 4, 5, 6]);
  return <section className="pub-chart-suite" aria-label="Measured threshold explorer">
    <div className="pub-chart-controls">
      <label>Threshold model<select value={model} onChange={(e) => { setModel(e.target.value); setPercentile(99); }}>{e2Ids.map((id) => <option key={id}>{id}</option>)}</select></label>
      <label>Comparison percentile<select disabled={!selected} value={selected?.percentile ?? ""} onChange={(e) => setPercentile(Number(e.target.value))}>
        {rows.map((row) => <option key={row.percentile} value={row.percentile}>{point(row.percentile)}{row.percentile === primary ? " · primary" : row.exploratory ? " · exploratory" : ""}</option>)}
      </select></label>
      <label>Threshold chart<select value={plot} onChange={(e) => setPlot(e.target.value as typeof plot)}>
        <option value="counts">Alert counts</option><option value="rates">Rates at measured percentiles</option><option value="pr">Precision versus recall</option><option value="distribution">Reconstruction error distribution</option>
      </select></label>
    </div>
    {sweep.isLoading && <p role="status">Loading saved threshold measurements…</p>}
    {sweep.isError && <p role="status">The saved threshold sweep could not be loaded.</p>}
    {selected && <div className="pub-chart-inspector">
      <p className="pub-kicker">{point(selected.percentile)} · {selected.percentile === primary ? "Primary operating point" : selected.exploratory ? "Exploratory · retrospective" : "Sensitivity analysis"}</p>
      <p>Threshold score: <strong>{scientificNumber(selected.threshold)}</strong>. P99 is the registered primary operating point. Alternative percentiles do not establish independent performance.</p>
      <dl className="pub-chart-readings" aria-live="polite">{output.map(([key, label, format]) => <div key={key}>
        <dt>{label}</dt><dd>{format(selected[key])}</dd>
      </div>)}</dl>
      {!!baseline && baseline !== selected && <p><strong>Compared with primary {point(primary)}:</strong> {countLabel(baseline.total_alerts)} → {countLabel(selected.total_alerts)} alerts; contextual recall {rate(baseline.contextual_recall)} → {rate(selected.contextual_recall)}.</p>}
    </div>}
    {plot === "distribution" ? <>
      {scores.isLoading && <p role="status">Loading the aggregate score distribution…</p>}
      <Histogram histogram={scores.data} selected={selected} baseline={baseline} />
    </> : plot === "pr" ? <ScientificChart title="Precision versus recall at saved thresholds" unit="Original recall (x) · original precision (y)" sources={[sweep.data?.source]} filename={`${model}-threshold-precision-recall.csv`}
      interpretation="Each dot is a recorded operating point from this sensitivity sweep, not a full precision–recall curve. P99 is the primary point. Other thresholds, including retrospectively examined choices, do not establish independent performance."
      table={{ columns: ["Percentile", "Recall (fraction)", "Precision (fraction)", "Exploratory"], rows: rows.map(({ percentile, recall, precision, exploratory }) => [percentile, recall, precision, exploratory ? "Yes" : "No"]) }}
      chart={() => <ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 12, right: 20 }}>
        <CartesianGrid {...CHART_GRID} /><XAxis {...CHART_AXIS} dataKey="recall" name="Recall" type="number" domain={[0, 1]} tickFormatter={rate} />
        <YAxis {...CHART_AXIS} dataKey="precision" name="Precision" type="number" domain={[0, "auto"]} tickFormatter={rate} />
        <Tooltip content={<ChartTooltip formatter={(value) => rate(Number(value))} />} />
        <Scatter name="Saved thresholds" data={rows} fill="var(--chart-5)" isAnimationActive={false} />
        {baseline && <Scatter name="Primary P99" data={[baseline]} shape="diamond" fill="var(--warning)" isAnimationActive={false} />}
        {selected && <Scatter name="Selected cutoff" data={[selected]} shape="cross" fill="var(--primary)" isAnimationActive={false} />}
      </ScatterChart></ResponsiveContainer>}>
      <p className="pub-chart-key">● Recorded threshold · ◆ Primary P99 · + Selected cutoff</p>
    </ScientificChart> : <ScientificChart
      title={plot === "counts" ? "Alert counts by validation percentile" : "Precision and recall by validation percentile"}
      unit={plot === "counts" ? "Measured percentiles (x) · attack-test event counts (y)" : "Measured percentiles (x) · share of events (y)"}
      interpretation={plot === "counts"
        ? "Each point is a measured threshold. Raising the cutoff generally sends fewer alerts for review, but can also remove labelled positives. The selected cutoff and primary P99 are marked."
        : "The selected operating point trades off precision, recall and false alerts. Contextual labels are derived rather than independent ground truth. The benign false-positive rate uses a separate test partition."}
      sources={[sweep.data?.source]} filename={`${model}-thresholds.csv`}
      table={{ columns: ["Percentile", "Threshold score", "Exploratory", ...output.map(([key, label]) => `${label}${["precision", "recall", "contextual_recall", "benign_fpr"].includes(key) ? " (fraction)" : ""}`)],
        rows: rows.map((row) => [row.percentile, row.threshold, row.exploratory ? "Yes" : "No", ...output.map(([key]) => row[key])]) }}
      chart={() => <ScientificLines rows={rows} xKey="percentile" xFormat={point} reference={baseline?.percentile} selected={selected?.percentile} pointOnly
        series={lineSeries.filter(({ key }) => visible.includes(key))} yFormat={plot === "counts" ? countLabel : rate} domain={plot === "counts" ? [0, "auto"] : [0, 1]} />}>
      <ScientificLegend items={lineSeries.map(({ key, label, colour }) => ({ id: key, label, colour }))} active={visible} label="Toggle threshold series" onToggle={(id) => setVisible(toggleSeries(visible, id))} />
      <p className="pub-chart-key">Solid marker: selected cutoff · Dashed marker: primary P99</p>
    </ScientificChart>}
  </section>;
}

function Histogram({ histogram, selected, baseline }: { histogram?: ScoreHistogram; selected?: ThresholdRow; baseline?: ThresholdRow }) {
  const [partitions, setPartitions] = useState(["attack", "benign"]);
  const rows = (histogram?.rows ?? []).map((bin, i) => ({
    ...bin, index: i, label: `${scientificNumber(bin.lower)}–${scientificNumber(bin.upper)}`,
    attack: histogram?.attack_total && bin.attack_count != null ? bin.attack_count / histogram.attack_total : null,
    benign: histogram?.benign_total && bin.benign_count != null ? bin.benign_count / histogram.benign_total : null,
  }));
  function findBin(score?: number) {
    return score == null ? undefined : rows.find(({ lower, upper }, i) => score >= lower && (score < upper || (i === rows.length - 1 && score === upper)))?.index;
  }
  return <ScientificChart title="Reconstruction error distributions" unit="Recorded error bins (x; logarithmic spacing above zero) · share of each partition (y)"
    sources={histogram?.sources} filename={`${histogram?.experiment_id ?? "recorded"}-score-histogram.csv`}
    interpretation="These counts were aggregated from stored scores, not individual event traces. The markers identify the bins that contain the selected cutoff and primary cutoff, not a location within a bin."
    table={{ columns: ["Lower edge", "Upper edge", "Attack-test events", "Benign-test events", "Attack-test share", "Benign-test share"], rows: rows.map((bin) => [bin.lower, bin.upper, bin.attack_count, bin.benign_count, bin.attack, bin.benign]) }}
    chart={() => <ResponsiveContainer width="100%" height="100%"><BarChart data={rows} margin={{ top: 12, right: 12 }}>
      <CartesianGrid {...CHART_GRID} />
      <XAxis {...CHART_AXIS} dataKey="index" tickFormatter={(i) => scientificNumber(rows[i]?.lower ?? 0)} />
      <YAxis {...CHART_AXIS} domain={[0, "auto"]} tickFormatter={rate} />
      <Tooltip content={<ChartTooltip formatter={(value) => rate(Number(value))} labelFormatter={(i) => rows[Number(i)]?.label ?? ""} />} />
      {findBin(baseline?.threshold) !== undefined && <ReferenceLine x={findBin(baseline?.threshold)} stroke="var(--warning)" strokeDasharray="4 3" />}
      {findBin(selected?.threshold) !== undefined && <ReferenceLine x={findBin(selected?.threshold)} stroke="var(--primary)" />}
      {partitions.includes("attack") && <Bar dataKey="attack" name="Attack test" fill="var(--chart-1)" isAnimationActive={false} />}
      {partitions.includes("benign") && <Bar dataKey="benign" name="Benign test" fill="var(--chart-5)" isAnimationActive={false} />}
    </BarChart></ResponsiveContainer>}>
    <ScientificLegend items={[{ id: "attack", label: "Attack test", colour: "var(--chart-1)" }, { id: "benign", label: "Benign test", colour: "var(--chart-5)" }]} active={partitions} label="Toggle score distributions" onToggle={(id) => setPartitions(toggleSeries(partitions, id))} />
  </ScientificChart>;
}
