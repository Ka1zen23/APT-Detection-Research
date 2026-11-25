import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { ErrorState, LoadingBlock } from "@/components/features/common";
import { ResearchJourney } from "@/components/publication/ResearchJourney";
import { useExperiment, useFindings, useResearchStatus, useRoadmap } from "@/hooks/queries";
import { getResearchProgress } from "@/lib/research-progress";

export function ProgressPage() {
  const { data: status } = useResearchStatus();
  const roadmap = useRoadmap();
  const { data: findings } = useFindings();
  const [params] = useSearchParams();
  const progress = roadmap.data && getResearchProgress(roadmap.data);
  const next = progress?.next;
  const current = progress?.current;
  const e7 = useExperiment(next?.id === "R18" ? "E7" : "");
  const initialStage = progress?.groups.find(({ id }) => id === params.get("stage"))?.id;
  return <>
    <p className="pub-kicker">Research record</p>
    <h1 className="pub-editorial-title">Research progress</h1>
    <p className="pub-lede">From understanding the dataset to testing whether the findings hold up. Milestone status describes work on the roadmap, not dissertation completion.</p>
    <section className="pub-progress-next pub-section-space">
      <p className="pub-kicker">{current ? "Current research activity" : "Research update"}</p>
      <h2 className="pub-editorial-h2">{current?.title ?? (next?.id === "R18" ? status?.phase : next?.title) ?? "What the lab is working on"}</h2>
      {current && <p className="pub-lede">{current.description}</p>}
      {!current && next?.id === "R18" && status && <p className="pub-lede">{status.current_activity}</p>}
      {next && <dl className="pub-next-grid">
        <div><dt>Next on the roadmap</dt><dd>{next.title}</dd></div>
        <div><dt>What we’re investigating</dt><dd>{e7.data?.research_question ?? next.description}</dd></div>
        <div><dt>Why now</dt><dd>{next.id === "R18" ? "The current results come from one seed. Repeated runs measure sensitivity to seed choice, not generalisation across attack scenarios." : next.description}</dd></div>
        <div><dt>What has been prepared</dt><dd>{next.dependencies.map((id) => progress?.byId.get(id)).filter((item) => item?.status === "completed").map((item) => item?.title).join("; ") || "No completed dependency is recorded."}</dd></div>
        <div><dt>What remains</dt><dd>{next.description}{e7.data && <> {e7.data.results_summary}</>}</dd></div>
        <div><dt>Expected research outputs</dt><dd>{next.id === "R18" ? "Individual run results, means, and standard deviations across the selected seeds." : "See the milestone description for the currently recorded scope."}</dd></div>
      </dl>}
      {next?.id === "R18" && <div className="pub-actions"><Link className="pub-text-link" to="/experiments/E7">E7 experiment plan <ArrowRight size={16} /></Link><Link className="pub-text-link" to="/findings#F03">Related training finding <ArrowUpRight size={15} /></Link></div>}
    </section>
    {roadmap.isLoading && <LoadingBlock rows={3} />}
    {roadmap.error && <ErrorState error={roadmap.error} onRetry={() => roadmap.refetch()} />}
    {progress && <ResearchJourney key={initialStage ?? "journey"} progress={progress} findings={findings?.findings ?? []} initialStage={initialStage} />}
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
