import { useState } from "react";
import { Link } from "react-router-dom";
import { useDataset, useModelComparison, useTrainingComparison } from "@/hooks/queries";
import { Top500Preview } from "./FindingPreview";
import { MetricBars, apLabel } from "./ModelEvidence";
import { countLabel, e2Ids, modelColour, percentLabel, scientificNumber, ScientificChart, ScientificLegend, ScientificLines, toggleSeries } from "./ScientificChart";

const runMetrics = {
  average_precision: ["Average Precision", "Ranking score on the Phase 2 attack test", apLabel],
  training_seconds: ["Training duration", "Recorded wall-clock seconds · not an inference-speed benchmark", countLabel],
  completed_updates: ["Completed optimizer updates", "Steps · recorded for E2-D; calculated from epoch, sample and batch counts where necessary", countLabel],
  checkpoint_updates: ["Optimizer updates at selected checkpoint", "Steps when the recorded validation checkpoint was selected", countLabel],
  checkpoint_epoch: ["Selected checkpoint epoch", "Epoch number · epochs have different update counts across strategies", countLabel],
} as const;
type RunMetric = keyof typeof runMetrics;

const shortDescriptions: Record<string, string> = {
  "E2-A": "Trains on events as observed, including repetitions.",
  "E2-B": "Keeps one training example per distinct description.",
  "E2-C": "Uses weighted sampling to reduce duplicate dominance without removing duplicates.",
  "E2-D": "Keeps unique descriptions and approximately matches the updates taken to reach E2-A’s selected checkpoint.",
};

export function TrainingEvidence() {
  const training = useTrainingComparison();
  const { data: comparison } = useModelComparison();
  const { data: dataset } = useDataset();
  const originalPositiveCount = dataset?.class_balance.find(({ partition }) => partition === "Attack test")?.positives;
  const [active, setActive] = useState(e2Ids);
  const [runId, setRunId] = useState("E2-D");
  const [metric, setMetric] = useState<RunMetric>("average_precision");
  const [losses, setLosses] = useState(["train_loss", "validation_loss"]);
  const runs = (training.data?.runs ?? []).filter(({ id }) => active.includes(id));
  const run = training.data?.runs.find(({ id }) => id === runId);
  const frequency = training.data?.frequency;
  const [metricLabel, unit, format] = runMetrics[metric];
  const metricRows = (metric === "average_precision"
    ? (comparison?.models ?? []).filter(({ id }) => e2Ids.includes(id) && active.includes(id)).map((row) => ({ id: row.id, value: row.average_precision, basis: "Measured", source: row.availability?.artifact }))
    : runs.map((row) => ({ id: row.id, value: row[metric], basis: metric === "completed_updates" || metric === "checkpoint_updates" ? row.updates_basis : "Recorded", source: row.summary_source })))
    .flatMap((row) => row.value == null ? [] : [{ ...row, value: row.value }]);
  const earliest = run?.history.length ? run.history[0].epoch : null;
  const lossSeries = [
    { key: "train_loss", label: "Training loss", colour: "var(--chart-5)" },
    { key: "validation_loss", label: "Validation loss", colour: "var(--chart-1)", dashed: true },
  ].filter(({ key }) => losses.includes(key));
  const exposure = frequency ? [
    { id: "E2-A", value: frequency.most_frequent / frequency.original, label: `${countLabel(frequency.most_frequent)} of ${countLabel(frequency.original)} events` },
    { id: "E2-B", value: 1 / frequency.unique, label: `1 of ${countLabel(frequency.unique)} unique descriptions` },
    { id: "E2-D", value: 1 / frequency.unique, label: `1 of ${countLabel(frequency.unique)} unique descriptions` },
  ] : [];

  return <>
    <p className="pub-kicker">Experimental evidence · training strategies</p>
    <h1 className="pub-editorial-title">What should the autoencoder see most often?</h1>
    <p className="pub-lede">Compare the reference run, deduplication, frequency weighting, and training on unique descriptions for approximately the same number of updates.</p>
    <section className="pub-chart-suite pub-section-space" aria-label="Training strategy comparisons">
      {training.isLoading && <p role="status">Loading saved training artifacts…</p>}
      {training.isError && <p role="status">The training-history snapshot could not be loaded. Measured model results are shown separately when available.</p>}
      <dl className="pub-chart-readings">{e2Ids.map((id) => <div key={id}><dt><Link className="pub-text-link" to={`/experiments/${id}`}>{id}</Link></dt><dd>{shortDescriptions[id]}</dd></div>)}</dl>
      <ScientificLegend items={e2Ids.map((id) => ({ id }))} active={active} onToggle={(id) => setActive(toggleSeries(active, id))} label="Filter training strategies" />
      <div className="pub-chart-controls">
        <label>Training comparison metric<select value={metric} onChange={(e) => setMetric(e.target.value as RunMetric)}>
          {Object.entries(runMetrics).map(([key, [label]]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
      </div>
      <ScientificChart title={`${metricLabel} by training strategy`} unit={unit} sources={metricRows.map(({ source }) => source)} filename={`e2-${metric}.csv`}
        interpretation="Changing example frequency and changing the number of optimization steps are different interventions. E2-D targets the reference’s selected checkpoint, not the total steps before training stopped. The observed ranking changes remain single-seed evidence."
        table={{ columns: ["Experiment", metricLabel, "Value basis"], rows: metricRows.map(({ id, value, basis }) => [id, value, basis]) }}
        chart={() => <MetricBars data={metricRows} label={metricLabel} format={format} highlight="E2-D" />} />
      <ScientificChart title="How much does one description dominate?" unit="Share of the original or deduplicated training pool" sources={[frequency?.source]} filename="e2-training-description-frequency.csv"
        interpretation={frequency
          ? `One description accounts for ${(100 * frequency.most_frequent / frequency.original).toFixed(2)}% of the original benign training records. Keeping one instance per unique description reduces its pool share. E2-C changes sampling weights, not the underlying pool; realised draw counts were not saved.`
          : "The recorded source counts are unavailable. We cannot estimate the original or deduplicated description share."}
        table={{ columns: ["Experiment", "Share (fraction)", "Recorded or calculated base"], rows: exposure.map(({ id, value, label }) => [id, value, label]) }}
        chart={() => <MetricBars data={exposure} label="Most frequent original description" format={percentLabel} />} />
      <div className="pub-chart-controls">
        <label>Loss-history run<select value={runId} onChange={(e) => setRunId(e.target.value)}>{e2Ids.map((id) => <option key={id}>{id}</option>)}</select></label>
      </div>
      <ScientificChart title={`${runId} training and validation loss`} unit="Epoch (x) · recorded loss (y); marker shows selected checkpoint"
        interpretation={`${run?.checkpoint_epoch == null ? "No checkpoint epoch is recorded." : `The reported checkpoint is epoch ${run.checkpoint_epoch}.`} Each curve uses saved loss values; a slower decrease is not evidence of worse detection. Epochs across strategies can contain different numbers of samples and updates.`}
        sources={[run?.history_source, run?.summary_source]} filename={`${runId}-training-history.csv`}
        table={{ columns: ["Epoch", "Training loss", "Validation loss"], rows: (run?.history ?? []).map(({ epoch, train_loss, validation_loss }) => [epoch, train_loss, validation_loss]) }}
        chart={() => earliest != null && <ScientificLines rows={run?.history ?? []} xKey="epoch" yFormat={scientificNumber} selected={run?.checkpoint_epoch ?? undefined} series={lossSeries} />}>
        <ScientificLegend items={[{ id: "train_loss", label: "Training", colour: modelColour("E2-A") }, { id: "validation_loss", label: "Validation", colour: modelColour("E2-D") }]} active={losses} onToggle={(id) => setLosses(toggleSeries(losses, id))} label="Toggle loss series" />
      </ScientificChart>
      <div className="pub-chart-inspector">
        <h3>What changed in the first 500 alerts?</h3>
        <Top500Preview maximum={originalPositiveCount} />
        <p>The same review budget can recover different numbers of annotated positives. These are tie-aware results from the same attack-test partition.</p>
        <Link className="pub-text-link" to="/experiments/alerts">Compare all measured budgets and inspect tie ranges</Link>
      </div>
    </section>
  </>;
}
