import { Component, lazy, Suspense, useCallback, useId, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { PlaybackControls } from "@/components/publication/PlaybackControls";
import type { CameraCommand } from "@/components/publication/ProvenanceScene";
import { useStepPlayback } from "@/hooks/use-step-playback";
import { useTheme } from "@/hooks/use-theme";
import { kinds, placeNodes, provenanceColours, relationships, teachingGraph, timestampGroups, type Coordinates } from "@/lib/provenance-graph";
import { api, isStaticDataMode } from "@/services/api";
import type { ProvenanceGraphData } from "@/types/api";

const ProvenanceScene = lazy(() => import("@/components/publication/ProvenanceScene"));

class GraphBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function supports3D() {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2");
    context?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(context);
  } catch {
    return false;
  }
}

function Annotation({ value }: { value: number | null }) {
  return <>{value === 1 ? "Positive annotation in the source" : value === 0 ? "Negative label in the source" : "No source annotation shown"}</>;
}

function FlatGraph({ graph, positions, selected, emphasis, neighbours, onSelect }: {
  graph: ProvenanceGraphData; positions: Map<string, Coordinates>; selected: string; emphasis: Set<string>; neighbours: Set<string>; onSelect: (id: string) => void;
}) {
  const normal = useId().replaceAll(":", "");
  const strong = useId().replaceAll(":", "");
  const point = (id: string) => {
    const [x, y] = positions.get(id) ?? [0, 0];
    return [320 + x * 66, 180 - y * 52];
  };
  return <svg className="pub-provenance-svg" role="img" aria-label="Two-dimensional provenance graph. Choose nodes and relationships in the accessible controls below." viewBox="0 0 640 360">
    <defs>
      <marker id={normal} markerWidth={8} markerHeight={8} refX={7} refY={4} orient="auto"><path d="M0 0 8 4 0 8Z" className="pub-flat-arrow" /></marker>
      <marker id={strong} markerWidth={8} markerHeight={8} refX={7} refY={4} orient="auto"><path d="M0 0 8 4 0 8Z" className="pub-flat-arrow" data-active="true" /></marker>
    </defs>
    {graph.edges.map((edge) => {
      const [x1, y1] = point(edge.source), [x2, y2] = point(edge.target);
      const distance = Math.hypot(x2 - x1, y2 - y1);
      const dx = distance ? (x2 - x1) / distance : 0, dy = distance ? (y2 - y1) / distance : 0;
      const active = emphasis.has(edge.id);
      const path = distance < 2 ? `M${x1 + 11} ${y1 - 4} C${x1 + 47} ${y1 - 54}, ${x1 - 47} ${y1 - 54}, ${x1 - 11} ${y1 - 4}` :
        `M${x1 + dx * 10} ${y1 + dy * 10} L${x2 - dx * 14} ${y2 - dy * 14}`;
      return <path key={edge.id} className="pub-flat-edge" data-active={active} d={path} markerEnd={`url(#${active ? strong : normal})`}><title>{edge.relation}</title></path>;
    })}
    {graph.nodes.map(({ id, kind, label }) => {
      const [x, y] = point(id);
      return <g key={id} transform={`translate(${x} ${y})`} className="pub-flat-node" data-kind={kind} data-active={id === selected}
        data-neighbour={neighbours.has(id)} onClick={() => onSelect(id)}>
        <title>{label}</title>
        {kind === "process" ? <circle r={10} /> : kind === "artifact" ? <rect x={-9} y={-9} width={18} height={18} rx={2} />
          : kind === "network" ? <path d="M0 -12 12 0 0 12 -12 0Z" /> : <path d="M0 -11 11 11 -11 11Z" />}
        {(graph.nodes.length <= 8 || id === selected) && <text y={-17}>{label.length > 27 ? `${label.slice(0, 24)}…` : label}</text>}
      </g>;
    })}
  </svg>;
}

function GraphWorkspace({ graph }: { graph: ProvenanceGraphData }) {
  const [dimensions, setDimensions] = useState<"2d" | "3d">("2d");
  const [message, setMessage] = useState("");
  const [selection, setSelection] = useState(graph.nodes[0]?.id ?? "");
  const [relationshipId, setRelationshipId] = useState("");
  const [showSequence, setShowSequence] = useState(false);
  const [command, setCommand] = useState<CameraCommand>();
  const { resolvedTheme } = useTheme();
  const positions = useMemo(() => placeNodes(graph), [graph]);
  const timeline = useMemo(() => timestampGroups(graph.edges), [graph]);
  const playback = useStepPlayback(timeline.length);
  const node = graph.nodes.find(({ id }) => id === selection);
  const edge = graph.edges.find(({ id }) => id === relationshipId);
  const currentFrame = showSequence ? timeline[playback.index] : undefined;
  const linked = graph.edges.filter(({ source, target }) => source === selection || target === selection);
  const neighbours = new Set(linked.flatMap(({ source, target }) => [source, target]));
  const emphasis = new Set(currentFrame?.edges ?? (edge ? [edge.id] : linked.map(({ id }) => id)));
  const educational = graph.phase === "educational";
  const contextLost = useCallback(() => {
    setDimensions("2d");
    setMessage("The WebGL context was lost. The same data is shown in 2D.");
  }, []);
  function selectNode(id: string) {
    setSelection(id);
    setRelationshipId("");
    setShowSequence(false);
    playback.pause();
  }
  function selectRelationship(id: string) {
    setRelationshipId(id);
    setShowSequence(false);
    playback.pause();
  }
  function camera(action: CameraCommand["action"]) {
    setCommand({ action, stamp: (command?.stamp ?? 0) + 1, point: positions.get(selection) });
  }
  const fallback = <FlatGraph graph={graph} positions={positions} selected={selection} emphasis={emphasis} neighbours={neighbours} onSelect={selectNode} />;
  const names = new Map(graph.nodes.map(({ id, label }) => [id, label]));

  return <div className="pub-provenance-workspace">
    {educational ? <p className="pub-kicker">Educational graph · illustrative relationships and times</p>
      : <p className="pub-kicker">Recorded local graph · {graph.phase} event {graph.event_id}</p>}
    {!educational && <p>{graph.edges.length} of {graph.edge_count} recorded relationships shown. Original positive edge annotations in this event: {graph.original_positive_edges}.
      {graph.limited && " The excerpt is bounded or omits relationships with missing endpoints."} {graph.unresolved_nodes > 0 && `${graph.unresolved_nodes} endpoints are unresolved.`}</p>}
    <div className="pub-controls" role="group" aria-label="Graph display">
      <button className="pub-segment" type="button" aria-pressed={dimensions === "2d"} onClick={() => { setDimensions("2d"); setMessage(""); }}>2D graph</button>
      <button className="pub-segment" type="button" aria-pressed={dimensions === "3d"} onClick={() => {
        if (supports3D()) { setDimensions("3d"); setMessage(""); }
        else { setDimensions("2d"); setMessage("WebGL 2 is unavailable. All graph data remains accessible in 2D."); }
      }}>Open 3D view</button>
    </div>
    {message && <p role="status">{message}</p>}
    <div className="pub-provenance-viewport">
      {dimensions === "3d" ? <GraphBoundary fallback={<><p role="status">The 3D renderer could not start. The same data is shown in 2D.</p>{fallback}</>}>
        <Suspense fallback={fallback}>
          <ProvenanceScene graph={graph} positions={positions} theme={resolvedTheme} selected={selection} emphasis={emphasis} neighbours={neighbours}
            command={command} select={selectNode} contextLost={contextLost} />
        </Suspense>
      </GraphBoundary> : fallback}
    </div>
    {dimensions === "3d" && <div className="pub-controls" role="group" aria-label="3D camera controls">
      <button className="pub-segment" type="button" onClick={() => camera("rotate")}>Rotate</button>
      <button className="pub-segment" type="button" onClick={() => camera("pan")}>Pan right</button>
      <button className="pub-segment" type="button" onClick={() => camera("closer")}>Zoom in</button>
      <button className="pub-segment" type="button" onClick={() => camera("farther")}>Zoom out</button>
      <button className="pub-segment" type="button" disabled={!node} onClick={() => camera("focus")}>Focus selected node</button>
      <button className="pub-segment" type="button" onClick={() => camera("reset")}>Reset camera</button>
    </div>}
    {dimensions === "3d" && <p className="pub-chart-interpretation">Drag to rotate, right-drag to pan, or use the camera controls above. Zoom uses buttons so scrolling still moves the page. Select a shape or use the node inspector. {node && <>Selected: <strong>{node.label}</strong>.</>}</p>}
    <ul className="pub-provenance-legend" aria-label="Entity shape legend">
      {Object.entries(kinds).filter(([kind]) => graph.nodes.some((node) => node.kind === kind)).map(([kind, item]) => <li key={kind}>
        <i data-kind={kind} aria-hidden="true" style={{ background: provenanceColours[resolvedTheme][kind as keyof typeof kinds] }} /> {item.label} · {item.shape}
      </li>)}
    </ul>
    <p className="pub-chart-interpretation">Arrows point from the recorded source to the recorded target; “was generated by” points from the artifact to the process. Layout is for reading, not a map of physical or causal distance.</p>
    <details className="pub-disclosure"><summary>Directed relationship key</summary>
      <dl className="pub-provenance-relations">
        <div><dt>Used</dt><dd>A process → an artifact or network-related entity it used.</dd></div>
        <div><dt>WasGeneratedBy</dt><dd>An artifact → the process that generated or modified it.</dd></div>
        <div><dt>WasDerivedFrom</dt><dd>An artifact → the earlier artifact it was derived from.</dd></div>
        <div><dt>WasTriggeredBy</dt><dd>A process → the process that triggered it.</dd></div>
      </dl>
    </details>
    {timeline.length ? <>
      {!showSequence ? <div><button type="button" className="pub-segment" onClick={() => { setShowSequence(true); playback.replay(); }}>Replay {educational ? "illustrative" : "recorded"} sequence</button></div>
        : <PlaybackControls playback={playback} length={timeline.length} name="Graph sequence playback" />}
      {currentFrame && <p aria-live="polite">{educational ? "Illustrative" : "Recorded"} time {currentFrame.time} · {currentFrame.edges.length} {currentFrame.edges.length === 1 ? "link" : "links"} in the same timestamp group. {educational ? "These times are invented for teaching." : "This is not a verified real-time attack timeline."}</p>}
    </> : <p className="pub-chart-interpretation">Replay is unavailable: this excerpt has no distinct, complete edge timestamps.</p>}
    <div className="pub-provenance-inspect">
      <section aria-label="Node inspector">
        <label>Inspect node<select value={selection} disabled={!node} onChange={(e) => selectNode(e.target.value)}>
          {graph.nodes.map(({ id, label, kind }, index) => <option key={id} value={id}>{index + 1} · {label} ({kinds[kind].label})</option>)}
        </select></label>
        {node && <div className="pub-inspect-card"><strong>{node.label}</strong><p>{kinds[node.kind].label} · {linked.length} connected {linked.length === 1 ? "relationship" : "relationships"}</p>
          {!educational && <p><Annotation value={node.annotation} /></p>}
          {Object.entries(node.metadata).map(([key, value]) => <p key={key}>{key}: {value}</p>)}</div>}
      </section>
      <section aria-label="Directed relationship inspector">
        <label>Inspect relationship<select value={relationshipId} onChange={(e) => selectRelationship(e.target.value)}>
          <option value="">Connected links for selected node</option>
          {graph.edges.map(({ id, source, relation, target }) => <option value={id} key={id}>{names.get(source)} {relationships[relation]} {names.get(target)}</option>)}
        </select></label>
        {edge ? <div className="pub-inspect-card"><p><strong>{names.get(edge.source)}</strong> → <code>{edge.relation}</code> → <strong>{names.get(edge.target)}</strong></p>
          {edge.operation && <p>Recorded operation: {edge.operation}</p>}
          {!educational && <p><Annotation value={edge.annotation} />{edge.timestamp != null && ` · source timestamp ${edge.timestamp}`}</p>}
        </div> : <ul className="pub-inspect-card">{linked.map(({ id, source, relation, target }) => <li key={id}>{names.get(source)} <code>{relation}</code> {names.get(target)}</li>)}</ul>}
      </section>
    </div>
    {!educational && <p className="pub-chart-source">Source: <code>{graph.source}</code>. Source annotations are not inferred from appearance or an anomaly score.</p>}
  </div>;
}

export function ProvenanceExplorerPage() {
  const incoming = useLocation().state;
  const linkedEvent = !isStaticDataMode && typeof incoming?.event === "string" && incoming.event.length <= 80 ? incoming.event : "";
  const [mode, setMode] = useState<"education" | "local">(linkedEvent ? "local" : "education");
  const [phase, setPhase] = useState(linkedEvent && incoming?.phase === "phase1" ? "phase1" : "phase2");
  const [eventId, setEventId] = useState(linkedEvent);
  const [request, setRequest] = useState<{ phase: string; id: string }>();
  const health = useQuery({ queryKey: ["health"], queryFn: api.health, enabled: !isStaticDataMode });
  const local = !isStaticDataMode && health.data?.deployment_mode === "local";
  const recorded = useQuery({ queryKey: ["provenance-graph", request?.phase, request?.id],
    queryFn: () => api.provenance(request!.phase, request!.id), enabled: local && mode === "local" && Boolean(request) });
  return <>
    <p className="pub-kicker">Visual research lab · system provenance</p>
    <h1 className="pub-editorial-title">See what an event connects</h1>
    <p className="pub-lede">A file operation makes more sense when you can follow it to the program and other resources involved. Explore a small, directed graph without inferring intent from an isolated node.</p>
    <div className="pub-controls pub-section-space" role="group" aria-label="Provenance data mode">
      <button className="pub-segment" type="button" aria-pressed={mode === "education"} onClick={() => setMode("education")}>Educational mode</button>
      <button className="pub-segment" type="button" disabled={!local} aria-pressed={mode === "local"} onClick={() => setMode("local")}>Local dataset mode</button>
    </div>
    {!local && <p className="pub-provenance-note">Recorded event graphs are not included in the public snapshot. They require local API mode and the local research files.</p>}
    {mode === "local" && local && <form className="pub-chart-controls pub-provenance-form" onSubmit={(event) => {
      event.preventDefault();
      if (eventId.trim()) setRequest({ phase, id: eventId.trim() });
    }}>
      <label>Collection phase<select value={phase} onChange={(event) => setPhase(event.target.value)}><option value="phase1">Phase 1</option><option value="phase2">Phase 2</option></select></label>
      <label>Recorded event ID<input type="text" maxLength={80} value={eventId} required onChange={(event) => setEventId(event.target.value)} /></label>
      <button className="pub-button" type="submit">Focus event</button>
    </form>}
    {(mode === "education" || !local) && <GraphWorkspace graph={teachingGraph} />}
    {mode === "local" && local && <>
      {recorded.isFetching && <p role="status">Reading the bounded local excerpt…</p>}
      {recorded.isError && <p role="status">{recorded.error.message}</p>}
      {recorded.data && <GraphWorkspace key={recorded.data.phase + recorded.data.event_id} graph={recorded.data} />}
    </>}
    <div className="pub-actions">
      <Link className="pub-text-link" to="/understand/system-provenance">Return to the provenance chapter <ArrowUpRight size={15} /></Link>
      <Link className="pub-text-link" to="/experiments/ablation">See how E5 compares representations <ArrowUpRight size={15} /></Link>
    </div>
  </>;
}
