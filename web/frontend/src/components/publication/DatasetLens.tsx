import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { formatNumber, formatPercent } from "@/lib/format";
import type { DatasetSummary } from "@/types/api";

const variants = [["operation_only", "Operation only"], ["operation_entities", "Operations + entities"], ["full_provenance", "Full provenance"]] as const;

export function DatasetLens({ data }: { data: DatasetSummary }) {
  const [split, setSplit] = useState("attack_test");
  const [metric, setMetric] = useState<"unique" | "duplicates" | "over">("unique");
  const balance = data.class_balance.find((row) => row.partition.toLowerCase().replace(" ", "_") === (split === "train" ? "training" : split));
  const rows = variants.flatMap(([variant, label]) => {
    const row = data.representation.find((entry) => entry.variant === variant && entry.split === split);
    if (!row || !row.events) return [];
    const duplicates = data.duplicates.find((entry) => entry.variant === variant && entry.split === split);
    const count = metric === "unique" ? row.unique_descriptions : metric === "over" ? row.over_token_limit : duplicates?.duplicates;
    return count == null ? [] : [{ label, count, total: row.events }];
  });

  return <section className="pub-dataset-lens" aria-labelledby="dataset-lens-title">
    <p className="pub-kicker">Measured dataset profile</p>
    <h2 className="pub-editorial-h2" id="dataset-lens-title">What changes when we add context?</h2>
    <p>Compare saved text statistics across all three E5 representations. The bars share a 0–100% scale; the counts and denominators are shown alongside.</p>
    <div className="pub-chart-controls">
      <label>Dataset partition<select value={split} onChange={(event) => setSplit(event.target.value)}>
        {data.partitions.map(({ name }) => <option key={name} value={name}>{name === "train" ? "Training" : name.replaceAll("_", " ").replace(/^./, (first) => first.toUpperCase())}</option>)}
      </select></label>
      <label>Text statistic<select value={metric} onChange={(event) => setMetric(event.target.value as typeof metric)}>
        <option value="unique">Distinct descriptions</option><option value="duplicates">Exact duplicates beyond the first</option><option value="over">Above 256 tokens</option>
      </select></label>
    </div>
    <ul className="pub-dataset-bars" aria-label="Representation shares" aria-live="polite">
      {rows.map(({ label, count, total }) => <li key={label}>
        <div><strong>{label}</strong><span>{formatNumber(count)} / {formatNumber(total)} · {formatPercent(count / total, 3)}</span></div>
        <div className="pub-dataset-track" aria-hidden="true"><span style={{ transform: `scaleX(${count / total})` }} /></div>
      </li>)}
    </ul>
    {rows.length === 0 && <p role="status">No saved values are available for this selection.</p>}
    {balance && <p className="pub-pipeline-evidence"><strong>Label balance:</strong> {formatNumber(balance.positives)} of {formatNumber(balance.records)} events carry an original positive label{balance.records > 0 ? ` (${formatPercent(balance.positives / balance.records, 3)})` : ""}.
      {balance.contextual_positives != null && <> Contextual positives: {formatNumber(balance.contextual_positives)}. The two annotation counts are not additive.</>}</p>}
    <p className="pub-chart-source">Source: <code>results/eda/ablation/representation_statistics.csv</code>. Text diversity is not embedding diversity or detection performance.</p>
    <Link className="pub-text-link" to="/understand/embedding-explorer">Explore how the vectors are displayed <ArrowUpRight size={15} /></Link>
  </section>;
}
