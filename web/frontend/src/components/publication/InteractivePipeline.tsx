import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useDataset, useMethodology, useThresholds } from "@/hooks/queries";
import { useStepPlayback } from "@/hooks/use-step-playback";
import { formatNumber, formatThreshold } from "@/lib/format";
import { PlaybackControls } from "./PlaybackControls";
import { ProgressReveal, ResearchMotion } from "./ProgressMotion";

const stages = [
  { id: "P01", short: "Raw records", title: "Raw provenance records", purpose: "The system records actions and the entities involved before any model sees them.", input: "A program opens a project file.", output: "record: from=P1 · type=Used · to=A1", link: "/documentation/dataset" },
  { id: "P02", short: "Graph", title: "Graph construction", purpose: "Connect each relationship to its source and target entities, keeping the recorded direction.", input: "from=P1 · type=Used · to=A1", output: "Backup process (P1) → used → project file (A1)", link: "/understand/provenance-explorer" },
  { id: "P03", short: "Event groups", title: "Event grouping", purpose: "Collect records with the same event identifier into one unit for analysis.", input: "Two relationship records share an event ID.", output: "One event containing the recorded links.", link: "/documentation/methodology" },
  { id: "P04", short: "Description", title: "Natural-language verbalisation", purpose: "Templates turn selected fields into text. Evaluation labels are not inserted into the model input.", input: "An event group with a process, a file and a directed link.", output: "The backup process used the project file.", link: "/understand/event-descriptions" },
  { id: "P05", short: "MiniLM", title: "MiniLM semantic encoder", purpose: "A frozen text encoder maps descriptions with related meanings to numerical representations.", input: "The backup process used the project file.", output: "A fixed-length numerical representation of that description.", link: "/understand/minilm" },
  { id: "P06", short: "Embedding", title: "384-dimensional embeddings", purpose: "Store the normalised vectors for model training and evaluation. The site does not calculate embeddings in the browser.", input: "MiniLM’s output for one event.", output: "One stored vector with 384 numbers; no example coordinates are reported here.", link: "/understand/embeddings" },
  { id: "P07", short: "Autoencoder", title: "Autoencoder", purpose: "The model learns to reconstruct inputs from benign training activity through a narrow bottleneck.", input: "One event embedding.", output: "A reconstructed vector with the same number of values.", link: "/understand/autoencoder" },
  { id: "P08", short: "Error", title: "Reconstruction error", purpose: "Compare the input and reconstructed values. Average the squared differences; an unusually large difference is a clue, not a verdict.", input: "An input vector and its reconstruction.", output: "One mean squared error value for the event.", link: "/understand/reconstruction-error" },
  { id: "P09", short: "Calibration", title: "Threshold calibration", purpose: "Choose the cutoff using the separate benign validation set. The event being evaluated does not set its own cutoff.", input: "Reconstruction errors from benign validation events, not attack-test scores.", output: "A saved cutoff at the 99th percentile (P99).", link: "/experiments/thresholds" },
  { id: "P10", short: "Alerts", title: "Anomaly alerts", purpose: "Compare each score with the saved cutoff and rank alerts for human review. A high score is not proof of malicious activity.", input: "An event score and the validation-derived cutoff.", output: "Above the cutoff → flag for analyst review.", link: "/experiments/alerts" },
  { id: "P12", short: "Correlation", title: "Temporal correlation", purpose: "Planned: connect related alerts across time. This was not part of the current event-level detector.", input: "Proposed input: scored events and their timestamps.", output: "Proposed output: related event sequences. No measured result.", link: "/progress#advanced-detection" },
  { id: "P13", short: "Incidents", title: "Incident reconstruction", purpose: "Planned: trace a candidate incident across related evidence, with uncertainty made explicit.", input: "Proposed input: candidate event sequences.", output: "Proposed output: evidence-linked summary, not a verified incident timeline.", link: "/progress#advanced-detection" },
  { id: "P14", short: "Mitigation", title: "Mitigation recommendations", purpose: "Planned: investigate evidence-grounded recommendations for analysts to review. No mitigation outcome has been validated.", input: "Proposed input: evidence and analyst context.", output: "Proposed output: recommendations for human review, not automatic actions.", link: "/progress#mitigation" },
] as const;

const IMPLEMENTED = 10;
const x = (i: number) => 36 + i * 73;

export function InteractivePipeline() {
  const playback = useStepPlayback(stages.length, 1150, IMPLEMENTED);
  const { data: methodology } = useMethodology();
  const { data: dataset } = useDataset();
  const { data: thresholds } = useThresholds(playback.index >= 8 && playback.index < IMPLEMENTED ? "E2-D" : "");
  const reduced = useReducedMotion();
  const stage = stages[playback.index];
  const planned = playback.index >= IMPLEMENTED;
  const study = methodology?.pipeline.find(({ id }) => id === stage.id);
  const counts = dataset?.counts;
  const p99 = thresholds?.rows.find(({ percentile }) => percentile === thresholds.primary_percentile);
  const mobileStart = Math.max(0, Math.min(playback.index - 1, stages.length - 3));
  const statistics: Partial<Record<typeof stage.id, string | undefined>> = {
    P01: counts && `${formatNumber(counts.raw_records)} raw records across the dataset.`,
    P02: counts && `${formatNumber(counts.nodes)} nodes and ${formatNumber(counts.edges)} directed edges.`,
    P03: counts && `${formatNumber(counts.events)} event-level units.`,
    P05: methodology && `${methodology.encoder.model} · ${methodology.encoder.max_tokens} token input limit.`,
    P06: methodology && `${methodology.encoder.dimensions} dimensions per normalised embedding.`,
    P07: methodology && `${methodology.autoencoder.architecture.join(" → ")} · ${formatNumber(methodology.autoencoder.trainable_parameters)} trainable parameters.`,
    P09: p99 && `E2-D’s saved ${`P${p99.percentile}`} cutoff is ${formatThreshold(p99.threshold)}.`,
    P10: p99 && `At its saved primary cutoff, E2-D flagged ${formatNumber(p99.total_alerts)} attack-test events.`,
  };
  return <div className="pub-pipeline">
    <header><p className="pub-kicker">Interactive methodology · illustrative walkthrough</p>
      <h3>Follow an event through the research pipeline</h3><p>Choose a stage or play the implemented sequence. Dashed links lead to planned work, not recorded outcomes.</p></header>
    <ResearchMotion>
      <svg className="pub-pipeline-map" viewBox="0 0 948 72" aria-hidden="true">
        {stages.slice(0, -1).map((item, i) => <path key={item.id} d={`M${x(i) + 15} 35H${x(i + 1) - 15}`} data-future={i >= IMPLEMENTED - 1}
          data-active={i === playback.index || i === playback.index - 1} />)}
        {!planned && !reduced && [playback.index - 1, playback.index].filter((i) => i >= 0 && i < IMPLEMENTED - 1).map((i) => <m.circle key={`${playback.index}-${i}`} r={4} cy={35} fill="var(--primary)"
          initial={{ cx: x(i) + 16, opacity: 0.45 }} animate={{ cx: x(i + 1) - 16, opacity: 1 }} transition={{ duration: .56, ease: "easeOut" }} />)}
        {stages.map((item, i) => <g key={item.id} data-future={i >= IMPLEMENTED} data-active={i === playback.index}>
          <circle cx={x(i)} cy={35} r={15} /><text x={x(i)} y={39}>{i + 1}</text>
        </g>)}
      </svg>
      <svg className="pub-pipeline-map pub-pipeline-map-mobile" viewBox="0 0 280 62" aria-hidden="true">
        {[0, 1].map((i) => <path key={i} d={`M${52 + i * 104} 31H${124 + i * 104}`} data-future={mobileStart + i >= IMPLEMENTED - 1}
          data-active={mobileStart + i === playback.index || mobileStart + i === playback.index - 1} />)}
        {!planned && !reduced && [0, 1].filter((i) => mobileStart + i < IMPLEMENTED - 1 && (mobileStart + i === playback.index || mobileStart + i === playback.index - 1)).map((i) => <m.circle
          key={`${playback.index}-${i}`} r={4} cy={31} fill="var(--primary)" initial={{ cx: 53 + i * 104 }} animate={{ cx: 123 + i * 104 }} transition={{ duration: .52 }} />)}
        {[0, 1, 2].map((i) => <g key={i} data-future={mobileStart + i >= IMPLEMENTED} data-active={mobileStart + i === playback.index}>
          <circle cx={36 + 104 * i} cy={31} r={15} /><text x={36 + 104 * i} y={35}>{mobileStart + i + 1}</text>
        </g>)}
      </svg>
    </ResearchMotion>
    <ol className="pub-pipeline-stages" aria-label="Pipeline stages">
      {stages.map((item, i) => <li key={item.id}><button type="button" className="pub-segment" aria-pressed={i === playback.index} data-future={i >= IMPLEMENTED}
        onClick={() => playback.select(i)}><span>{i + 1}</span>{item.short}{i >= IMPLEMENTED && <small>Planned</small>}</button></li>)}
    </ol>
    <PlaybackControls playback={playback} length={stages.length} name="Pipeline playback" />
    <section className="pub-pipeline-detail" aria-label="Selected pipeline stage">
      <ResearchMotion><ProgressReveal key={stage.id}>
        <p className="pub-kicker">{String(playback.index + 1).padStart(2, "0")} · {planned ? "Planned · not evaluated" : "Implemented in the research"}</p>
        <h4>{stage.title}</h4><p>{stage.purpose}</p>
        <dl className="pub-pipeline-io"><div><dt>{planned ? "Proposed input" : "Illustrative input"}</dt><dd>{stage.input}</dd></div><div><dt>{planned ? "Proposed output" : "Illustrative output"}</dt><dd>{stage.output}</dd></div></dl>
        {!planned && (statistics[stage.id] || study) && <p className="pub-pipeline-evidence"><strong>{statistics[stage.id] ? "Recorded research detail:" : "Methodology record:"}</strong> {statistics[stage.id] ?? study?.description}</p>}
        <div className="pub-controls"><Link className="pub-text-link" to={stage.link}>Explore this stage <ArrowUpRight size={15} /></Link>{stage.link !== "/documentation/methodology" && <Link className="pub-text-link" to="/documentation/methodology">Read the methodology <ArrowUpRight size={15} /></Link>}</div>
      </ProgressReveal></ResearchMotion>
    </section>
  </div>;
}
