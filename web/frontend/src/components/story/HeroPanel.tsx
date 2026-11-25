import { ProvenanceGraph } from "@/components/story/ProvenanceGraph";

function ProvenanceList() {
  return (
    <ul className="st-provenance-list" aria-label="Event 246 provenance">
      <li>
        <span className="st-provenance-list__src">P2 process ethtool</span>
        <span className="st-provenance-list__op">execve</span>
        <span className="st-provenance-list__dst">P1 process ethtool</span>
      </li>
      <li>
        <span className="st-provenance-list__src">P1 process ethtool</span>
        <span className="st-provenance-list__op">load</span>
        <span className="st-provenance-list__dst">A1 file ethtool script</span>
      </li>
      <li>
        <span className="st-provenance-list__src">P1 process ethtool</span>
        <span className="st-provenance-list__op">load</span>
        <span className="st-provenance-list__dst">A2 file /bin/sh</span>
      </li>
      <li>
        <span className="st-provenance-list__src">P1 process ethtool</span>
        <span className="st-provenance-list__op">load</span>
        <span className="st-provenance-list__dst">A3 file ld-linux</span>
      </li>
    </ul>
  );
}

export function HeroPanel() {
  return (
    <figure className="st-panel st-hero-panel">
      <div className="st-panel__head">
        <span>Event 246, phase 2</span>
        <span>real provenance</span>
      </div>

      <ProvenanceGraph />
      <ProvenanceList />

      <div className="st-graph-legend" aria-hidden="true">
        <span>
          <i className="st-graph-legend__node" />
          process
        </span>
        <span>
          <i className="st-graph-legend__file" />
          file
        </span>
        <span>
          <i className="st-graph-legend__edge" />
          operation
        </span>
      </div>

      <figcaption className="st-hero-panel__caption">
        Provenance, event 246.
      </figcaption>
    </figure>
  );
}
