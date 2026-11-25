import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { ErrorState, LoadingBlock } from "@/components/features/common";
import { useAblation, useBudgets, useFindings, useModelComparison, useThresholds } from "@/hooks/queries";
import type { Finding } from "@/types/api";
import { formatDecimal, formatNumber, titleCase } from "@/lib/format";

const copy: Record<string, { title: string; summary: string; why: string; alt: string; route: string }> = {
  F01: { title: "The same operation can hide different activity.", summary: "When the model sees only operation names, events with very different contexts can become identical inputs.", why: "If the inputs look the same to the model, it has no way to distinguish them from the description alone.", alt: "An exact match is not proof of identical intent; conversely, different descriptions might still describe similar behaviour.", route: "/experiments/ablation" },
  F02: { title: "One description dominates the training data.", summary: "A single routine description occurs so often that the model sees far more of it than of most other descriptions.", why: "What the model sees most often can shape what it learns to reconstruct.", alt: "The pattern may reflect how this scenario was collected rather than what routine activity looks like elsewhere.", route: "/documentation/dataset" },
  F03: { title: "Changing how often examples repeat improved ranking.", summary: "The model trained on unique descriptions with a similar number of training updates put more annotated events near the top than the original autoencoder.", why: "How often training examples repeat can matter even without changing the model architecture.", alt: "The update budgets were approximately matched, not identical. One seed cannot establish how stable the advantage is.", route: "/experiments/comparison" },
  F04: { title: "Better ranking helps when review time is limited.", summary: "With an investigation budget of 500 alerts, E2-D put more originally annotated events within reach than the other autoencoder variants.", why: "A useful queue helps analysts spend limited time on alerts backed by stronger evidence. Overall accuracy does not show this.", alt: "This is an offline ranking result, not a measurement of how quickly analysts detect or respond to a real incident.", route: "/experiments/alerts" },
  F05: { title: "Giving AI more context improved suspicious-event ranking.", summary: "Knowing which programs and files were involved helped the model separate events that look alike when reduced to operation names.", why: "The way we describe an event affects what a detector can learn from it.", alt: "Most of the gain appears when entity attributes are added. The configurations change several textual properties, so this comparison does not isolate the causal contribution of graph relationships.", route: "/experiments/ablation" },
  F06: { title: "Fewer alerts can mean less context recovered.", summary: "A stricter threshold cut the number of false positives, but it also flagged fewer events linked to the annotated activity.", why: "An operating threshold is a trade-off between analyst workload and potentially useful context.", alt: "The stricter operating point was examined retrospectively. Its trade-off may not recur on a new scenario.", route: "/experiments/thresholds" },
};

export interface EvidenceBar { label: string; value?: number | null; display: string; colour?: string }

export function EvidenceBars({ title, bars, caption }: { title: string; bars: EvidenceBar[]; caption: string }) {
  const available = bars.filter(({ value }) => value != null && Number.isFinite(value));
  const max = Math.max(...available.map(({ value }) => value ?? 0), Number.EPSILON);
  return <figure className="pub-evidence">
    <figcaption><strong>{title}</strong><span>{caption}</span></figcaption>
    {available.length ? <ul>{available.map((bar) => <li key={bar.label}><b>{bar.label}</b><span aria-hidden="true" className="pub-bar-track"><span style={{ width: `${100 * (bar.value ?? 0) / max}%`, backgroundColor: bar.colour ?? "var(--primary)" }} /></span><span>{bar.display}</span></li>)}</ul> : <p>Measured values are not available here.</p>}
  </figure>;
}

function FindingArticle({ finding, figure }: { finding: Finding; figure: React.ReactNode }) {
  const entry = copy[finding.id];
  return <article id={finding.id} className="pub-finding-article">
    <div className="pub-split">
      <div><p className="pub-kicker">{finding.id} · {titleCase(finding.validation_status)}</p>
        <h2 className="pub-editorial-h2">{entry?.title ?? finding.title}</h2>
        <p className="pub-finding-question">{finding.research_question}</p>
      </div>
      <div className="pub-prose"><p>{entry?.summary ?? finding.observation}</p>{figure}<p><strong>Why it matters.</strong> {entry?.why ?? finding.interpretation}</p></div>
    </div>
    <div className="pub-finding-details">
      <details className="pub-disclosure"><summary>Supporting evidence and detailed results</summary><div className="pub-prose"><p>{finding.observation}</p><p>{finding.evidence}</p></div></details>
      <details className="pub-disclosure"><summary>Experiment configuration and source artifacts</summary><div className="pub-prose">
        <p>Open an experiment for its configuration, numerical results and source references.</p>
        <div className="pub-controls">{finding.related_experiments.map((id) => <Link className="pub-text-link" key={id} to={`/experiments/${id}`}>{id} <ArrowUpRight size={15} /></Link>)}</div>
        {entry && <p><Link className="pub-text-link" to={entry.route}>Open related evidence <ArrowUpRight size={15} /></Link></p>}
      </div></details>
      <details className="pub-disclosure"><summary>Interpretation and limitations</summary><div className="pub-prose"><p>{finding.interpretation}</p>{entry && <p>{entry.alt}</p>}<p>{finding.limitations}</p></div></details>
    </div>
  </article>;
}

export function PublicationFindings() {
  const { data, isLoading, error, refetch } = useFindings();
  const { data: ablation } = useAblation();
  const { data: comparison } = useModelComparison();
  const { data: budgets } = useBudgets("E2-D");
  const { data: thresholds } = useThresholds("E2-D");
  const colours: Record<string, string> = { "E2-A": "var(--chart-5)", "E2-D": "var(--chart-1)", "E5-A": "var(--chart-5)", "E5-B": "var(--chart-3)", "E5-C": "var(--chart-1)" };
  const ap = (ids: string[], models?: NonNullable<typeof comparison>["models"]) => ids.map((id) => {
    const value = models?.find((row) => row.id === id)?.average_precision;
    return { label: id, value, display: formatDecimal(value, 6), colour: colours[id] };
  });
  const figures: Record<string, React.ReactNode> = {
    F01: <EvidenceBars title="Records in exact-description label conflicts" caption="Measured on the Phase 2 attack-test partition; original labels." bars={["operation_only", "operation_entities", "full_provenance"].map((key, i) => {
      const value = ablation?.conflicts[key]?.original.conflicting_records;
      const label = `E5-${"ABC"[i]}`;
      return { label, value, display: formatNumber(value), colour: colours[label] };
    })} />,
    F02: <figure className="pub-evidence"><figcaption><strong>One template repeats; others vary</strong><span>Illustrative pattern, not to scale. Measured counts are below.</span></figcaption><p className="pub-repetition" aria-hidden="true">A A A A A · B C D …</p><p>{data?.findings.find((item) => item.id === "F02")?.observation}</p></figure>,
    F03: <EvidenceBars title="Average Precision by training strategy" caption="Average Precision rewards ranking annotated positives above negatives. Same attack-test partition and original labels." bars={ap(["E2-A", "E2-D"], comparison?.models)} />,
    F04: <EvidenceBars title="Annotated positives recovered by E2-D" caption="Measured review budgets, expressed as numbers of alerts. Counts account for ties." bars={(budgets?.rows ?? []).filter((row) => [100, 200, 500, 1000].includes(row.budget)).map((row) => ({ label: formatNumber(row.budget), value: row.expected_true_positives, display: String(row.expected_true_positives) }))} />,
    F05: <EvidenceBars title="Average Precision by representation" caption="E5-A uses operations only; E5-B adds entity attributes; E5-C includes explicit relationships." bars={ap(["E5-A", "E5-B", "E5-C"], ablation?.models)} />,
    F06: <EvidenceBars title="False positives at two operating points" caption="E2-D · Original labels. P99.95 was examined retrospectively." bars={(thresholds?.rows ?? []).filter((row) => [99, 99.95].includes(row.percentile)).map((row) => ({ label: `P${row.percentile}`, value: row.false_positives, display: formatNumber(row.false_positives), colour: row.exploratory ? "var(--chart-2)" : "var(--chart-1)" }))} />,
  };
  return <>
    <p className="pub-kicker">Research evidence · preliminary findings</p>
    <h1 className="pub-editorial-title">What the experiments tell us</h1>
    <p className="pub-lede">Context, training and alert ranking all changed what the model flagged. These observations come from repeated evaluation on one Phase 2 attack scenario, with few original positives and single-seed model results.</p>
    {isLoading && <LoadingBlock rows={5} />}
    {error && <ErrorState error={error} onRetry={() => refetch()} />}
    {data && <nav className="pub-actions" aria-label="Finding index">{data.findings.map((finding) => <a key={finding.id} href={`#${finding.id}`} className="pub-segment" title={finding.title}>{finding.id}</a>)}</nav>}
    {data?.findings.map((finding) => <FindingArticle key={finding.id} finding={finding} figure={figures[finding.id]} />)}
    <div className="pub-actions"><Link className="pub-text-link" to="/documentation/limitations">Read the study limitations <ArrowUpRight size={15} /></Link></div>
  </>;
}
