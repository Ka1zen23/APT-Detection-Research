export function ProvenanceGraph() {
  return (
    <svg
      className="st-diagram"
      viewBox="0 0 560 320"
      role="img"
      aria-labelledby="event-246-title event-246-desc"
    >
      <title id="event-246-title">Provenance graph for event 246</title>
      <desc id="event-246-desc">
        Process P2 triggers process P1 with execve. P1 loads three files: A1, A2
        and A3.
      </desc>
      <defs>
        <marker
          id="st-arrow"
          viewBox="0 0 6 6"
          refX="5"
          refY="3"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path className="st-diagram__arrow" d="M0 0 L6 3 L0 6 Z" />
        </marker>
      </defs>

      <path className="st-diagram__edge" d="M280 60 L280 122" markerEnd="url(#st-arrow)" />
      <path
        className="st-diagram__edge"
        d="M280 166 C280 202, 90 198, 90 238"
        markerEnd="url(#st-arrow)"
      />
      <path className="st-diagram__edge" d="M280 166 L280 238" markerEnd="url(#st-arrow)" />
      <path
        className="st-diagram__edge"
        d="M280 166 C280 202, 470 198, 470 238"
        markerEnd="url(#st-arrow)"
      />

      <text className="st-diagram__edge-label" x="290" y="96">
        execve
      </text>
      <text className="st-diagram__edge-label" x="158" y="210">
        load
      </text>
      <text className="st-diagram__edge-label" x="290" y="222">
        load
      </text>
      <text className="st-diagram__edge-label" x="382" y="210">
        load
      </text>

      <g>
        <rect className="st-diagram__node" x="220" y="16" width="120" height="44" rx="6" />
        <text className="st-diagram__id" x="232" y="34">
          P2
        </text>
        <text className="st-diagram__label" x="232" y="51">
          process ethtool
        </text>
      </g>

      <g>
        <rect className="st-diagram__node st-diagram__node--lead" x="220" y="122" width="120" height="44" rx="6" />
        <text className="st-diagram__id" x="232" y="140">
          P1
        </text>
        <text className="st-diagram__label" x="232" y="157">
          process ethtool
        </text>
      </g>

      <g>
        <rect className="st-diagram__node" x="10" y="238" width="160" height="48" rx="6" />
        <text className="st-diagram__id" x="22" y="256">
          A1
        </text>
        <text className="st-diagram__label" x="22" y="273">
          file ethtool script
        </text>
      </g>

      <g>
        <rect className="st-diagram__node" x="200" y="238" width="160" height="48" rx="6" />
        <text className="st-diagram__id" x="212" y="256">
          A2
        </text>
        <text className="st-diagram__label" x="212" y="273">
          file /bin/sh
        </text>
      </g>

      <g>
        <rect className="st-diagram__node" x="390" y="238" width="160" height="48" rx="6" />
        <text className="st-diagram__id" x="402" y="256">
          A3
        </text>
        <text className="st-diagram__label" x="402" y="273">
          file ld-linux
        </text>
      </g>
    </svg>
  );
}
