import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { ErrorState, LoadingBlock } from "@/components/features/common";
import { useExperiment, useResearchStatus, useRoadmap } from "@/hooks/queries";
import { titleCase } from "@/lib/format";

const groups = [
  { id: "foundation", title: "Foundation and environment", range: [1, 2, 3], why: "Establish a repeatable environment and check the idea on synthetic samples before evaluating real data." },
  { id: "dataset", title: "Dataset understanding", range: [4, 5, 6, 7], why: "Understand what the logs record and which events have reliable annotations." },
  { id: "semantic-representation", title: "Semantic representation", range: [8, 9, 10], why: "Turn structured events into comparable descriptions and split the data before model evaluation." },
  { id: "initial-model", title: "Initial model development", range: [11], why: "Establish a benign-trained autoencoder reference run." },
  { id: "comparison", title: "Comparative evaluation", range: [12, 13, 14, 15, 16], why: "Check what simpler baselines, alternative training and different operating points tell us." },
  { id: "representation", title: "Representation investigation", range: [17], why: "Compare how much useful context is retained by different descriptions of the same event." },
  { id: "reproducibility", title: "Reproducibility", range: [18, 24], why: "Test variation across seeds first and evaluate generalisation on a separate scenario later." },
  { id: "advanced-detection", title: "Advanced detection", range: [19, 20, 21, 22, 23], why: "Test more representations and explore whether relationships across events improve the evidence." },
  { id: "mitigation", title: "Mitigation", range: [25], why: "Investigate human-reviewed recommendations only after detection and correlation provide sufficient evidence." },
  { id: "dissertation", title: "Dissertation and demonstration", range: [26, 27], why: "Document what was learned and communicate evidence and limitations." },
];

export function ProgressPage() {
  const { data: status } = useResearchStatus();
  const roadmap = useRoadmap();
  const next = roadmap.data?.next_milestone;
  const e7 = useExperiment(next?.id === "R18" ? "E7" : "");
  const byId = new Map(roadmap.data?.milestones.map((item) => [item.id, item]));
  const mappedIds = new Set(groups.flatMap(({ range }) => range.map((id) => `R${String(id).padStart(2, "0")}`)));
  const phases = [
    ...groups.map((group) => ({ ...group, milestones: group.range.flatMap((id) => {
      const item = byId.get(`R${String(id).padStart(2, "0")}`);
      return item ? [item] : [];
    }) })),
    { id: "additional", title: "Additional roadmap activities", why: "New milestones not yet assigned to a publication phase.", milestones: roadmap.data?.milestones.filter((item) => !mappedIds.has(item.id)) ?? [] },
  ];
  return <>
    <p className="pub-kicker">Research record</p>
    <h1 className="pub-editorial-title">Research progress</h1>
    <p className="pub-lede">From understanding the dataset to testing whether the findings hold up. Milestone status describes work on the roadmap, not dissertation completion.</p>
    <section className="pub-progress-next pub-section-space">
      <p className="pub-kicker">Current research activity</p>
      <h2 className="pub-editorial-h2">{status?.phase ?? "What the lab is working on"}</h2>
      {status && <p className="pub-lede">{status.current_activity}</p>}
      {next && <dl className="pub-next-grid">
        <div><dt>Next on the roadmap</dt><dd>{next.title}</dd></div>
        <div><dt>What we’re investigating</dt><dd>{e7.data?.research_question ?? next.description}</dd></div>
        <div><dt>Why now</dt><dd>{next.id === "R18" ? "The current results come from one seed. Repeated runs measure sensitivity to seed choice, not generalisation across attack scenarios." : next.description}</dd></div>
        <div><dt>What has been prepared</dt><dd>{next.dependencies.map((id) => byId.get(id)).filter((item) => item?.status === "completed").map((item) => item?.title).join("; ") || "No completed dependency is recorded."}</dd></div>
        <div><dt>What remains</dt><dd>{next.description}{e7.data && <> {e7.data.results_summary}</>}</dd></div>
        <div><dt>Expected research outputs</dt><dd>{next.id === "R18" ? "Individual run results, means, and standard deviations across the selected seeds." : "See the milestone description for the currently recorded scope."}</dd></div>
      </dl>}
      {next?.id === "R18" && <div className="pub-actions"><Link className="pub-text-link" to="/experiments/E7">E7 experiment plan <ArrowRight size={16} /></Link><Link className="pub-text-link" to="/findings#F03">Related training finding <ArrowUpRight size={15} /></Link></div>}
    </section>
    <section className="pub-section-space">
      <p className="pub-kicker">The research journey</p>
      <h2 className="pub-editorial-h2">From setup to evaluation</h2>
      {roadmap.isLoading && <LoadingBlock rows={3} />}
      {roadmap.error && <ErrorState error={roadmap.error} onRetry={() => roadmap.refetch()} />}
      <ol className="pub-progress-list">{phases.filter(({ milestones }) => milestones.length > 0).map((phase, i) => <li id={phase.id} key={phase.id}>
        <span className="pub-figure-id">{String(i + 1).padStart(2, "0")}</span>
        <div><h3>{phase.title}</h3><p>{phase.why}</p>
          <details className="pub-disclosure"><summary>Milestones · {phase.milestones.filter((item) => item.status === "completed").length} of {phase.milestones.length} completed</summary>
            <ul>{phase.milestones.map((item) => <li key={item.id}><strong>{item.title}</strong> · {titleCase(item.status)}<p>{item.description}</p></li>)}</ul>
          </details>
        </div>
      </li>)}</ol>
    </section>
  </>;
}

const documentation = [
  ["Research proposal and reports", "Availability and published research reports", "/documentation/reports"],
  ["Research journal", "Decisions and experiment notes in chronological order", "/documentation/journal"],
  ["Methodology", "Data splits, encoder, autoencoder and alert calibration", "/documentation/methodology"],
  ["Dataset specifications", "Partitions, labels, distributions and overlap", "/documentation/dataset"],
  ["Model and application specifications", "Research pipeline and data flow", "/documentation/architecture"],
  ["Experimental configurations", "Run settings, comparison and source evidence", "/experiments/registry"],
  ["Reproducibility records", "Environment, versions, seeds and known gaps", "/documentation/environment"],
  ["Research limitations", "Boundaries on interpretation and next validation steps", "/documentation/limitations"],
  ["Glossary", "Definitions, denominators and examples for research metrics", "/documentation/glossary"],
  ["Source artifact explorer", "Browse allowlisted reports and experimental figures", "/documentation/artifacts"],
  ["Research objectives", "Project questions and related experiments", "/documentation/objectives"],
  ["Display and data settings", "Theme preferences and data mode information", "/documentation/settings"],
] as const;

export function DocumentationPage() {
  return <>
    <p className="pub-kicker">Research reference</p>
    <h1 className="pub-editorial-title">Documentation</h1>
    <p className="pub-lede">Trace a claim back to the methods, configurations and artifacts behind it. Planned or unavailable records are marked explicitly.</p>
    <div className="pub-tour-index pub-section-space pub-doc-links">{documentation.map(([name, description, to]) => <div className="pub-paths" key={to}><Link to={to}><span><strong>{name}</strong><small>{description}</small></span><ArrowUpRight size={17} /></Link></div>)}</div>
  </>;
}
