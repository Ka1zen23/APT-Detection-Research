import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, ChevronDown, GitBranch } from "lucide-react";
import { Link } from "react-router-dom";
import type { Finding, RoadmapMilestone } from "@/types/api";
import { normaliseStepStatus, stepLabels, type ResearchProgress, type ResearchStage } from "@/lib/research-progress";
import { ProgressReveal, ResearchMotion } from "./ProgressMotion";
import { ProgressStepper } from "./ProgressStepper";

export function MilestoneStatus({ status }: { status: string }) {
  const state = normaliseStepStatus(status);
  return <span className="pub-milestone-status" data-status={state}>{stepLabels[state]}</span>;
}

export function CompactResearchJourney({ progress }: { progress: ResearchProgress }) {
  const upcoming = progress.upcomingGroup?.milestones.find(({ status }) => status === "planned");
  return <div className="pub-home-journey">
    <div className="pub-journey-header">
      <div><p className="pub-kicker">Research journey</p><h2>From foundation to final evaluation</h2></div>
      <p><strong>{progress.completed} of {progress.total}</strong> roadmap milestones completed. This is not a dissertation completion estimate.</p>
    </div>
    <ProgressStepper steps={progress.groups} compact label="Research journey overview" selected={(progress.currentGroup ?? progress.nextGroup)?.id} destination={(id) => `/progress?stage=${encodeURIComponent(id)}#research-stepper`} />
    <dl className="pub-journey-summary">
      <div><dt>Last completed stage</dt><dd>{progress.lastCompleted?.title ?? "No completed stage recorded"}</dd></div>
      <div><dt>{progress.current ? "Research activity in progress" : "Next research activity"}</dt><dd>{progress.current?.title ?? progress.next?.title ?? "No current or next activity recorded"}</dd></div>
      <div><dt>Upcoming after that</dt><dd>{(progress.current ? progress.next?.title : undefined) ?? upcoming?.title ?? "No later milestone recorded"}</dd></div>
    </dl>
    <Link className="pub-text-link" to="/progress">Explore the full roadmap <ArrowRight size={16} /></Link>
  </div>;
}

function StageDetail({ stage, progress, findings, selectStage }: {
  stage: ResearchStage;
  progress: ResearchProgress;
  findings: Finding[];
  selectStage?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<string[]>([]);
  const tasks = [...stage.milestones, ...stage.parallelActivities];
  const related = findings.filter(({ related_experiments }) => related_experiments.some((id) => stage.experiments.includes(id)));
  function taskRow(item: RoadmapMilestone) {
    const isOpen = expanded.includes(item.id);
    const details = `${stage.id}-${item.id}-detail`;
    return <li key={item.id}>
      <button type="button" aria-expanded={isOpen} aria-controls={details} onClick={() => setExpanded(isOpen ? expanded.filter((id) => id !== item.id) : [...expanded, item.id])}>
        <span>{item.id} · {item.title}</span><span className="pub-task-indicators"><MilestoneStatus status={item.status} /><ChevronDown size={15} aria-hidden="true" /></span>
      </button>
      <div id={details} hidden={!isOpen} className="pub-milestone-detail">
        {isOpen && <ResearchMotion><ProgressReveal>
          <p>{item.description}</p>
          {item.dependencies.length > 0 && <div className="pub-dependencies"><strong><GitBranch size={15} /> Depends on</strong>
            <ul>{item.dependencies.map((id) => {
              const dependency = progress.byId.get(id);
              const group = progress.stageByTask.get(id);
              return <li key={id}>
                {selectStage && group && group !== stage.id ? <button className="pub-text-link" type="button" onClick={() => selectStage(group)}>{id} · {dependency?.title} <ArrowRight size={14} /></button> : <span>{id} · {dependency?.title ?? "Milestone not found"}</span>}
                {dependency && <MilestoneStatus status={dependency.status} />}
              </li>;
            })}</ul>
          </div>}
          <p><strong>Supporting artifacts</strong></p>
          {item.evidence.length ? <ul>{item.evidence.map((source) => <li key={source}><code>{source}</code></li>)}</ul> : <p>No supporting artifact is recorded for this milestone.</p>}
        </ProgressReveal></ResearchMotion>}
      </div>
    </li>;
  }
  return <>
    <p>{stage.why}</p>
    <div className="pub-stage-tasks">
      <div><h4>Completed tasks</h4><ul>{tasks.filter(({ status }) => status === "completed").map(taskRow)}</ul>
        {!tasks.some(({ status }) => status === "completed") && <p>No completed task is recorded for this stage.</p>}
      </div>
      <div><h4>Remaining and parallel work</h4><ul>{tasks.filter(({ status }) => status !== "completed").map(taskRow)}</ul>
        {tasks.every(({ status }) => status === "completed") && <p>No remaining task is recorded for this stage.</p>}
      </div>
    </div>
    {stage.experiments.length > 0 && <div className="pub-stage-related">
      <p><strong>Related experiments</strong></p>
      <ul>{stage.experiments.map((id) => <li key={id}><Link className="pub-text-link" to={`/experiments/${id}`}>{id} <ArrowUpRight size={13} /></Link></li>)}</ul>
    </div>}
    {related.length > 0 && <div className="pub-stage-related"><p><strong>Related findings</strong></p>
      <ul>{related.map(({ id, title }) => <li key={id}><Link className="pub-text-link" to={`/findings#${id}`}>{title} <ArrowUpRight size={13} /></Link></li>)}</ul>
    </div>}
  </>;
}

export function ResearchJourney({ progress, findings, initialStage }: { progress: ResearchProgress; findings: Finding[]; initialStage?: string }) {
  const [view, setView] = useState<"journey" | "roadmap">(initialStage ? "roadmap" : "journey");
  const [selected, setSelected] = useState(initialStage ?? progress.currentGroup?.id ?? progress.nextGroup?.id ?? progress.groups[0].id);
  const stage = progress.groups.find(({ id }) => id === selected) ?? progress.groups[0];
  const panel = useId();
  const focusPanel = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusPanel.current && view === "roadmap") {
      focusPanel.current = false;
      panelRef.current?.focus();
    }
  }, [selected, view]);
  function selectStage(id: string, focus = false) {
    if (focus && view === "roadmap" && id === selected) {
      panelRef.current?.focus();
      return;
    }
    focusPanel.current = focus;
    setSelected(id);
    setView("roadmap");
  }
  return <section className="pub-section-space" id="research-stepper">
    <div className="pub-roadmap-header">
      <div><p className="pub-kicker">Research milestones</p><h2 className="pub-editorial-h2">The research journey</h2></div>
      <div className="pub-controls" role="group" aria-label="Research progress view">
        <button className="pub-segment" type="button" aria-pressed={view === "journey"} onClick={() => setView("journey")}>Journey view</button>
        <button className="pub-segment" type="button" aria-pressed={view === "roadmap"} onClick={() => setView("roadmap")}>Roadmap view</button>
      </div>
    </div>
    <p className="pub-roadmap-count"><strong>{progress.completed} of {progress.total} milestones completed.</strong> Milestone counts do not measure dissertation completion.</p>
    <ProgressStepper steps={progress.groups} label="Research stages" selected={stage.id} onSelect={(id) => selectStage(id, window.matchMedia("(max-width: 900px)").matches)} panelId={panel} />
    {view === "roadmap" ? <div id={panel} ref={panelRef} tabIndex={-1} className="pub-stage-panel">
      <ResearchMotion><ProgressReveal key={stage.id}>
        <p className="pub-kicker">Selected stage · <MilestoneStatus status={stage.status} /></p>
        <h3>{stage.title}</h3>
        <StageDetail stage={stage} progress={progress} findings={findings} selectStage={(id) => selectStage(id, true)} />
      </ProgressReveal></ResearchMotion>
    </div> : <ol id={panel} className="pub-progress-list pub-journey-list">{progress.groups.map((item, index) => <li id={item.id} key={item.id} data-status={item.status}>
      <span className="pub-figure-id">{String(index + 1).padStart(2, "0")}</span>
      <div>
        <h3>{item.title} <MilestoneStatus status={item.status} /></h3>
        <p>{item.why}</p>
        <details className="pub-disclosure">
          <summary>Stage details and milestones</summary>
          <StageDetail stage={item} progress={progress} findings={findings} />
        </details>
      </div>
    </li>)}</ol>}
  </section>;
}
