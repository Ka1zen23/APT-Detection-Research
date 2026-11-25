import { ArrowLeft, ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { TeachingGraph } from "@/components/publication/TeachingGraph";
import { AutoencoderDemo, BudgetDemo, EmbeddingDemo, ImbalanceDemo, ProvenanceDemo, ThresholdDemo } from "@/components/publication/ResearchDemos";
import { useTourProgress } from "@/hooks/use-tour-progress";

const chapters = [
  {
    slug: "apt", title: "What is an advanced persistent threat?",
    explanation: "An advanced persistent threat is a targeted intrusion in which an attacker seeks to stay in a system over time. The name describes a campaign, not a single suspicious file or alert.",
    takeaway: "The study flags unusual events for review. It does not identify an attacker or prove that an event belongs to an APT.",
    technical: "The evaluation uses events in an existing CICAPT-IIoT provenance dataset. An event-level anomaly score is not campaign attribution or evidence of performance on unseen campaigns.",
    visual: TeachingGraph, links: [["Research objectives", "/documentation/objectives"]],
  },
  {
    slug: "detection-difficulty", title: "Why is APT detection difficult?",
    explanation: "Routine work and suspicious activity can share the same computer operations. Reading a file is common; which program read it and where the copy went are more useful clues.",
    takeaway: "The action alone can look identical even when the surrounding activity differs.",
    technical: "Exact matches in verbalised text are passed to the same frozen encoder, so the detector cannot distinguish those descriptions through their text alone. E5 measures those collisions and compares complete representations.",
    visual: ProvenanceDemo, links: [["E5 provenance comparison", "/experiments/ablation"]],
  },
  {
    slug: "system-provenance", title: "What is system provenance?",
    explanation: "Provenance is a record of how things relate. Instead of listing ‘read file’ alone, it can say which process read which file and link that action to other activity.",
    takeaway: "Provenance answers who did what to which entity.",
    technical: "The full representation verbalises directed relationships and entity attributes. E5-A retains operations only; E5-B adds entities; E5-C includes directed relationships. This is not a controlled isolation of graph relationships alone.",
    visual: ProvenanceDemo, links: [["E5-C · full provenance", "/experiments/E5-C"], ["Dataset specifications", "/documentation/dataset"]],
  },
  {
    slug: "dataset", title: "What does the dataset contain?",
    explanation: "The dataset contains collected records of computer activity, with some events explicitly annotated as malicious. Most events in the attack-test partition were not originally labelled positive.",
    takeaway: "Most events have a negative label, even in the attack-test partition. That makes overall accuracy a poor guide on its own.",
    technical: "The study distinguishes original annotations from derived contextual positives linked to annotated activity. Contextual labels are not independent ground truth. Results must identify which label set they use.",
    visual: ImbalanceDemo, links: [["Dataset specifications", "/documentation/dataset"], ["Research limitations", "/documentation/limitations"]],
  },
  {
    slug: "event-descriptions", title: "How are events converted into descriptions?",
    explanation: "A consistent template turns structured records into words. ‘Backup utility reads project file’ preserves more meaning than a list containing only the operation ‘read’.",
    takeaway: "The template determines which details the model can use.",
    technical: "Verbalisation is deterministic and should not insert ground-truth labels into model inputs. Operation names, process and artifact attributes, and relations are selected according to the representation under study.",
    visual: ProvenanceDemo, links: [["Verbalisation methodology", "/documentation/methodology"]],
  },
  {
    slug: "minilm", title: "How does MiniLM understand descriptions?",
    explanation: "MiniLM turns a description into a list of numbers. Similar meanings can produce similar patterns of numbers, even when two descriptions use different words. The encoder does not make the alert decision.",
    takeaway: "MiniLM supplies a representation; the anomaly detector uses it.",
    technical: "The encoder is frozen sentence-transformers/all-MiniLM-L6-v2. The study uses normalised 384-dimensional representations. A text that exceeds the input limit may lose information.",
    visual: EmbeddingDemo, links: [["Model specifications", "/documentation/architecture"], ["Research methodology", "/documentation/methodology"]],
  },
  {
    slug: "embeddings", title: "What are semantic embeddings?",
    explanation: "An embedding is a list of numbers used to represent a description. A distance between two embeddings can indicate similarity, but it is not a judgement about whether either event is malicious.",
    takeaway: "Embeddings give the model a way to compare patterns beyond exact wording.",
    technical: "The detector uses the full embedding, not a 2D map. The diagram is conceptual; it does not use dimensionality reduction or report measured similarity scores.",
    visual: EmbeddingDemo, links: [["Interactive embedding explorer", "/understand/embedding-explorer"], ["Model specifications", "/documentation/architecture"]],
  },
  {
    slug: "autoencoder", title: "How does an autoencoder learn normal behaviour?",
    explanation: "Imagine learning to sketch familiar objects from a short summary. With practice, the sketches get closer to familiar originals. The autoencoder learns a comparable task on representations of benign training events.",
    takeaway: "The model learns to reconstruct patterns, rather than memorising a list of known attacks.",
    technical: "The fully connected autoencoder compresses 384 input values through a 128-unit layer to a 32-unit bottleneck, then reconstructs the 384 values through another 128-unit layer.",
    visual: AutoencoderDemo, links: [["E2-A · original autoencoder", "/experiments/E2-A"], ["Model specifications", "/documentation/architecture"]],
  },
  {
    slug: "reconstruction-error", title: "What is reconstruction error?",
    explanation: "Compare the input with what the model reconstructs. A bigger difference gives a higher error. Unfamiliar routine activity can also produce a high error.",
    takeaway: "Reconstruction error is a clue about unusual patterns, not a verdict.",
    technical: "The score is per-event mean squared error across the embedding values. The saved trained model scores test events without updating its weights.",
    visual: AutoencoderDemo, links: [["Threshold evidence", "/experiments/thresholds"]],
  },
  {
    slug: "anomaly-detection", title: "How does anomaly detection work?",
    explanation: "An alert threshold is a line: scores above it get flagged. Move the line down and you will usually get more alerts, including events that were not labelled positive.",
    takeaway: "The useful threshold depends on what analysts can investigate and what they can afford to miss.",
    technical: "Percentile thresholds are derived from benign validation reconstruction error. Operational results depend on the threshold and label set. Retrospectively inspected operating points are exploratory, not independently validated.",
    visual: ThresholdDemo, links: [["Measured threshold comparison", "/experiments/thresholds"]],
  },
  {
    slug: "alert-evaluation", title: "How are alerts evaluated?",
    explanation: "An analyst cannot review every alert. One practical question is how many annotated events are near the top of the queue when the analyst can only review the first 100 or 500 alerts.",
    takeaway: "Ranking matters when investigation time is limited.",
    technical: "Average Precision summarises precision across recall increases in the ranked list. Recall is the fraction of annotated positives found. Precision is the fraction of alerts matching those annotations. Fixed-budget comparisons treat ties at the cutoff explicitly.",
    visual: BudgetDemo, links: [["Alert-budget evidence", "/experiments/alerts"], ["Metric definitions", "/documentation/glossary"]],
  },
  {
    slug: "mitigation", title: "How could detected anomalies support mitigation?",
    explanation: "An unusual event could give an analyst a starting point. They would review the surrounding evidence, look for benign explanations, and decide whether a response is justified. A high score alone is not enough.",
    takeaway: "Mitigation is planned and has not been implemented or validated.",
    technical: "A future mitigation study would need separate validation, evidence-grounded recommendations, and human approval. The offline detection evaluation does not test mitigation outcomes.",
    example: ["Alert raised", "Analyst reviews context", "Human decides whether to respond"],
    links: [["Mitigation roadmap", "/progress#mitigation"], ["Research limitations", "/documentation/limitations"]],
  },
] as const;

export function ResearchTourPage() {
  const { chapter } = useParams();
  const index = chapters.findIndex((item) => item.slug === chapter);
  const progress = useTourProgress(chapters[index]?.slug);
  const completed = chapters.filter(({ slug }) => progress.completed.includes(slug));
  const resume = chapters.find(({ slug }) => slug === progress.last);
  const remaining = chapters.length - completed.length;
  if (chapter && index === -1) return <><h1 className="pub-editorial-title">Chapter not found</h1><Link className="pub-text-link" to="/understand">Return to the chapter index</Link></>;
  if (index === -1) return <>
    <p className="pub-kicker">Research tour · 12 short chapters</p>
    <h1 className="pub-editorial-title">Understand the research</h1>
    <p className="pub-lede">Follow an event from the computer’s activity log to an analyst’s alert queue. Start at the beginning or choose any topic below.</p>
    <div className="pub-actions">
      <Link className="pub-button" to={`/understand/${resume?.slug ?? "apt"}`}>{resume ? "Resume reading" : "Start chapter 01"} <ArrowRight size={17} /></Link>
      <Link className="pub-button pub-button-quiet" to="/understand/pipeline">Interactive pipeline <ArrowUpRight size={15} /></Link>
      <Link className="pub-button pub-button-quiet" to="/understand/provenance-explorer">Provenance graph lab <ArrowUpRight size={15} /></Link>
    </div>
    <p className="pub-tour-count"><strong>{completed.length} of {chapters.length}</strong> chapters marked read · {remaining} remaining. Saved on this browser only.</p>
    <ol className="pub-tour-index pub-section-space">
      {chapters.map((item, i) => <li key={item.slug}><Link to={`/understand/${item.slug}`}><span>{String(i + 1).padStart(2, "0")}</span>{item.title}{completed.includes(item) ? <Check size={17} aria-label="Marked read" /> : <ArrowUpRight size={17} aria-hidden="true" />}</Link></li>)}
    </ol>
  </>;
  const item = chapters[index];
  const Visual = "visual" in item ? item.visual : null;
  return <article className="pub-reading">
    <aside className="pub-tour-tracker" aria-label="Personal reading progress">
      <div><strong>Chapter {index + 1} of {chapters.length}</strong><p aria-live="polite">{completed.length} marked read · {remaining} remaining</p></div>
      <progress max={chapters.length} value={completed.length} aria-label="Chapters marked read" />
      <nav aria-label="Jump to a chapter" className="pub-chapter-markers">
        {chapters.map(({ slug, title }, i) => {
          const done = progress.completed.includes(slug);
          return <Link key={slug} to={`/understand/${slug}`} aria-current={i === index ? "step" : undefined} aria-label={`Chapter ${i + 1}: ${title}${done ? " · Marked read" : ""}`} data-read={done || undefined} title={title}>
            {i + 1}{done && <Check aria-hidden="true" size={12} />}
          </Link>;
        })}
      </nav>
    </aside>
    <p className="pub-kicker">Guided research tour · {String(index + 1).padStart(2, "0")} / {chapters.length}</p>
    <h1 className="pub-editorial-title">{item.title}</h1>
    <p className="pub-lede">{item.explanation}</p>
    <div className="pub-section-space">
      {Visual ? <Visual key={item.slug} /> : "example" in item && <div className="pub-demo"><p className="pub-kicker">Illustrative review workflow · planned</p><ol className="pub-controls">{item.example.map((step, i) => <li key={step}>{i + 1}. {step}</li>)}</ol></div>}
    </div>
    <aside className="pub-takeaway"><p className="pub-kicker">Key takeaway</p><p>{item.takeaway}</p></aside>
    <details className="pub-disclosure"><summary>Technical explanation</summary><p className="pub-prose">{item.technical}</p></details>
    <div className="pub-actions" aria-label="Related evidence">{item.links.map(([label, to]) => <Link className="pub-text-link" key={to} to={to}>{label} <ArrowUpRight size={15} /></Link>)}</div>
    <nav className="pub-tour-pager" aria-label="Chapter navigation">
      <Link className="pub-text-link" to={index > 0 ? `/understand/${chapters[index - 1].slug}` : "/understand"}><ArrowLeft size={16} />{index > 0 ? "Previous chapter" : "Chapter index"}</Link>
      <button className="pub-segment" type="button" aria-pressed={completed.includes(item)} onClick={() => progress.toggleComplete(item.slug)}>{completed.includes(item) ? "Marked read" : "Mark as read"}</button>
      <Link className="pub-text-link" to={index < chapters.length - 1 ? `/understand/${chapters[index + 1].slug}` : "/findings"}>{index < chapters.length - 1 ? "Next chapter" : "Explore the findings"} <ArrowRight size={16} /></Link>
    </nav>
  </article>;
}
