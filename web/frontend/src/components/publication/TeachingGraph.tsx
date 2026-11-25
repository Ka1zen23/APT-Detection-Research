import { useId, useState } from "react";

export const activities = [
  { name: "Routine activity", source: "Scheduled backup", process: "Backup utility", target: "Shared archive", kind: "Expected destination", explanation: "A scheduled backup reads a file and sends a copy to the shared archive." },
  { name: "Unusual activity", source: "Unexpected task", process: "Unknown process", target: "New destination", kind: "Needs investigation", explanation: "An unexpected task reads the same file and sends a copy to a new destination. That context warrants a closer look; it does not prove an attack." },
] as const;

export function TeachingGraph() {
  const [mode, setMode] = useState(0);
  const title = useId();
  const graph = activities[mode];
  return (
    <figure className="pub-graph" data-unusual={mode === 1}>
      <div className="pub-graph-head">
        <span className="pub-kicker"><span className="pub-signal" /> SYSTEM ACTIVITY</span>
        <span className="pub-figure-id">FIG. 01</span>
      </div>
      <svg viewBox="0 0 460 268" role="img" aria-labelledby={title} className="pub-network">
        <title id={title}>{graph.explanation}</title>
        <path className="pub-graph-guides" d="M230 13v242M25 121h410M25 207h410" />
        <g key={mode} className="pub-graph-content">
          <path className="pub-edge" d="M230 70v43m-4-5 4 5 4-5M230 153v34q0 20-20 20H169m5-4-5 4 5 4" />
          <path className="pub-edge pub-graph-target" d="M230 153v34q0 20 20 20h40m-5-4 5 4-5 4" />
          <text className="pub-edge-label" x="243" y="94">starts</text>
          <text className="pub-edge-label" x="176" y="182">reads</text>
          <text className="pub-edge-label pub-graph-target" x="244" y="182">copies to</text>
          <g transform="translate(156 28)">
            <rect width="148" height="42" rx="7" /><circle cx="18" cy="21" r="4" /><text x="31" y="25">{graph.source}</text>
          </g>
          <g transform="translate(156 113)" className="pub-node-central">
            <rect width="148" height="42" rx="7" /><path d="m15 17 4 4-4 4m6 0h5" /><text x="31" y="25">{graph.process}</text>
          </g>
          <g transform="translate(21 186)">
            <rect width="148" height="42" rx="7" /><path d="M14 15h7l4 4v9H14z" /><text x="31" y="25">Project file</text>
          </g>
          <g transform="translate(290 186)" className="pub-graph-target">
            <rect width="148" height="42" rx="7" /><path d="M14 16h11v10H14zm0 5h11" /><text x="31" y="25">{graph.target}</text>
          </g>
        </g>
      </svg>
      <div className="pub-graph-controls" aria-label="Compare activities" role="group">
        {activities.map((activity, index) => <button className="pub-segment" key={activity.name} type="button" aria-pressed={mode === index} onClick={() => setMode(index)}>{activity.name}</button>)}
      </div>
      <figcaption><span className="pub-figure-id">ILLUSTRATIVE EXAMPLE</span><span aria-live="polite">{graph.kind} · {graph.explanation}</span></figcaption>
    </figure>
  );
}
