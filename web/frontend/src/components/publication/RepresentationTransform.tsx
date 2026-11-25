import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { Link } from "react-router-dom";
import { useAblation } from "@/hooks/queries";
import { formatDecimal, formatNumber } from "@/lib/format";
import { kinds, relationships } from "@/lib/provenance-graph";
import { api, isStaticDataMode } from "@/services/api";
import type { ProvenanceGraphData } from "@/types/api";
import { FindingPreview } from "./FindingPreview";
import { ProgressReveal, ResearchMotion } from "./ProgressMotion";

const variants = [
  ["E5-A", "Operation only", "Without names or links, the two activities look identical to the model."],
  ["E5-B", "With entity attributes", "Process, file and destination attributes are visible, but their directed links are not stated."],
  ["E5-C", "Full provenance", "Directed links preserve which process used a file or a connection."],
] as const;

const examples = [
  { title: "Illustrative negative label", process: "Backup utility", file: "Project file", target: "Shared archive" },
  { title: "Illustrative positive label", process: "Unfamiliar process", file: "Project file", target: "New destination" },
] as const;

const views = ["Records", "Description", "Graph"] as const;
type View = typeof views[number];

function Entity({ label, type, drawn = true }: { label: string; type: "process" | "artifact" | "network" | "unknown"; drawn?: boolean }) {
  const reduced = useReducedMotion();
  return <m.span className="pub-transform-entity" data-kind={type} data-drawn={drawn} initial={false}
    animate={{ borderRadius: drawn ? 5 : 0, scale: drawn && !reduced ? [.97, 1] : 1 }}
    transition={{ duration: reduced ? 0 : .26, ease: "easeOut" }}>
    <i aria-hidden="true" /><span><small>{kinds[type].label}</small>{label}</span>
  </m.span>;
}

function ToyRepresentation({ example, level, view }: { example: typeof examples[number]; level: number; view: View }) {
  if (view === "Records") return <pre className="pub-transform-code">{`operation: read\noperation: copy${level >= 1 ? `\nprocess: ${example.process}\nfile: ${example.file}\ndestination: ${example.target}` : ""}${level >= 2 ? "\nfrom: process | relation: Used | to: file\nfrom: process | relation: Used | to: connection" : ""}`}</pre>;
  if (view === "Description" && level === 0) return <p>Read → Copy</p>;
  if (level === 0) return <div className="pub-transform-flow"><span className="pub-transform-operation">Read</span><ArrowRight size={16} aria-label="then" /><span className="pub-transform-operation">Copy</span></div>;
  const drawn = view === "Graph";
  return <div className="pub-transform-flow" data-drawn={drawn}>
    {!drawn && level === 1 && <span>Read and copy. Entities:</span>}
    <Entity key="process" label={example.process} type="process" drawn={drawn} />
    {level === 2 && <p key="used">{drawn && <ArrowRight size={16} aria-hidden="true" />} used</p>}
    <div className="pub-transform-targets" key="targets">
      <Entity label={example.file} type="artifact" drawn={drawn} />
      {!drawn && level === 2 && <span>and a connection to</span>}
      <Entity key="target" label={example.target} type="network" drawn={drawn} />
    </div>
  </div>;
}

function LocalRepresentation({ event, level, view, operation }: { event: ProvenanceGraphData; level: number; view: View; operation: string }) {
  if (!level) return <p>{operation}</p>;
  const nodes = new Map(event.nodes.map((node) => [node.id, node]));
  if (view === "Records") return <pre className="pub-transform-code">{level === 1
    ? event.nodes.map(({ kind, label }) => `${kinds[kind].label}: ${label}`).join("\n")
    : event.edges.map(({ source, target, relation }) => `${nodes.get(source)?.label} | ${relation} | ${nodes.get(target)?.label}`).join("\n")}</pre>;
  if (view !== "Graph") return <ul>{level === 1 ? event.nodes.map(({ id, label }) => <li key={id}>{label}</li>)
    : event.edges.map(({ id, source, relation, target }) => <li key={id}>{nodes.get(source)?.label} {relationships[relation]} {nodes.get(target)?.label}.</li>)}</ul>;
  if (level === 1) return <div className="pub-transform-targets">{event.nodes.map(({ id, label, kind }) => <Entity key={id} label={label} type={kind} />)}</div>;
  return <div className="pub-transform-links">{event.edges.map(({ id, source, relation, target }) => {
    const a = nodes.get(source), b = nodes.get(target);
    return <div key={id}>{a && <Entity label={a.label} type={a.kind} />}<p><ArrowRight size={15} aria-hidden="true" /> {relationshipLabel(relation)}</p>{b && <Entity label={b.label} type={b.kind} />}</div>;
  })}</div>;
}

const relationshipLabel = (relation: keyof typeof relationships) => relationships[relation];

export function ProvenanceDemo({ evidenceLink = true }: { evidenceLink?: boolean }) {
  const [mode, setMode] = useState(0);
  const [view, setView] = useState<View>("Description");
  const [recorded, setRecorded] = useState(false);
  const { data } = useAblation();
  const health = useQuery({ queryKey: ["health"], queryFn: api.health, enabled: !isStaticDataMode });
  const local = !isStaticDataMode && health.data?.deployment_mode === "local";
  const pair = useQuery({ queryKey: ["matched-provenance"], queryFn: api.matchedProvenance, enabled: recorded && local });
  const a = useQuery({ queryKey: ["provenance-graph", pair.data?.phase, pair.data?.negative_event_id],
    queryFn: () => api.provenance(pair.data!.phase, pair.data!.negative_event_id), enabled: recorded && local && Boolean(pair.data) });
  const b = useQuery({ queryKey: ["provenance-graph", pair.data?.phase, pair.data?.positive_event_id],
    queryFn: () => api.provenance(pair.data!.phase, pair.data!.positive_event_id), enabled: recorded && local && Boolean(pair.data) });
  const selected = variants[mode];
  const metric = data?.models.find((row) => row.id === selected[0]);
  const saved = data?.examples.representations.find((row) => row.id === selected[0]);
  const conflict = data?.conflicts.operation_only?.original;
  const negatives = data?.derived.operation_only_conflicting_negative_events;
  const sample = recorded && local && pair.data && a.data && b.data ? { pair: pair.data, events: [a.data, b.data] } : null;
  return <div className="pub-demo pub-transform">
    <p className="pub-kicker">Representation transform · {recorded ? "local dataset" : "illustrative labelled pair"}</p>
    <div className="pub-controls" role="group" aria-label="Event representation">{variants.map(([id, label], index) =>
      <button className="pub-segment" type="button" key={id} aria-pressed={index === mode} onClick={() => setMode(index)}>{label} <small>{id}</small></button>)}</div>
    <div className="pub-controls" role="group" aria-label="Representation view">{views.map((value) =>
      <button className="pub-segment" type="button" key={value} aria-pressed={view === value} onClick={() => setView(value)}>{value}</button>)}</div>
    {local && <div className="pub-controls" role="group" aria-label="Example source">
      <button className="pub-segment" type="button" aria-pressed={!recorded} onClick={() => setRecorded(false)}>Illustrative pair</button>
      <button className="pub-segment" type="button" aria-pressed={recorded} onClick={() => setRecorded(true)}>Load recorded matched pair</button>
    </div>}
    {recorded ? sample ? <>
      <p>These Phase 2 attack-test events share the exact saved operation-only description. Entity and graph panels show bounded summaries of their actual links, not verbatim model inputs.</p>
      <div className="pub-demo-pair" aria-live="polite">{sample.events.map((event, index) => <div key={event.event_id}>
        <strong>{index ? "Original positive annotation" : "Original negative label"} · event {event.event_id}</strong>
        <ResearchMotion><ProgressReveal key={`${mode}-${view}`}><LocalRepresentation event={event} level={mode} view={view} operation={sample.pair.operation_description} /></ProgressReveal></ResearchMotion>
        {event.limited && <p>Bounded excerpt: {event.edges.length} of {event.edge_count} recorded links.</p>}
      </div>)}</div>
      <p className="pub-chart-source">Source: <code>{sample.pair.source}</code></p>
    </> : <p role="status">{pair.isError || a.isError || b.isError ? "The local pair or graph excerpts could not be loaded. Select Illustrative pair to return to the example." : "Loading an exact operation-only match from the local files…"}</p>
      : <>
        <div className="pub-demo-pair" aria-live="polite">{examples.map((example) => <div key={example.title}><strong>{example.title}</strong>
          <ResearchMotion><ProgressReveal key={mode}><ToyRepresentation example={example} level={mode} view={view} /></ProgressReveal></ResearchMotion>
        </div>)}</div>
        <p>The labels in this example are assigned for teaching, not inferred from how a process looks.</p>
      </>}
    <p>{selected[2]}</p>
    <div className="pub-measured">
      <p className="pub-kicker">Measured experiment · {selected[0]}</p>
      <FindingPreview title={`Average Precision · E5-A to E5-C (selected: ${selected[0]})`} mode="bar" highlight={selected[0]}
        rows={variants.map(([id]) => ({ id, value: data?.models.find((model) => model.id === id)?.average_precision }))} />
      <p>ROC-AUC for {selected[0]}: <strong>{formatDecimal(metric?.roc_auc, 6)}</strong>.</p>
      {conflict && negatives != null && <p>In the measured attack-test partition, one operation-only description covered {formatNumber(conflict.conflicting_positives)} originally positive and {formatNumber(negatives)} negatively labelled events.</p>}
      {evidenceLink && <Link className="pub-text-link" to="/experiments/ablation">Compare all three E5 results <ArrowRight size={15} /></Link>}
      <Link className="pub-text-link" to="/understand/provenance-explorer">Open the provenance graph explorer <ArrowUpRight size={15} /></Link>
      <Link className="pub-text-link" to="/understand/embedding-explorer">Compare E5 in the embedding explorer <ArrowUpRight size={15} /></Link>
      {saved && <details className="pub-disclosure"><summary>See the example supplied with the evidence</summary><p>{data?.examples.event_context} · {data?.examples.source}</p><p>{saved.description}</p></details>}
    </div>
  </div>;
}
