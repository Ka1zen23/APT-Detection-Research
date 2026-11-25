import { useEffect, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Pause, Play } from "lucide-react";
import { useDataset } from "@/hooks/queries";
import { api } from "@/services/api";
import type { AlertBudgetRow } from "@/types/api";
import { countLabel, e2Ids, modelColour, percentLabel, ScientificChart, ScientificLegend, ScientificLines, toggleSeries } from "./ScientificChart";

const budgetMetrics = {
  expected_true_positives: ["Expected positives recovered", countLabel],
  expected_precision: ["Expected precision", percentLabel],
  expected_recall: ["Expected recall", percentLabel],
} as const;
type Metric = keyof typeof budgetMetrics;

export function AlertEvidence() {
  const queries = useQueries({ queries: e2Ids.map((id) => ({ queryKey: ["budgets", id], queryFn: () => api.alertBudgets(id) })) });
  const { data: dataset } = useDataset();
  const total = dataset?.class_balance.find(({ partition }) => partition === "Attack test")?.positives;
  const payloads = queries.flatMap(({ data }) => data?.available ? [data] : []);
  const budgets = [...new Set(payloads.flatMap(({ rows }) => rows.map(({ budget }) => budget)))].sort((a, b) => a - b);
  const [budget, setBudget] = useState(500);
  const [model, setModel] = useState("E2-D");
  const [metric, setMetric] = useState<Metric>("expected_true_positives");
  const [active, setActive] = useState(e2Ids);
  const [review, setReview] = useState<{ steps: number[]; index: number; paused: boolean }>();
  const current = budgets.includes(budget) ? budget : budgets[0];
  const [title, format] = budgetMetrics[metric];
  const row = payloads.find(({ experiment_id }) => experiment_id === model)?.rows.find(({ budget }) => budget === current);
  const visible = payloads.filter(({ experiment_id }) => active.includes(experiment_id));
  const chartBudgets = [...new Set(visible.flatMap(({ rows }) => rows.map(({ budget }) => budget)))].sort((a, b) => a - b);
  const table = visible.flatMap(({ experiment_id, rows }) => rows.map((row) => [
    experiment_id, row.budget, row.expected_true_positives, row.minimum_true_positives, row.maximum_true_positives,
    row.expected_precision, row.expected_recall, total == null ? null : total - row.expected_true_positives,
  ]));

  useEffect(() => {
    if (!review || review.paused || review.index >= review.steps.length - 1) return;
    const id = window.setTimeout(() => {
      setBudget(review.steps[review.index + 1]);
      setReview({ ...review, index: review.index + 1 });
    }, 850);
    return () => window.clearTimeout(id);
  }, [review]);

  const playing = review && !review.paused && review.index < review.steps.length - 1;
  function replay() {
    if (playing && review) return setReview({ ...review, paused: true });
    if (review?.paused) return setReview({ ...review, paused: false });
    const steps = budgets.filter((point) => point <= current);
    if (!steps.length) return;
    setBudget(steps[0]);
    setReview({ steps, index: 0, paused: false });
  }

  return <section className="pub-chart-suite" aria-label="Alert budget evidence">
    <div className="pub-chart-controls">
      <label>Measured alert budget<select value={current ?? ""} disabled={!budgets.length} onChange={(e) => { setReview(undefined); setBudget(Number(e.target.value)); }}>
        {budgets.map((point) => <option value={point} key={point}>{countLabel(point)}</option>)}
      </select></label>
      <label>Review model<select value={model} onChange={(e) => setModel(e.target.value)}>{e2Ids.map((id) => <option key={id}>{id}</option>)}</select></label>
      <label>Budget metric<select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>{Object.entries(budgetMetrics).map(([key, [label]]) => <option key={key} value={key}>{label}</option>)}</select></label>
    </div>
    {queries.some(({ isLoading }) => isLoading) && <p role="status">Loading measured alert budgets…</p>}
    <ScientificLegend items={e2Ids.map((id) => ({ id }))} active={active} onToggle={(id) => setActive(toggleSeries(active, id))} label="Filter alert-budget models" />
    <ScientificChart title="What different review budgets recover" unit={`Recorded alert budgets (logarithmic x-axis) · ${title} (y-axis)`} sources={visible.map(({ source }) => source)} filename="measured-alert-budgets.csv"
      table={{ columns: ["Experiment", "Alerts reviewed", "Expected positives", "Minimum positives", "Maximum positives", "Expected precision (fraction)", "Expected recall (fraction)", "Expected positives remaining"], rows: table }}
      interpretation="Higher points recover more originally annotated positives at the same review budget. Lines connect saved budgets as a reading aid; they do not provide estimates between budgets. Shared scores at a cutoff can change which events are reviewed."
      chart={() => <ScientificLines xKey="budget" xFormat={countLabel} yFormat={format} log selected={current}
        domain={metric === "expected_true_positives" ? [0, total ?? "auto"] : [0, 1]}
        rows={chartBudgets.map((point) => ({ budget: point, ...Object.fromEntries(visible.map(({ experiment_id, rows }) => [experiment_id, rows.find(({ budget }) => budget === point)?.[metric] ?? null])) }))}
        series={visible.map(({ experiment_id: id }) => ({ key: id, label: id, colour: modelColour(id) }))} />} />
    <div className="pub-chart-inspector">
      <p className="pub-kicker">Aggregate review queue · no individual ranks shown</p>
      <h3>{model} · {current === undefined ? "No measured cutoff" : `first ${countLabel(current)} alerts`}</h3>
      {row ? <QueueTotals row={row} total={total} /> : <p>No saved budget row is available for this model and cutoff.</p>}
      <div className="pub-chart-controls">
        <button type="button" className="pub-segment pub-chart-action" disabled={budgets.length < 2 || current === budgets[0] && !review} onClick={replay}>
          {playing ? <Pause size={15} /> : <Play size={15} />}{playing ? "Pause review" : review?.paused ? "Resume review" : "Replay review to cutoff"}
        </button>
        <small>Replay advances through saved cutoffs only; it does not reveal positions of individual positive events.</small>
      </div>
    </div>
  </section>;
}

function QueueTotals({ row, total }: { row: AlertBudgetRow; total?: number }) {
  return <>
    <div className="pub-alert-strip" aria-hidden="true"><span style={{ width: `${row.expected_precision * 100}%` }} /></div>
    <p><strong>{countLabel(row.expected_true_positives)}{total == null ? "" : ` of ${countLabel(total)}`}</strong> originally annotated positives expected at this cutoff ({percentLabel(row.expected_precision)} of the reviewed queue). The strip separates expected positives from all other alerts, not positions.</p>
    <dl className="pub-chart-readings" aria-live="polite">
      <div><dt>Expected recall</dt><dd>{percentLabel(row.expected_recall)}</dd></div>
      <div><dt>Tie range</dt><dd>{countLabel(row.minimum_true_positives)}–{countLabel(row.maximum_true_positives)}</dd></div>
      <div><dt>Positives remaining, expected</dt><dd>{total == null ? "Not available" : countLabel(total - row.expected_true_positives)}</dd></div>
    </dl>
  </>;
}
