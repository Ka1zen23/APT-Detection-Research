import { createContext, lazy, useContext, useState } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Link, NavLink, Outlet, useMatch, useParams } from "react-router-dom";
import { ErrorState, LoadingBlock } from "@/components/features/common";
import { BudgetDemo, ProvenanceDemo, ThresholdDemo } from "@/components/publication/ResearchDemos";
import { useExperiment, useExperiments, useModelComparison, useReports } from "@/hooks/queries";
import { formatDecimal, formatNumber, titleCase } from "@/lib/format";
import { documentUrl, figureUrl } from "@/services/api";
import { ExperimentExecution } from "@/components/publication/ExperimentExecution";
const ModelEvidence = lazy(() => import("@/components/publication/ModelEvidence").then((module) => ({ default: module.ModelEvidence })));
const ThresholdEvidence = lazy(() => import("@/components/publication/ThresholdEvidence").then((module) => ({ default: module.ThresholdEvidence })));
const AlertEvidence = lazy(() => import("@/components/publication/AlertEvidence").then((module) => ({ default: module.AlertEvidence })));
const AblationEvidence = lazy(() => import("@/components/publication/AblationEvidence").then((module) => ({ default: module.AblationEvidence })));

type View = "guided" | "technical";
const ViewContext = createContext<View>("guided");
export const useExperimentView = () => useContext(ViewContext);
const viewKey = "apt-research-experiment-view";

const evidenceRoutes = [
  ["Compare models", "/experiments/comparison"],
  ["Training strategies", "/experiments/training"],
  ["Provenance context", "/experiments/ablation"],
  ["Alert budgets", "/experiments/alerts"],
  ["Alert thresholds", "/experiments/thresholds"],
  ["Full registry", "/experiments/registry"],
] as const;

export function ExperimentSection() {
  const detail = useMatch("/experiments/:id");
  const [view, setView] = useState<View>(() => {
    try { return localStorage.getItem(viewKey) === "technical" ? "technical" : "guided"; }
    catch { return "guided"; }
  });
  return <ViewContext.Provider value={view}>
    <div className="pub-experiment-nav" data-detail={detail && !evidenceRoutes.some(([, to]) => to === detail.pathname) ? true : undefined}>
      <nav aria-label="Experiment explorer">{evidenceRoutes.map(([title, to]) => <NavLink key={to} to={to}>{title}</NavLink>)}</nav>
      {detail && !["registry", "evidence", "training"].includes(detail.params.id ?? "") && <div className="pub-controls" role="group" aria-label="Experiment reading mode">{(["guided", "technical"] as const).map((next) => <button className="pub-segment" key={next} aria-pressed={view === next} onClick={() => {
        setView(next);
        try { localStorage.setItem(viewKey, next); } catch { /* Keep the in-memory choice. */ }
      }}>{titleCase(next)} view</button>)}</div>}
    </div>
    <Outlet />
  </ViewContext.Provider>;
}

export function ExperimentsLanding() {
  return <>
    <p className="pub-kicker">Experimental evidence</p>
    <h1 className="pub-editorial-title">Experiments</h1>
    <p className="pub-lede">Follow a research question into its evidence. Start with how context, training, thresholds or review time changed the results. Open the full registry for every recorded run and planned study.</p>
    <div className="pub-paths pub-reading pub-section-space">
      {([
        ["Does more context help?", "Compare three ways of describing the same events.", "/experiments/ablation"],
        ["Does changing the training help?", "Compare the selected models on the recorded attack test.", "/experiments/comparison"],
        ["How did the four training strategies differ?", "Inspect recorded loss, checkpoints, updates and description frequency.", "/experiments/training"],
        ["What if the analyst can review only 500 alerts?", "See which models put annotated events within reach.", "/experiments/alerts"],
        ["What happens when we change the alert threshold?", "See how the threshold trades off missed events and false alerts.", "/experiments/thresholds"],
        ["Browse the full registry", "See all experiment IDs, configurations, results and plans.", "/experiments/registry"],
        ["Evidence overview", "Open the detailed dataset and evidence summary.", "/experiments/evidence"],
      ] as const).map(([title, description, to]) => <Link className="pub-path-plain" to={to} key={to}><span><strong>{title}</strong><small>{description}</small></span><ArrowUpRight size={17} /></Link>)}
    </div>
  </>;
}

const explanations: Record<string, [string, string, string]> = {
  "E2-A": ["Establish a reference for comparing ways of training the autoencoder.", "The original training used benign event descriptions as recorded, so common descriptions could recur.", "Later E2 variants use the same attack-test partition for comparison."],
  "E2-B": ["Test whether reducing the influence of duplicate descriptions helps.", "Retain one instance per unique benign training description.", "Use the same encoder, autoencoder architecture and evaluation partition as the original."],
  "E2-C": ["Test another way to reduce the influence of frequent descriptions.", "Adjust the influence of repeated descriptions through weighting.", "Use the same encoder, model family and evaluation partition as the other E2 variants."],
  "E2-D": ["Check whether unique-description training helps when given a similar number of training updates.", "Train on unique descriptions with an approximately matched optimiser-update budget.", "Compare with the original autoencoder on the same attack-test partition and original labels."],
  "E5-A": ["Find out how much the model can learn from action names alone.", "Describe events using operation names without entity attributes or relationships.", "Compare configurations using the same model family, encoder and evaluation partition."],
  "E5-B": ["Test whether knowing which entities were involved helps the model rank annotated events.", "Add entity attributes without explicit directed relationships.", "Compare configurations using the same model family, encoder and evaluation partition."],
  "E5-C": ["See whether a fuller description of event context helps the model rank annotated events.", "Include operations, entity attributes and directed relationships.", "Compare configurations using the same model family, encoder and evaluation partition."],
  "E7": ["Check whether single-seed observations persist across repeated runs.", "Repeat selected configurations with different random seeds.", "Use the same selected configurations and benign-validation checkpoint rule; this is not an independent-scenario test."],
};

const mainResults: Record<string, string> = {
  "E2-A": "The reference run establishes a starting point. Its ranking can look strong across the whole test while producing relatively few annotated positives near the top.",
  "E2-D": "The model trained on unique descriptions put annotated events higher in the queue than the original autoencoder in this evaluation.",
  "E5-A": "Operation names alone made some originally positive and negative events identical to the model.",
  "E5-B": "Adding program and file details removed the exact-description collision observed with operation names alone in this evaluation.",
  "E5-C": "Full provenance ranked annotated events best among the three E5 configurations by Average Precision, but not every metric improved at the alert threshold.",
};
const readableNames: Record<string, string> = {
  "E2-A": "The original autoencoder",
  "E2-D": "Training on unique descriptions",
  "E5-A": "Reading operations without context",
  "E5-B": "Adding program and file details",
  "E5-C": "Preserving the full event context",
};

export function GuidedExperimentDetail({ technical }: { technical: React.ReactNode }) {
  const mode = useExperimentView();
  const { id = "" } = useParams();
  const { data, isLoading, error, refetch } = useExperiment(id);
  if (isLoading) return <LoadingBlock rows={5} />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;
  const info = explanations[id];
  const metric = data.metrics;
  return <>
    <article className="pub-reading">
      <p className="pub-kicker">{data.id} · {titleCase(data.status)}</p>
      <h1 className="pub-editorial-title">{readableNames[id] ?? data.name}</h1>
      {readableNames[id] && <p className="pub-experiment-name">Registry title: {data.name}</p>}
      {data.research_question && <p className="pub-lede">{data.research_question}</p>}
      <dl className="pub-next-grid pub-section-space">
        <div><dt>Why we ran it</dt><dd>{info?.[0] ?? data.hypothesis ?? data.research_question ?? "No research rationale is recorded for this entry."}</dd></div>
        <div><dt>What {data.status === "planned" ? "would change" : "changed"}</dt><dd>{info?.[1] ?? data.training_strategy ?? data.representation ?? "No change is documented in the registry."}</dd></div>
        <div><dt>What {data.status === "planned" ? "would stay" : "stayed"} constant</dt><dd>{info?.[2] ?? "Any fixed settings are listed in the recorded configuration. Not every study has a matched control."}</dd></div>
      </dl>
      <div className="pub-takeaway"><p className="pub-kicker">Main result</p><p>{mainResults[id] ?? (data.results_summary || "No measured result is recorded.")}</p></div>
      {data.interpretation && <div className="pub-prose"><p><strong>What it means.</strong> {data.interpretation}</p></div>}
      {data.limitations && <div className="pub-prose pub-experiment-limit"><p><strong>What remains uncertain.</strong> {data.limitations}</p></div>}
      {mode === "guided" && <>
        {metric?.average_precision != null && <figure className="pub-evidence pub-section-space">
          <figcaption><strong>Average Precision · {formatDecimal(metric.average_precision, 6)}</strong><span>Summarises how well annotated positives rank ahead of negatives. A higher score does not guarantee that most alerts are true positives.</span></figcaption>
        </figure>}
        <details className="pub-disclosure"><summary>Recorded result and sources</summary><div className="pub-prose"><p>{data.results_summary}</p>
          {data.source_artifacts.length > 0 && <ul>{data.source_artifacts.map((source) => <li key={source}><code>{source}</code></li>)}</ul>}
          <p>Switch to Technical view above for full configuration, metrics, and figures.</p>
        </div></details>
      </>}
    </article>
    <ExperimentExecution key={data.id} experiment={data} />
    {mode === "technical" && <section className="pub-section-space" aria-label="Technical experiment record">{technical}</section>}
  </>;
}

export function GuidedComparison({ technical }: { technical: React.ReactNode }) {
  const mode = useExperimentView();
  const { data, isLoading, error, refetch } = useModelComparison();
  const leader = [...(data?.models ?? [])].filter((model) => model.average_precision != null).sort((a, b) => (b.average_precision ?? 0) - (a.average_precision ?? 0))[0];
  return <>
    <p className="pub-kicker">Comparative evaluation</p>
    <h1 className="pub-editorial-title">Which models rank annotated events higher?</h1>
    <p className="pub-lede">{leader ? `In this evaluation, ${leader.id} had the highest observed Average Precision. That does not mean it had the best operational trade-off or will rank as well elsewhere.` : "Compare how models rank annotated events and what happens at their recorded alert thresholds."}</p>
    <div className="pub-section-space">
      {isLoading && <LoadingBlock rows={3} />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && <ModelEvidence models={data.models} />}
    </div>
    {mode === "technical" && <section className="pub-section-space" aria-label="Technical comparison">{technical}</section>}
  </>;
}

const demos = {
  ablation: ["The same event, three descriptions", "Full provenance gave the strongest observed ranking among the E5 representations. Most of the improvement came with entity attributes; this study does not isolate graph links as the sole cause.", ProvenanceDemo],
  alerts: ["What fits in an analyst’s alert budget?", "Better ranking puts more annotated events within reach when an analyst has time to review only the first few alerts.", BudgetDemo],
  thresholds: ["What is the cost of a quieter threshold?", "A stricter threshold can cut the work of reviewing alerts, but may also miss activity linked to annotated events.", ThresholdDemo],
} as const;

export function GuidedExperimentDemo({ kind, technical }: { kind: keyof typeof demos; technical: React.ReactNode }) {
  const mode = useExperimentView();
  const [title, summary, Visual] = demos[kind];
  return <>
    <p className="pub-kicker">Experimental evidence · preliminary</p>
    <h1 className="pub-editorial-title">{title}</h1>
    <p className="pub-lede">{summary}</p>
    <div className="pub-section-space">{kind === "thresholds" ? <ThresholdEvidence /> : kind === "alerts" ? <AlertEvidence /> : <AblationEvidence />}</div>
    {mode === "guided" ? <div className="pub-reading pub-section-space">
      <details className="pub-disclosure">
        <summary>{kind === "thresholds" ? "Try the educational threshold simulation" : kind === "ablation" ? "Explore the illustrative provenance example" : "Open the compact budget demo"}</summary>
        {kind === "thresholds" ? <ThresholdDemo evidenceLink={false} /> : <Visual evidenceLink={false} />}
      </details>
    </div> : <section className="pub-section-space" aria-label="Technical evidence">{technical}</section>}
  </>;
}

export function ArtifactExplorer() {
  const [selected, setSelected] = useState("E2-D");
  const reports = useReports();
  const experiments = useExperiments();
  const experiment = useExperiment(selected);
  return <>
    <p className="pub-kicker">Research reference · source files</p>
    <h1 className="pub-editorial-title">Source artifact explorer</h1>
    <p className="pub-lede">Browse available documents and figures. Research paths identify provenance; only allowlisted resources can be opened here.</p>
    <div className="pub-reading pub-section-space">
      <h2 className="pub-editorial-h2">Research documents</h2>
      {reports.isLoading && <LoadingBlock rows={3} />}
      {reports.error && <ErrorState error={reports.error} onRetry={() => reports.refetch()} />}
      <div className="pub-paths">
        {reports.data?.reports.filter((report) => report.available && report.document_key).map((report) => <a key={report.id} className="pub-path-plain" href={documentUrl(report.document_key!)}><span><strong>{report.title}</strong><small>{report.description}</small></span><ArrowUpRight size={16} /></a>)}
      </div>
      <div className="pub-actions"><Link className="pub-text-link" to="/documentation/reports">See all reports and availability <ArrowRight size={16} /></Link></div>
      <h2 className="pub-editorial-h2 pub-section-space">Experiment figures</h2>
      {experiments.error && <ErrorState error={experiments.error} onRetry={() => experiments.refetch()} />}
      <div className="pub-demo pub-section-space">
        <label>Experiment <select value={selected} onChange={(e) => setSelected(e.target.value)} disabled={!experiments.data}>{(experiments.data ?? [{ id: selected, name: "" }]).map((item) => <option value={item.id} key={item.id}>{item.id} · {item.name}</option>)}</select></label>
        {experiment.isLoading && <LoadingBlock rows={3} />}
        {experiment.error && <ErrorState error={experiment.error} onRetry={() => experiment.refetch()} />}
        {experiment.data && <div className="pub-prose">
          <p>{formatNumber(experiment.data.figures?.length ?? 0)} public figures for {selected}. <Link to={`/experiments/${selected}`}>Open the experiment record</Link>.</p>
          {(experiment.data.figures?.length ?? 0) > 0 && <ul>{experiment.data.figures?.map((figure) => <li key={figure.key}><a href={figureUrl(figure.key)}>{figure.title}</a></li>)}</ul>}
        </div>}
      </div>
    </div>
  </>;
}
