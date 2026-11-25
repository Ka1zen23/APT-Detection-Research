import { useId, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useAblation, useAlertBudgets, useDataset, useThresholds } from "@/hooks/queries";
import { formatDecimal, formatNumber, formatPercent } from "@/lib/format";

const modes = [
  ["E5-A", "Operation only", "Both read a file and copy it. Without names or links, the activities are indistinguishable."],
  ["E5-B", "With entity attributes", "The same verbs now come with program, file, and destination names. We still do not say which entity acted on which."],
  ["E5-C", "Full provenance", "Directed links preserve who did what to which file and where it went."],
];

export function ProvenanceDemo({ evidenceLink = true }: { evidenceLink?: boolean }) {
  const [mode, setMode] = useState(0);
  const { data } = useAblation();
  const variants = [
    ["Read → Copy", "Read → Copy"],
    ["Read, copy · backup utility · project file · shared archive", "Read, copy · unknown process · project file · new destination"],
    ["Backup utility → reads → project file → copied to → shared archive", "Unknown process → reads → project file → copied to → new destination"],
  ];
  const selected = modes[mode];
  const metric = data?.models.find((row) => row.id === selected[0]);
  const saved = data?.examples.representations.find((row) => row.id === selected[0]);
  return <div className="pub-demo">
    <p className="pub-kicker">Illustrative activities</p>
    <div className="pub-controls" role="group" aria-label="Event representation">{modes.map(([id, label], i) => <button className="pub-segment" key={id} aria-pressed={i === mode} onClick={() => setMode(i)}>{label}</button>)}</div>
    <div className="pub-demo-pair" aria-live="polite">
      {variants[mode].map((description, i) => <div key={i}><strong>{i ? "Unusual activity" : "Routine activity"}</strong><p>{description}</p></div>)}
    </div>
    <p>{selected[2]}</p>
    <div className="pub-measured"><p className="pub-kicker">Measured experiment · {selected[0]}</p>
      <p>Average Precision: <strong>{formatDecimal(metric?.average_precision, 6)}</strong> · ROC-AUC: <strong>{formatDecimal(metric?.roc_auc, 6)}</strong></p>
      {evidenceLink && <Link className="pub-text-link" to="/experiments/ablation">Compare all three E5 results <ArrowRight size={15} /></Link>}
      {saved && <details className="pub-disclosure"><summary>See the example supplied with the evidence</summary><p>{data?.examples.event_context} · {data?.examples.source}</p><p>{saved.description}</p></details>}
    </div>
  </div>;
}

const sentences = [
  { text: "A backup utility reads a project file.", near: "A backup program opens a document.", far: "A service starts a network connection." },
  { text: "A service starts a network connection.", near: "A program connects to a remote service.", far: "A backup utility reads a project file." },
  { text: "A program creates a temporary file.", near: "An application writes a temporary document.", far: "A service starts a network connection." },
];

export function EmbeddingDemo() {
  const [example, setExample] = useState(0);
  const item = sentences[example];
  return <div className="pub-demo">
    <p className="pub-kicker">Conceptual similarity · not measured coordinates</p>
    <label>Choose an input description
      <select value={example} onChange={(e) => setExample(Number(e.target.value))}>{sentences.map(({ text }, i) => <option key={text} value={i}>{text}</option>)}</select>
    </label>
    <div aria-hidden="true" className="pub-similarity"><span>Input</span><span>Similar</span><span>Less similar</span></div>
    <div className="pub-demo-pair" aria-live="polite"><div><strong>Similar meaning</strong><p>{item.near}</p></div><div><strong>Less similar meaning</strong><p>{item.far}</p></div></div>
    <p>The diagram illustrates one way to think about distance. No model scores or projected coordinates are shown. The research uses frozen all-MiniLM-L6-v2 with 384 dimensions.</p>
  </div>;
}

const stages = [
  ["Input", "The model receives a numerical representation of an event."],
  ["Compression", "It reduces the number of values while trying to retain the pattern."],
  ["Bottleneck", "A small set of values must carry enough information for reconstruction."],
  ["Reconstruction", "The model expands those values and compares the result with the input."],
];

export function AutoencoderDemo() {
  const [unfamiliar, setUnfamiliar] = useState(false);
  const [step, setStep] = useState(0);
  const values = unfamiliar ? [35, 80, 32, 77, 28, 70] : [27, 52, 72, 62, 44, 30];
  const reconstructed = unfamiliar ? [31, 53, 65, 58, 45, 32] : [28, 51, 69, 60, 43, 31];
  const amounts = step === 0 ? values : step === 1 ? [47, 76, 44, 60] : step === 2 ? [52, 69] : reconstructed;
  return <div className="pub-demo">
    <p className="pub-kicker">Illustrative model · no measured scores</p>
    <div className="pub-controls" role="group" aria-label="Example type">
      <button className="pub-segment" aria-pressed={!unfamiliar} onClick={() => setUnfamiliar(false)}>Familiar benign pattern</button>
      <button className="pub-segment" aria-pressed={unfamiliar} onClick={() => setUnfamiliar(true)}>Unfamiliar pattern</button>
    </div>
    <div className="pub-controls" role="group" aria-label="Autoencoder stage">{stages.map(([name], i) => <button className="pub-segment" key={name} aria-pressed={i === step} onClick={() => setStep(i)}>{i + 1}. {name}</button>)}</div>
    <div className="pub-neural" aria-hidden="true" key={`${step}-${unfamiliar}`}>
      {amounts.map((height, i) => <span key={i} style={{ height: `${height}%` }} />)}
      {step === 3 && <div>{values.map((height, i) => <span key={i} style={{ height: `${height}%` }} />)}</div>}
    </div>
    <p aria-live="polite">{stages[step][1]} {step === 3 && (unfamiliar ? "The reconstructed values differ more from the input (outlined). That could warrant review, but unusual does not mean malicious." : "The reconstructed values stay close to the input (outlined), giving a smaller error in this illustration.")}</p>
  </div>;
}

const toyScores = [
  { score: 12, positive: false }, { score: 22, positive: false }, { score: 29, positive: false },
  { score: 41, positive: true }, { score: 51, positive: false }, { score: 61, positive: false },
  { score: 72, positive: true }, { score: 82, positive: false }, { score: 95, positive: true },
];

export function ThresholdDemo({ startMeasured = false, evidenceLink = true }: { startMeasured?: boolean; evidenceLink?: boolean }) {
  const [actual, setActual] = useState(startMeasured);
  const [value, setValue] = useState(50);
  const [percentile, setPercentile] = useState(99);
  const id = useId();
  const { data, isLoading } = useThresholds(actual ? "E2-D" : "");
  const row = data?.rows.find((item) => item.percentile === percentile) ?? data?.rows[0];
  const alerts = toyScores.filter(({ score }) => score > value);
  const trueAlerts = alerts.filter(({ positive }) => positive).length;
  return <div className="pub-demo">
    <div className="pub-controls" role="group" aria-label="Threshold data">
      <button className="pub-segment" aria-pressed={!actual} onClick={() => setActual(false)}>Educational simulation</button>
      <button className="pub-segment" aria-pressed={actual} onClick={() => setActual(true)}>Measured E2-D results</button>
    </div>
    {!actual ? <>
      <p className="pub-kicker">Illustrative scores · 9 events, 3 labelled positives</p>
      <label htmlFor={id}>Alert threshold: {value}</label>
      <input id={id} type="range" min="0" max="100" value={value} onChange={(e) => setValue(Number(e.target.value))} />
      <ol className="pub-toy-scores" aria-label="Toy scores and alert decisions">{toyScores.map(({ score, positive }) =>
        <li key={score} data-alert={score > value} title={`${positive ? "Positive" : "Negative"} · ${score > value ? "Alerted" : "Not alerted"}`}>
          {score} <span aria-label={positive ? "positive" : "negative"}>{positive ? "+" : "−"}</span><small>{score > value ? "Alert" : "Quiet"}</small>
        </li>)}</ol>
      <p aria-live="polite"><strong>{trueAlerts} of 3</strong> positives flagged · <strong>{alerts.length - trueAlerts}</strong> false positives</p>
    </> : row ? <>
      <label>Saved validation percentile
        <select value={row.percentile} onChange={(e) => setPercentile(Number(e.target.value))}>{data?.rows.map((item) => <option key={item.percentile} value={item.percentile}>P{item.percentile}{item.exploratory ? " · retrospective" : ""}</option>)}</select>
      </label>
      <p aria-live="polite">{formatNumber(row.total_alerts)} alerts · {formatNumber(row.false_positives)} false positives · {formatPercent(row.recall, 1)} original recall · {formatPercent(row.contextual_recall, 1)} contextual recall</p>
      <p>{row.exploratory ? "This operating point was examined retrospectively; it is not independently validated." : "The threshold was derived from benign validation scores, then evaluated on the attack-test events."}</p>
      {evidenceLink && <Link className="pub-text-link" to="/experiments/thresholds">Open threshold evidence <ArrowRight size={15} /></Link>}
    </> : <p role="status">{isLoading ? "Loading measured thresholds…" : "Measured thresholds are unavailable."}</p>}
    <p>Lowering a threshold can catch more positives, but it can also flag more negatives. Recall is the share of labelled positives recovered.</p>
  </div>;
}

export function BudgetDemo({ evidenceLink = true }: { evidenceLink?: boolean }) {
  const [model, setModel] = useState("E2-D");
  const [budget, setBudget] = useState(500);
  const { data, isLoading } = useAlertBudgets(model);
  const { data: dataset } = useDataset();
  const total = dataset?.class_balance.find((row) => row.partition === "Attack test")?.positives;
  const row = data?.rows.find((value) => value.budget === budget) ?? data?.rows[0];
  return <div className="pub-demo">
    <p className="pub-kicker">Measured alert-budget results · original labels</p>
    <div className="pub-controls"><label>Model<select value={model} onChange={(e) => setModel(e.target.value)}>{["E2-A", "E2-B", "E2-C", "E2-D"].map((id) => <option key={id}>{id}</option>)}</select></label>
      {row && <label>Alerts reviewed<select value={row.budget} onChange={(e) => setBudget(Number(e.target.value))}>{data?.rows.map((value) => <option key={value.budget} value={value.budget}>{formatNumber(value.budget)}</option>)}</select></label>}
    </div>
    {row ? <div aria-live="polite">
      <p><strong>{formatDecimal(row.expected_true_positives, Number.isInteger(row.expected_true_positives) ? 0 : 2)}{total != null ? ` of ${total}` : ""}</strong> annotated positives expected · {formatPercent(row.expected_precision, 1)} expected precision</p>
      <progress aria-label="Expected share of annotated positives recovered" max={1} value={row.expected_recall} />
      {row.minimum_true_positives !== row.maximum_true_positives && <p>Depending on which tied alerts are reviewed: {row.minimum_true_positives}–{row.maximum_true_positives} positives.</p>}
    </div> : <p role="status">{isLoading ? "Loading measured budgets…" : "Measured budgets are unavailable."}</p>}
    <p>When scores tie at the cutoff, the expected count averages possible orderings. Only saved budget points are shown.</p>
    {evidenceLink && <Link className="pub-text-link" to="/experiments/alerts">Open the alert-budget comparison <ArrowRight size={15} /></Link>}
  </div>;
}

export function ImbalanceDemo() {
  const { data, isLoading } = useDataset();
  const [predict, setPredict] = useState(false);
  const sample = data?.class_balance.find((row) => row.partition === "Attack test");
  return <div className="pub-demo">
    <p className="pub-kicker">Measured class counts · original labels</p>
    {sample ? <>
      <p><strong>{formatNumber(sample.positives)} of {formatNumber(sample.records)}</strong> attack-test events were originally annotated positive.</p>
      <progress aria-label="Fraction of events annotated positive" max={sample.records} value={sample.positives} />
      <p>The positive share is so small that it may be hard to see on a full-width scale: {formatPercent(sample.positives / sample.records, 4)}.</p>
      <button className="pub-segment" aria-expanded={predict} onClick={() => setPredict(!predict)}>{predict ? "Hide" : "Try"} an always-negative prediction</button>
      {predict && <p role="status"><strong>{formatPercent(1 - sample.positives / sample.records, 2)} accuracy</strong>, but <strong>zero positives detected</strong>. Average Precision instead rewards ranking annotated positives near the top.</p>}
    </> : <p role="status">{isLoading ? "Loading the recorded class counts…" : "The recorded class counts are unavailable."}</p>}
  </div>;
}
