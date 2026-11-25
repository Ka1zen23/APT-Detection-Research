import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, FlaskConical, Milestone, Network } from "lucide-react";
import { Link } from "react-router-dom";
import { TeachingGraph } from "@/components/publication/TeachingGraph";
import { FindingPreview, Top500Preview } from "@/components/publication/FindingPreview";
import { useAblation, useAlertBudgets, useDataset, useModelComparison, useResearchStatus, useRoadmap } from "@/hooks/queries";
import { getResearchProgress } from "@/lib/research-progress";

const CompactResearchJourney = lazy(() => import("@/components/publication/ResearchJourney").then((module) => ({ default: module.CompactResearchJourney })));
const UpcomingExecution = lazy(() => import("@/components/publication/ExperimentExecution").then((module) => ({ default: module.UpcomingExecution })));
const InteractivePipeline = lazy(() => import("@/components/publication/InteractivePipeline").then((module) => ({ default: module.InteractivePipeline })));

const approach = [
  ["Observe system activity", "Record which programs interact with files and other parts of the computer.", "System provenance describes entities and how they interact. The research converts these structured records into consistent descriptions.", "/understand/system-provenance"],
  ["Teach AI what normal looks like", "Learn the patterns that recur in examples of routine activity.", "A frozen MiniLM encoder converts descriptions to 384-dimensional vectors. An autoencoder is trained to reconstruct vectors from benign training events.", "/understand/autoencoder"],
  ["Identify unusual activity", "Bring unfamiliar patterns to an analyst’s attention for review.", "The model scores events by reconstruction error. A threshold set on separate benign validation data decides which scores are flagged. A flag is not a diagnosis.", "/understand/anomaly-detection"],
];
const approachStages = ["Observe", "Represent", "Review"];

const paths = [
  ["Learn how the AI works", "Take the guided tour", "/understand", Network],
  ["Explore the evidence", "Read the experimental findings", "/findings", FlaskConical],
  ["Read the methodology", "See how the study was designed", "/documentation/methodology", BookOpen],
  ["View the roadmap", "Follow the next experiment", "/progress", Milestone],
] as const;

function ratio(first?: number | null, second?: number | null) {
  return first != null && second != null && second > 0 ? `${(first / second).toFixed(2)}×` : null;
}

function ChapterHeading({ number, label, title }: { number: string; label: string; title: string }) {
  return <div className="pub-chapter-heading"><p className="pub-kicker"><span>{number}</span> {label}</p><h2>{title}</h2></div>;
}

export function PublicationHome() {
  const steps = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const { data: status } = useResearchStatus();
  const roadmap = useRoadmap();
  const { data: ablation } = useAblation();
  const { data: models } = useModelComparison();
  const { data: budgets } = useAlertBudgets("E2-D");
  const { data: dataset } = useDataset();
  const e5 = (id: string) => ablation?.models.find((model) => model.id === id)?.average_precision;
  const e2 = (id: string) => models?.models.find((model) => model.id === id)?.average_precision;
  const budget = budgets?.rows.find((row) => row.budget === 500);
  const positives = dataset?.class_balance.find((row) => row.partition === "Attack test")?.positives;
  const progress = roadmap.data && getResearchProgress(roadmap.data);
  const next = progress?.next;
  useEffect(() => {
    const element = steps.current;
    if (!element || !("IntersectionObserver" in window)) return;
    const panels = Array.from(element.querySelectorAll("details"));
    const inBand = new Set<Element>();
    let observer: IntersectionObserver | undefined;
    function watch() {
      observer?.disconnect();
      inBand.clear();
      const height = window.innerHeight;
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inBand.add(entry.target);
          else inBand.delete(entry.target);
        }
        const index = panels.reduce((latest, panel, i) => inBand.has(panel) ? i : latest, -1);
        if (index >= 0) setActiveStep(index);
      }, { rootMargin: `-${Math.round(height * .26)}px 0px -${Math.round(height * .73)}px 0px` });
      panels.forEach((panel) => observer?.observe(panel));
    }
    watch();
    window.addEventListener("resize", watch);
    return () => {
      window.removeEventListener("resize", watch);
      observer?.disconnect();
    };
  }, []);
  const findings = [
    { label: "Representation · E5", title: "Context changes what the AI can see.", copy: "Knowing which files and programs were involved helped the model rank annotated events ahead of others.", value: ratio(e5("E5-C"), e5("E5-A")), metric: "Average Precision with full provenance vs. operation names alone", to: "/experiments/ablation", chart: <FindingPreview title="Average Precision by representation" mode="bar" rows={["E5-A", "E5-B", "E5-C"].map((id) => ({ id, value: e5(id) }))} /> },
    { label: "Training · E2", title: "Repetition can hide useful patterns.", copy: "Giving repeated descriptions less influence improved ranking compared with the original autoencoder in this study.", value: ratio(e2("E2-D"), e2("E2-A")), metric: "Average Precision with approximately matched-update unique-description training", to: "/experiments/training", chart: <FindingPreview title="Average Precision by training strategy" mode="dot" rows={["E2-A", "E2-B", "E2-C", "E2-D"].map((id) => ({ id, value: e2(id) }))} /> },
    { label: "Alert ranking · E2", title: "The order of alerts matters.", copy: "When an analyst can review only a few hundred alerts, putting annotated events near the top can make investigation more useful.", value: budget && positives != null && budget.minimum_true_positives === budget.maximum_true_positives ? `${budget.minimum_true_positives} of ${positives}` : null, metric: "originally annotated positives in E2-D’s top 500 alerts", to: "/experiments/alerts", chart: <Top500Preview maximum={positives} /> },
  ];

  return (
    <>
      <section className="pub-hero pub-wrap">
        <div className="pub-hero-copy">
          <p className="pub-kicker"><span className="pub-signal" /> MSc CYBERSECURITY RESEARCH <span className="pub-kicker-rule" /> UTB</p>
          <h1>Can artificial intelligence recognise a cyberattack <em>it has never seen before?</em></h1>
          <p className="pub-lede">Investigating how semantic artificial intelligence learns normal computer behaviour to identify anomalies associated with advanced persistent threats.</p>
          <div className="pub-actions">
            <Link className="pub-button" to="/understand">Explore the Research <ArrowRight size={17} /></Link>
            <Link className="pub-button pub-button-quiet" to="/progress">View Research Progress <ArrowUpRight size={16} /></Link>
          </div>
          <p className="pub-official"><span>OFFICIAL RESEARCH TITLE</span>{status?.official_title ?? "AI-based solution to detect and mitigate APT malware"}</p>
        </div>
        <div className="pub-hero-visual">
          <TeachingGraph />
          <Link className="pub-text-link" to="/understand/provenance-explorer">Explore the provenance graph lab <ArrowUpRight size={15} /></Link>
        </div>
      </section>
      <div className="pub-wrap pub-reading-bar">
        <span>Universiti Teknologi Brunei</span><span>Preliminary research · No unseen-campaign validation</span><a href="#problem">Start reading <ArrowDown size={15} /></a>
      </div>
      <section className="pub-wrap pub-journey-strip" aria-label="Research journey summary">
        <Suspense fallback={<Link className="pub-text-link" to="/progress">Open research progress <ArrowRight size={16} /></Link>}>
          {progress ? <CompactResearchJourney progress={progress} /> : <Link className="pub-text-link" to="/progress">{roadmap.isError ? "Roadmap summary unavailable · Open research progress" : "Open research progress"} <ArrowRight size={16} /></Link>}
        </Suspense>
      </section>
      <section id="problem" className="pub-wrap pub-home-section pub-split">
        <ChapterHeading number="01" label="THE PROBLEM" title="The same action can tell two different stories." />
        <div className="pub-prose">
          <p>An advanced persistent threat is a targeted intrusion where an attacker seeks to maintain access over time. It can be hard to spot because many individual actions look routine: reading a file, starting a program, or connecting to a service.</p>
          <div className="pub-context-example">
            <p className="pub-kicker">ILLUSTRATIVE EXAMPLE · SAME OPERATION</p>
            <div><code>Read file</code><span>Scheduled backup → shared archive</span></div>
            <div><code>Read file</code><span>Unexpected process → new destination</span></div>
          </div>
          <p>Knowing who did what, and what happened around it, gives analysts more to investigate. It still doesn’t tell them intent on its own.</p>
          <Link className="pub-text-link" to="/understand/apt">What is an advanced persistent threat? <ArrowUpRight size={16} /></Link>
        </div>
      </section>
      <section className="pub-tinted">
        <div className="pub-wrap pub-home-section">
          <div className="pub-split pub-approach-story">
            <div className="pub-approach-rail" data-depth="4">
              <ChapterHeading number="02" label="THE APPROACH" title="Learn what routine activity looks like." />
              <nav aria-label="Approach steps" className="pub-approach-cues">
                <span className="pub-approach-track" aria-hidden="true" data-depth="0"><i data-depth="2" style={{ transform: `scaleX(${(activeStep + 1) / 3})` }} /></span>
                {approachStages.map((title, index) => <a key={title} href={`#approach-${index + 1}`} aria-current={activeStep === index ? "step" : undefined}
                  onClick={() => setActiveStep(index)}><span>0{index + 1}</span> {title}</a>)}
              </nav>
            </div>
            <div className="pub-steps" ref={steps}>{approach.map(([title, summary, technical, to], index) =>
              <details key={title} id={`approach-${index + 1}`} data-current={activeStep === index}><summary onFocus={() => setActiveStep(index)}><span className="pub-step-index">0{index + 1}</span><span><strong>{title}</strong><small>{summary}</small></span></summary><p>{technical}</p><Link className="pub-text-link" to={to}>Explore this step <ArrowRight size={15} /></Link></details>,
            )}</div>
          </div>
          <div className="pub-section-space">
            <Suspense fallback={<Link className="pub-text-link" to="/understand/pipeline">Open the interactive pipeline <ArrowRight size={16} /></Link>}>
              <InteractivePipeline />
            </Suspense>
            <div className="pub-actions">
              <Link className="pub-text-link" to="/understand/embedding-explorer">Explore the embedding space <ArrowUpRight size={15} /></Link>
              <Link className="pub-text-link" to="/documentation/dataset">Compare dataset statistics <ArrowUpRight size={15} /></Link>
            </div>
          </div>
        </div>
      </section>
      <section className="pub-wrap pub-home-section">
        <div className="pub-split pub-section-intro">
          <ChapterHeading number="03" label="WHAT WE HAVE DISCOVERED" title="Three lessons from the experiments." />
          <div className="pub-prose"><p>These results are preliminary: repeated evaluation on one Phase 2 attack scenario, a small positive sample, and single-seed model results.</p><Link className="pub-text-link" to="/findings">Read all findings <ArrowRight size={16} /></Link></div>
        </div>
        <div className="pub-finding-grid">
          {findings.map((finding) => <article className="pub-finding-teaser" key={finding.title}>
            <p className="pub-kicker">{finding.label}</p><h3>{finding.title}</h3><p>{finding.copy}</p>
            {finding.value && <p className="pub-teaser-metric"><strong>{finding.value}</strong><span>{finding.metric}</span></p>}
            {finding.chart}
            <Link className="pub-text-link" to={finding.to} aria-label={`Inspect the evidence: ${finding.label}`}>Inspect the evidence <ArrowUpRight size={15} /></Link>
          </article>)}
        </div>
      </section>
      <section className="pub-tinted">
        <div className="pub-wrap pub-home-section">
          <div className="pub-split">
            <ChapterHeading number="04" label="RESEARCH PROGRESS" title={next?.id === "R18" ? "Will these results hold across runs?" : "Where the research stands."} />
            <div className="pub-prose">
              <p>{progress?.current?.description ?? (next?.id === "R18" ? status?.current_activity : undefined) ?? "See the roadmap for current research activity."}</p>
              <ol className="pub-timeline">
                {next && <li><span>Next · not reported as running</span><Link to={next.id === "R18" ? "/experiments/E7#execution-tracker" : "/progress"}>{next.title}</Link><p>{next.id === "R18" ? "Repeating selected runs with different random seeds tests how stable the results are. Testing on an independent scenario is a separate step." : next.description}</p></li>}
              </ol>
              <Link className="pub-text-link" to="/progress">Follow the research progress <ArrowRight size={16} /></Link>
            </div>
          </div>
          {next?.id === "R18" && <Suspense fallback={null}><UpcomingExecution id="E7" /></Suspense>}
        </div>
      </section>
      <section className="pub-wrap pub-home-section pub-split">
        <ChapterHeading number="05" label="EXPLORE FURTHER" title="Choose what to read next." />
        <div className="pub-paths">{paths.map(([title, description, to, Icon]) =>
          <Link to={to} key={to}><Icon size={21} /><span><strong>{title}</strong><small>{description}</small></span><ArrowUpRight size={17} /></Link>,
        )}</div>
      </section>
    </>
  );
}
