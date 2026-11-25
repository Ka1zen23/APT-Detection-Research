import { useId, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { ExperimentDetail } from "@/types/api";
import { useAblation, useExperiment, useFindings } from "@/hooks/queries";
import { getExecutionProgress } from "@/lib/experiment-progress";
import { MilestoneStatus } from "./ResearchJourney";
import { ProgressReveal, ResearchMotion } from "./ProgressMotion";
import { ProgressStepper } from "./ProgressStepper";

export function ExperimentExecution({ experiment, compact = false }: { experiment: ExperimentDetail; compact?: boolean }) {
  const e5 = /^E5-[ABC]$/.test(experiment.id);
  const { data: ablation } = useAblation(e5);
  const { data: findings } = useFindings(experiment.status !== "planned");
  const steps = getExecutionProgress(experiment, ablation, findings?.findings);
  const panel = useId();
  const [selected, setSelected] = useState<string>();
  const current = steps.find(({ id }) => selected === id);
  return <section className="pub-execution pub-section-space" id="execution-tracker" aria-label="Experiment execution">
    <p className="pub-kicker">{compact ? "Planned execution" : "Experiment workflow"}</p>
    <h2>{compact ? `${experiment.id} execution plan` : "Execution tracker"}</h2>
    <p>{steps.filter(({ status }) => status === "completed").length} of {steps.length} steps have recorded evidence. Select a step to see what it covers and the evidence recorded for it.</p>
    <ProgressStepper steps={steps} label={`${experiment.id} execution steps`} selected={selected} onSelect={setSelected} panelId={panel} />
    <div id={panel} className="pub-stage-panel" hidden={!current}>
      {current && <ResearchMotion><ProgressReveal key={current.id}>
        <p className="pub-kicker"><MilestoneStatus status={current.status} /></p>
        <h3>{current.title}</h3>
        <p>{current.detail}</p>
        {current.sources.length > 0 && <ul className="pub-execution-sources">{current.sources.map((source) => <li key={source}><code>{source}</code></li>)}</ul>}
        {current.links && current.links.length > 0 && <ul className="pub-execution-sources">{current.links.map(({ label, to }) => <li key={to}><Link className="pub-text-link" to={to}>{label} <ArrowUpRight size={14} /></Link></li>)}</ul>}
        {!current.sources.length && !current.links?.length && <p>No output artifact is linked to this step.</p>}
      </ProgressReveal></ResearchMotion>}
    </div>
    {compact && <Link className="pub-text-link" to={`/experiments/${experiment.id}`}>Open the experiment record <ArrowUpRight size={15} /></Link>}
  </section>;
}

export function UpcomingExecution({ id }: { id: string }) {
  const { data, isError } = useExperiment(id);
  if (isError) return <p className="pub-prose">The planned execution details are not available right now. <Link to={`/experiments/${id}`}>Open the experiment record</Link>.</p>;
  return data ? <ExperimentExecution experiment={data} compact /> : null;
}
