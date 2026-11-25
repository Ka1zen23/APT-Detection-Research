import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { useDataset } from "@/hooks/queries";
import { formatNumber, formatPercent } from "@/lib/format";
import { api, isStaticDataMode } from "@/services/api";
import type { EmbeddingPoint, EmbeddingSplit, EmbeddingVariant } from "@/types/api";

const variants = [
  ["E5-A", "Operation only", "operation_only"],
  ["E5-B", "Operations + entities", "operation_entities"],
  ["E5-C", "Full provenance", "full_provenance"],
] as const;
const splits = [
  ["attack_test", "Attack test"],
  ["benign_test", "Benign test"],
  ["validation", "Validation"],
  ["train", "Training"],
] as const;
const examples: EmbeddingPoint[] = [
  { phase: "illustrative", event_id: "Scheduled backup", original_label: 0, contextual_label: 0, coordinates: { "E5-A": [-.42, .26], "E5-B": [-.52, .37], "E5-C": [-.64, .39] } },
  { phase: "illustrative", event_id: "Different copy context", original_label: 1, contextual_label: 0, coordinates: { "E5-A": [-.42, .26], "E5-B": [-.02, .18], "E5-C": [.18, -.12] } },
  { phase: "illustrative", event_id: "File indexing", original_label: 0, contextual_label: 0, coordinates: { "E5-A": [.34, .42], "E5-B": [.27, .51], "E5-C": [.49, .56] } },
  { phase: "illustrative", event_id: "Routine archive copy", original_label: 0, contextual_label: 0, coordinates: { "E5-A": [-.42, .26], "E5-B": [-.37, -.21], "E5-C": [.33, -.18] } },
  { phase: "illustrative", event_id: "Scheduled sync", original_label: 0, contextual_label: 0, coordinates: { "E5-A": [.62, -.33], "E5-B": [.56, -.45], "E5-C": [.56, -.34] } },
];

const pointKey = (point: EmbeddingPoint) => `${point.phase}:${point.event_id}`;
const describePoint = (point: EmbeddingPoint, recorded: boolean) => recorded ? `${point.phase} · ${point.event_id}` : point.event_id;
const labelName = (value: number) => value === 1 ? "Positive source label" : "Negative source label";

function ProjectionPlot({ points, variant, extent, recorded, field, selected, onSelect }: {
  points: EmbeddingPoint[]; variant: EmbeddingVariant; extent: number; recorded: boolean;
  field: "original_label" | "contextual_label"; selected?: EmbeddingPoint; onSelect: (point: EmbeddingPoint) => void;
}) {
  const x = (value: number) => 320 + value / extent * 180;
  const y = (value: number) => 202 - value / extent * 180;
  const ticks = [-extent, -extent / 2, 0, extent / 2, extent];
  function draw(point: EmbeddingPoint, highlight = false) {
    const [a, b] = point.coordinates[variant];
    return <g key={highlight ? "selected" : pointKey(point)} transform={`translate(${x(a)} ${y(b)})`}
      data-selected={highlight} data-positive={point[field] === 1}
      className="pub-projection-point" onClick={highlight ? undefined : () => onSelect(point)}>
      {!highlight && <title>{describePoint(point, recorded)}</title>}
      {highlight ? <circle className="pub-projection-ring" r={9} />
        : point[field] ? <path d="M0 -6 6 0 0 6 -6 0Z" /> : <circle r={4} />}
    </g>;
  }
  return <svg className="pub-projection-plot" viewBox="82 0 447 426" role="img"
    aria-label={`${variant} ${recorded ? "PCA scatter plot" : "illustrative scatter plot"}. Use the event selector to read individual points.`}>
    {ticks.map((tick) => <g key={tick} data-zero={tick === 0}>
      <line x1={x(tick)} x2={x(tick)} y1={22} y2={382} />
      <line x1={140} x2={500} y1={y(tick)} y2={y(tick)} />
      {recorded && <><text x={x(tick)} y={400} textAnchor="middle">{tick.toFixed(1)}</text>
        <text x={136} y={y(tick) + 4} textAnchor="end">{tick.toFixed(1)}</text></>}
    </g>)}
    {points.filter((point) => point[field] === 0).map((point) => draw(point))}
    {points.filter((point) => point[field] === 1).map((point) => draw(point))}
    {selected && draw(selected, true)}
    <text x={320} y={419} textAnchor="middle">{recorded ? "Principal component 1" : "Illustrative horizontal axis"}</text>
    <text transform="translate(98 202) rotate(-90)" textAnchor="middle">{recorded ? "Principal component 2" : "Illustrative vertical axis"}</text>
  </svg>;
}

export function EmbeddingExplorerPage() {
  const [variant, setVariant] = useState<EmbeddingVariant>("E5-A");
  const [split, setSplit] = useState<EmbeddingSplit>("attack_test");
  const [recorded, setRecorded] = useState(false);
  const [label, setLabel] = useState<"original_label" | "contextual_label">("original_label");
  const [filter, setFilter] = useState("all");
  const [selection, setSelection] = useState("");
  const { data: dataset } = useDataset();
  const health = useQuery({ queryKey: ["health"], queryFn: api.health, enabled: !isStaticDataMode });
  const local = health.data?.deployment_mode === "local" && !isStaticDataMode;
  const projection = useQuery({ queryKey: ["embedding-projection", split], queryFn: () => api.embeddingProjection(split),
    enabled: local && recorded, staleTime: Infinity, retry: false });
  const data = recorded ? projection.data : undefined;
  const sample = recorded ? data?.points : examples;
  const extent = useMemo(() => {
    const maximum = Math.max(0, ...(sample ?? []).flatMap(({ coordinates }) => Object.values(coordinates).flat().map(Math.abs)));
    return Math.max(.5, Math.ceil(maximum * 2) / 2);
  }, [sample]);
  const field = recorded ? label : "original_label";
  const visible = (sample ?? []).filter((point) => filter === "all" || String(point[field]) === filter);
  const selected = visible.find((point) => pointKey(point) === selection) ?? visible[0];
  const definition = variants.find(([id]) => id === variant)!;
  const measured = dataset?.representation.find((row) => row.variant === definition[2] && row.split === (recorded ? split : "attack_test"));
  const [a, b] = selected?.coordinates[variant] ?? [];
  const coincident = selected ? visible.filter((point) => point.coordinates[variant][0] === a && point.coordinates[variant][1] === b).length : 0;
  function changeSource(value: boolean) {
    setRecorded(value); setSelection(""); setFilter("all");
  }

  return <>
    <p className="pub-kicker">Visual research lab · representation</p>
    <h1 className="pub-editorial-title">Explore the embedding space</h1>
    <p className="pub-lede">Each event description becomes a vector with 384 values. Switch between E5 representations to see what changes when text includes entities and directed relationships.</p>
    <section className="pub-projection pub-section-space" aria-label="Embedding explorer">
      <p className="pub-kicker">{recorded ? "Local dataset · computed PCA view" : "Teaching sketch · invented coordinates and labels"}</p>
      {local ? <div className="pub-controls" role="group" aria-label="Embedding data source">
        <button className="pub-segment" type="button" aria-pressed={!recorded} onClick={() => changeSource(false)}>Illustrative examples</button>
        <button className="pub-segment" type="button" aria-pressed={recorded} onClick={() => changeSource(true)}>Load saved embeddings</button>
      </div> : <p>Recorded event coordinates and IDs are not part of the public snapshot.</p>}
      <div className="pub-controls" role="group" aria-label="Embedding representation">
        {variants.map(([id, title]) => <button className="pub-segment" key={id} type="button" aria-pressed={id === variant} onClick={() => setVariant(id)}>{id} · {title}</button>)}
      </div>
      <div className="pub-chart-controls">
        {recorded && <><label>Partition<select value={split} onChange={(event) => { setSplit(event.target.value as EmbeddingSplit); setSelection(""); setFilter("all"); }}>
          {splits.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </select></label><label>Label scheme<select value={label} onChange={(event) => { setLabel(event.target.value as typeof label); setFilter("all"); }}>
          <option value="original_label">Original edge-derived label</option><option value="contextual_label">Contextual indicator</option>
        </select></label></>}
        <label>Visible labels<select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">All points</option><option value="0">Negative only</option><option value="1">Positive only</option>
        </select></label>
      </div>
      {recorded && projection.isPending && <p role="status">Projecting the saved vectors…</p>}
      {recorded && projection.isError && <p role="status">{projection.error.message} <button type="button" className="pub-segment" onClick={() => projection.refetch()}>Retry</button></p>}
      {sample && <div className="pub-projection-layout">
        <ProjectionPlot points={visible} variant={variant} extent={extent} recorded={recorded} field={field} selected={selected} onSelect={(point) => setSelection(pointKey(point))} />
        <div className="pub-projection-inspector">
          <p><strong>Circle</strong> · negative<br /><strong>Diamond</strong> · positive</p>
          <p>{formatNumber(visible.length)} of {formatNumber(sample.length)} {recorded ? "sampled points" : "teaching points"} shown.</p>
          <label>Inspect point<select value={selected ? pointKey(selected) : ""} disabled={!visible.length} onChange={(event) => setSelection(event.target.value)}>
            {visible.length ? visible.map((point) => <option value={pointKey(point)} key={pointKey(point)}>{describePoint(point, recorded)}</option>) : <option value="">No matching points</option>}
          </select></label>
          {selected && <div className="pub-inspect-card" aria-live="polite">
            <strong>{describePoint(selected, recorded)}</strong>
            <p>{!recorded ? `Illustrative ${selected.original_label ? "positive" : "negative"} label` : <>
              {labelName(selected.original_label)} · Contextual indicator: {selected.contextual_label ? "positive" : "negative"}.<br />
              PC1: {a?.toFixed(3)} · PC2: {b?.toFixed(3)}
            </>}</p>
            {coincident > 1 && <p>{coincident} visible points share these {recorded ? "display" : "illustrative"} coordinates. Use the selector to distinguish them.</p>}
            {recorded && <Link className="pub-text-link" to="/understand/provenance-explorer" state={{ phase: selected.phase, event: selected.event_id }}>Inspect event provenance <ArrowUpRight size={15} /></Link>}
          </div>}
        </div>
      </div>}
      {data ? <p>{formatNumber(data.source_count)} events in this partition, including {formatNumber(data.source_positive_count)} with original positive labels. The plot samples up to 240 original negatives and 80 original positives (seed {data.seed}), so the point mix does not show prevalence. All views use the same two axes fitted to {formatNumber(data.fit_count)} E5-C training vectors. They explain {formatPercent(data.variance_ratio[0] + data.variance_ratio[1], 1)} of variance in that fit sample, not in all displayed vectors.</p>
        : !recorded && <p>These are not projected research vectors. Identical input text can map to the same point; adding context can change the input without guaranteeing class separation.</p>}
      <p>Two dimensions omit information. Position, distance and source labels are not detector predictions or evidence of an attack on their own.</p>
    </section>
    <section className="pub-section-space" aria-label="Saved representation evidence">
      <p className="pub-kicker">Measured separately · {variant}</p>
      <h2 className="pub-editorial-h2">How much distinct text reached the encoder?</h2>
      {measured && <p>{formatNumber(measured.unique_descriptions)} distinct descriptions across {formatNumber(measured.events)} events in the {splits.find(([id]) => id === measured.split)?.[1].toLowerCase()} partition. Distinct descriptions are exact text counts, not a count of distinct vectors or visual clusters.</p>}
      <div className="pub-actions">
        <Link className="pub-text-link" to="/experiments/ablation">Compare measured E5 results <ArrowUpRight size={15} /></Link>
        <Link className="pub-text-link" to="/documentation/dataset">Explore the dataset <ArrowUpRight size={15} /></Link>
      </div>
    </section>
  </>;
}
