import { useState } from "react";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { useStepPlayback } from "@/hooks/use-step-playback";
import { PlaybackControls } from "./PlaybackControls";
import { ProgressReveal, ResearchMotion } from "./ProgressMotion";

const layers = [
  { name: "Input", label: "Input", size: 384, nodes: 6, detail: "The model receives a numerical representation of one event, not its annotation." },
  { name: "Compression", label: "Encoder", size: 128, nodes: 4, detail: "The encoder compresses the 384 input values through a 128-unit layer." },
  { name: "Bottleneck", label: "Bottleneck", size: 32, nodes: 2, detail: "The 32-unit bottleneck is the smallest representation. It has to retain enough information for reconstruction." },
  { name: "Reconstruction", label: "Decoder", size: 128, nodes: 4, detail: "The decoder expands the bottleneck through 128 units towards the original input size." },
  { name: "Reconstructed output", label: "Output", size: 384, nodes: 6, detail: "The result has 384 values again. The detector averages the squared differences between all input and reconstructed dimensions." },
] as const;

const examples = [
  { label: "Familiar benign pattern", description: "Illustrative routine file access, similar to training examples.", input: [0.24, 0.53, 0.71, 0.62, 0.44, 0.29], output: [0.26, 0.51, 0.69, 0.60, 0.43, 0.31] },
  { label: "Unfamiliar pattern", description: "Illustrative unfamiliar activity. It might still be legitimate.", input: [0.35, 0.80, 0.32, 0.77, 0.28, 0.70], output: [0.31, 0.53, 0.65, 0.58, 0.45, 0.32] },
  { label: "Positively annotated example", description: "An illustrative example labelled positive for teaching. Its toy reconstruction is fairly close: annotation does not mechanically determine error.", input: [0.21, 0.59, 0.78, 0.61, 0.44, 0.33], output: [0.26, 0.52, 0.69, 0.58, 0.45, 0.29] },
] as const;

const x = (i: number) => 45 + 126 * i;
const ys = (count: number) => Array.from({ length: count }, (_, i) => 84 + 20 * (i - (count - 1) / 2));

export function AutoencoderDemo() {
  const [exampleIndex, setExample] = useState(0);
  const [speed, setSpeed] = useState(1);
  const playback = useStepPlayback(layers.length, 1250 / speed);
  const reduced = useReducedMotion();
  const current = layers[playback.index];
  const example = examples[exampleIndex];
  const mse = example.input.reduce((total, value, index) => total + (value - example.output[index]) ** 2, 0) / example.input.length;
  return <div className="pub-demo pub-autoencoder">
    <p className="pub-kicker">Recorded architecture · illustrative inference</p>
    <div className="pub-controls" role="group" aria-label="Example type">
      {examples.map(({ label }, index) => <button className="pub-segment" type="button" aria-pressed={exampleIndex === index} key={label} onClick={() => setExample(index)}>{label}</button>)}
    </div>
    <p>{example.description} No model inference is performed in the browser.</p>
    <ResearchMotion>
      <svg className="pub-layer-map" viewBox="0 0 600 174" aria-hidden="true">
        {layers.slice(0, -1).map(({ nodes, name }, i) => <g key={name} data-active={i === playback.index - 1 || i === playback.index}>
          {ys(nodes).flatMap((from, a) => ys(layers[i + 1].nodes).map((to, b) =>
            <line key={`${a}-${b}`} x1={x(i)} y1={from} x2={x(i + 1)} y2={to} />))}
        </g>)}
        {!reduced && playback.index > 0 && <m.circle key={`${playback.index}-${exampleIndex}`} r={5} cy={84} fill="var(--primary)"
          initial={{ cx: x(playback.index - 1) }} animate={{ cx: x(playback.index) }} transition={{ duration: .46 / speed, ease: "easeOut" }} />}
        {layers.map((layer, index) => <g key={layer.name} data-active={index === playback.index}>
          <text x={x(index)} y={20}>{layer.label}</text>
          {ys(layer.nodes).map((y) => <circle key={y} cx={x(index)} cy={y} r={5.9} />)}
          <text x={x(index)} y={157}>{layer.size}</text>
        </g>)}
      </svg>
    </ResearchMotion>
    <div className="pub-controls" role="group" aria-label="Autoencoder stage">
      {layers.map(({ name, size }, index) => <button className="pub-segment" type="button" key={name}
        aria-label={`${index + 1}. ${name}`} aria-pressed={index === playback.index} onClick={() => playback.select(index)}>{index + 1}. {name} <small>{size}</small></button>)}
    </div>
    <div className="pub-auto-actions">
      <PlaybackControls playback={playback} length={layers.length} name="Autoencoder playback" playLabel="Run inference demo" />
      <label>Animation speed<select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
        <option value={0.5}>0.5×</option><option value={1}>1×</option><option value={1.5}>1.5×</option><option value={2}>2×</option>
      </select></label>
    </div>
    <ResearchMotion><ProgressReveal key={current.name}>
      <p className="pub-pipeline-evidence" aria-live="polite"><strong>{current.label} · {current.size} units.</strong> {current.detail}</p>
    </ProgressReveal></ResearchMotion>
    <table className="pub-vector-grid">
      <caption>Six toy values for comparison, not a measured 384-dimensional vector</caption>
      <thead><tr><th scope="col">Vector</th>{example.input.map((_, i) => <th scope="col" key={i}>{i + 1}</th>)}</tr></thead>
      <tbody>{([["Input", example.input], ["Output", example.output]] as const).map(([label, values]) =>
        <tr key={label} data-dimmed={label === "Output" && playback.index < 3}><th scope="row">{label}</th>
          {values.map((value, i) => <td key={i} style={{ background: `color-mix(in srgb, var(--primary) ${5 + value * 23}%, var(--surface))` }}>{value.toFixed(2)}</td>)}</tr>)}</tbody>
    </table>
    {playback.index >= 3 && <p><strong>Toy mean squared error: {mse.toFixed(5)}.</strong> This averages six squared differences, not a saved research score.
      {exampleIndex === 1 ? " A larger error could warrant review, but unusual does not mean malicious." : " A close reconstruction does not prove the event was benign."}</p>}
  </div>;
}
