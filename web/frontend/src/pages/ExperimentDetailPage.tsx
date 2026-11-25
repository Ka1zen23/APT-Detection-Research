import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  FileText,
  GitCompareArrows,
  Image as ImageIcon,
  Microscope,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfusionMatrix } from "@/components/features/data";
import {
  EmptyState,
  ErrorState,
  InfoCallout,
  KpiCard,
  LoadingBlock,
  PageHeader,
  SectionHeading,
  SourceNote,
  StatusBadge,
} from "@/components/features/common";
import { figureUrl } from "@/services/api";
import { useExperiment } from "@/hooks/queries";
import { formatDecimal, formatDuration, formatPercent, formatThreshold, titleCase } from "@/lib/format";

function ConfigTable({ config }: { config: Record<string, unknown> }) {
  const entries = Object.entries(config ?? {});
  if (entries.length === 0) {
    return <div className="text-xs text-muted-foreground">No configuration recorded.</div>;
  }
  return (
    <div className="divide-y divide-border rounded border border-border">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-start justify-between gap-4 px-3 py-1.5">
          <span className="font-mono text-[12px] text-muted-foreground">{key}</span>
          <span className="max-w-[62%] break-words text-right font-mono text-[12px] text-foreground">
            {Array.isArray(value) ? value.join(", ") : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function FigureCard({
  title,
  src,
}: {
  title: string;
  src: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="group overflow-hidden rounded-md border border-border bg-surface text-left">
          <div className="flex items-center justify-between border-b border-border px-2.5 py-1.5">
            <span className="truncate text-[12px] font-medium text-foreground">{title}</span>
            <ImageIcon className="size-3 text-muted-foreground transition-colors group-hover:text-primary" />
          </div>
          <img src={src} alt={title} className="aspect-[4/3] w-full object-contain p-2" loading="lazy" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogTitle className="text-xs">{title}</DialogTitle>
        <img src={src} alt={title} className="max-h-[70vh] w-full object-contain" />
        <div className="text-[12px] text-muted-foreground">
          Figure served directly from the measured evaluation artifact. No chart is regenerated or
          interpolated in the browser.
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ExperimentDetailPage() {
  const { id = "" } = useParams();
  const { data, isLoading, error, refetch } = useExperiment(id);

  if (isLoading) return <LoadingBlock rows={8} />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;

  const metrics = data.metrics;
  const evaluation = data.evaluation_summary as
    | {
        attack_test?: {
          original_label?: Record<string, number | null>;
          contextual_label?: Record<string, number | null>;
          description_overlap?: Record<string, Record<string, number | null>>;
          original_label_tactics?: { tactic: string; positive_events: number; detected_events: number; recall: number }[];
        };
        benign_test?: { original_label?: Record<string, number | null> };
      }
    | undefined;

  const original = evaluation?.attack_test?.original_label;
  const contextual = evaluation?.attack_test?.contextual_label;
  const overlap = evaluation?.attack_test?.description_overlap;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Experiments, ${titleCase(data.group)}`}
        title={`${data.id}, ${data.name}`}
        description={data.research_question ?? undefined}
        actions={
          <>
            <StatusBadge status={data.status} />
            <Button asChild variant="outline" size="sm">
              <Link to="/experiments">
                <ArrowLeft /> Registry
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/comparison">
                <GitCompareArrows /> Compare
              </Link>
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{titleCase(data.kind)}</Badge>
          <Badge variant="outline">{data.representation}</Badge>
          {data.seed !== null && <Badge variant="outline">Seed {data.seed}</Badge>}
          {metrics?.availability?.status === "available" || metrics?.roc_auc !== null && metrics ? (
            <Badge variant="success">Measured metrics available</Badge>
          ) : (
            <Badge variant="neutral">No measured metrics</Badge>
          )}
        </div>
      </PageHeader>

      {data.warnings.length > 0 && (
        <InfoCallout tone="warning" title="Verification warning">
          {data.warnings.join(" ")}
        </InfoCallout>
      )}

      <InfoCallout tone="info" title="How to read this experiment">
        ROC-AUC and Average Precision rank across all thresholds. Precision, recall and false-positive
        rates use the recorded operating point, so check the threshold and seed. Contextual recall is a
        derived indicator, not independent ground truth.{" "}
        <Link className="font-medium text-primary underline underline-offset-4" to="/glossary">
          Glossary
        </Link>
        .
      </InfoCallout>

      {metrics && metrics.roc_auc !== null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="ROC-AUC"
            metricId="roc-auc"
            value={formatDecimal(metrics.roc_auc, 4)}
            detail="Threshold-independent ranking"
            source="results/autoencoder_comparison/ranking_summary.csv"
            tone="accent"
          />
          <KpiCard
            label="Average Precision"
            metricId="average-precision"
            value={formatDecimal(metrics.average_precision, 4)}
            detail="Precision-recall summary"
            source="results/autoencoder_comparison/ranking_summary.csv"
            tone="success"
          />
          <KpiCard
            label="Precision at operating point"
            metricId="precision"
            value={formatPercent(metrics.precision, 3)}
            detail={`${metrics.true_positives ?? "n/a"} TP, ${metrics.false_positives?.toLocaleString() ?? "n/a"} FP`}
            source="results/autoencoder_comparison/threshold_comparison.csv"
            tone="warning"
          />
          <KpiCard
            label="Recall at operating point"
            metricId="recall"
            value={formatPercent(metrics.recall, 2)}
            detail={`${metrics.operating_point ?? "Recorded operating point"}`}
            source="results/autoencoder_comparison/threshold_comparison.csv"
          />
          <KpiCard
            label="Contextual recall"
            metricId="contextual-recall"
            value={formatPercent(metrics.contextual_recall, 2)}
            detail="Derived indicator, not independent ground truth"
            tone="warning"
          />
          <KpiCard
            label="Benign false-positive rate"
            metricId="benign-fpr"
            value={formatPercent(metrics.benign_fpr, 3)}
            detail="False positives on the benign test partition"
          />
          <KpiCard
            label="Threshold"
            value={formatThreshold(metrics.threshold)}
            definition="Calibrated from benign validation reconstruction errors."
            detail={
              metrics.threshold_percentile
                ? `Validation P${metrics.threshold_percentile}`
                : "Recorded rule"
            }
          />
          <KpiCard
            label="Training duration"
            value={formatDuration(metrics.training_seconds)}
            definition="Wall-clock training time for this run. It is not a performance metric."
            detail={data.seed ? `Seed ${data.seed}` : "Seed not recorded"}
          />
        </div>
      ) : (
        <InfoCallout tone="neutral" title="No measured performance metrics">
          This entry is {data.status === "planned" ? "planned" : "an analytical study or platform entry"}.
          No model metrics are fabricated for it. Source artifacts: {data.source_artifacts.length || "none"}.
        </InfoCallout>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="results">Measured results</TabsTrigger>
          <TabsTrigger value="artifacts">Artifacts & figures</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Hypothesis and interpretation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs leading-relaxed">
                <div>
                  <div className="text-[12px] text-muted-foreground">Hypothesis</div>
                  <p className="mt-1 text-foreground">{data.hypothesis}</p>
                </div>
                <div>
                  <div className="text-[12px] text-muted-foreground">Results summary</div>
                  <p className="mt-1 text-muted-foreground">{data.results_summary}</p>
                </div>
                <div>
                  <div className="text-[12px] text-muted-foreground">Interpretation</div>
                  <p className="mt-1 text-muted-foreground">{data.interpretation}</p>
                </div>
                <div>
                  <div className="text-[12px] text-muted-foreground">Limitations</div>
                  <p className="mt-1 text-muted-foreground">{data.limitations}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Study design</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {[
                  ["Representation", data.representation],
                  ["Encoder", data.encoder],
                  ["Detection algorithm", data.algorithm],
                  ["Training strategy", data.training_strategy ?? "Not recorded"],
                  ["Checkpoint selection", data.checkpoint_selection],
                  ["Random seed", data.seed === null ? "Not applicable / not recorded" : String(data.seed)],
                ].map(([label, value]) => (
                  <div key={label} className="border-b border-border pb-2 last:border-0">
                    <div className="text-[12px] text-muted-foreground">{label}</div>
                    <div className="mt-0.5 text-[13px] leading-relaxed text-foreground">{value}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="configuration" className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Training configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <ConfigTable config={data.training_configuration} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Evaluation configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <ConfigTable config={data.evaluation_configuration} />
            </CardContent>
          </Card>
          {data.training_summary && Object.keys(data.training_summary).length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Recorded training summary</CardTitle>
                <div className="text-xs text-muted-foreground">
                  Direct fields from the run's training_summary.json artifact.
                </div>
              </CardHeader>
              <CardContent>
                <ConfigTable config={data.training_summary} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          {original ? (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Attack test, original annotations</CardTitle>
                    <div className="text-xs text-muted-foreground">
                      Edge-derived ground truth. Primary evaluation labels.
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ConfusionMatrix
                      tp={original.true_positives ?? null}
                      fp={original.false_positives ?? null}
                      fn={original.false_negatives ?? null}
                      tn={original.true_negatives ?? null}
                    />
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                      <div className="rounded border border-border px-2 py-1.5">
                        <span className="text-muted-foreground">Precision</span>
                        <div className="font-mono text-foreground">{formatPercent(original.precision ?? null, 3)}</div>
                      </div>
                      <div className="rounded border border-border px-2 py-1.5">
                        <span className="text-muted-foreground">Recall</span>
                        <div className="font-mono text-foreground">{formatPercent(original.recall ?? null, 2)}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Attack test, contextual indicators</CardTitle>
                    <div className="text-xs text-muted-foreground">
                      Derived from connected provenance nodes. Secondary, non-independent evidence.
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ConfusionMatrix
                      tp={contextual?.true_positives ?? null}
                      fp={contextual?.false_positives ?? null}
                      fn={contextual?.false_negatives ?? null}
                      tn={contextual?.true_negatives ?? null}
                      positiveLabel="Contextual positive"
                    />
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                      <div className="rounded border border-border px-2 py-1.5">
                        <span className="text-muted-foreground">Contextual recall</span>
                        <div className="font-mono text-foreground">{formatPercent(contextual?.recall ?? null, 2)}</div>
                      </div>
                      <div className="rounded border border-border px-2 py-1.5">
                        <span className="text-muted-foreground">Contextual AP</span>
                        <div className="font-mono text-foreground">{formatDecimal(contextual?.average_precision ?? null, 4)}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {overlap && (
                <Card>
                  <CardHeader>
                    <CardTitle>Seen vs unseen descriptions</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2">
                    {(["seen", "unseen"] as const).map((key) => {
                      const item = overlap[key];
                      if (!item) return null;
                      return (
                        <div key={key} className="rounded border border-border p-3">
                          <div className="text-[12px] font-medium text-muted-foreground">
                            {key} in training
                          </div>
                          <div className="mt-1 grid grid-cols-2 gap-2 text-[12px]">
                            <div>
                              <span className="text-muted-foreground">Events</span>
                              <div className="font-mono">{Number(item.records ?? 0).toLocaleString()}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Positives</span>
                              <div className="font-mono">{Number(item.positives ?? 0).toLocaleString()}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Alerts</span>
                              <div className="font-mono">{Number(item.alerts ?? 0).toLocaleString()}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Recall</span>
                              <div className="font-mono">{formatPercent(item.recall ?? null, 2)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {evaluation?.attack_test?.original_label_tactics && (
                <Card>
                  <CardHeader>
                    <CardTitle>Original-positive recall by ATT&CK tactic</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {evaluation.attack_test.original_label_tactics.map((tactic) => (
                      <div key={tactic.tactic} className="flex items-center gap-2">
                        <span className="w-36 font-mono text-[12px] text-muted-foreground">{tactic.tactic}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded bg-elevated">
                          <div
                            className="h-full bg-success"
                            style={{ width: `${tactic.recall * 100}%` }}
                          />
                        </div>
                        <span className="w-24 text-right font-mono text-[12px] text-foreground">
                          {tactic.detected_events}/{tactic.positive_events}
                        </span>
                      </div>
                    ))}
                    <div className="text-[12px] text-muted-foreground">
                      Original positives are concentrated in two tactics, so per-tactic conclusions are
                      limited.
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <EmptyState
              icon={<Microscope className="size-6" />}
              title="No evaluation artifact for this entry"
              description="Measured confusion matrices are shown only where the run produced an evaluation_summary.json artifact."
            />
          )}
        </TabsContent>

        <TabsContent value="artifacts" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5">
                  <FileText className="size-3.5" /> Source artifacts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {data.artifact_availability.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No source artifacts recorded.</div>
                ) : (
                  data.artifact_availability.map((artifact) => (
                    <div
                      key={artifact.artifact}
                      className="flex items-center gap-2 rounded border border-border px-2.5 py-1.5"
                    >
                      <span
                        className={`size-1.5 shrink-0 rounded-full ${
                          artifact.status === "available" ? "bg-success" : "bg-error"
                        }`}
                      />
                      <SourceNote source={artifact.artifact} className="flex-1" />
                      <Badge variant={artifact.status === "available" ? "success" : "error"}>
                        {artifact.status}
                      </Badge>
                    </div>
                  ))
                )}
                <div className="pt-2 text-[12px] leading-relaxed text-muted-foreground">
                  Paths are repository-relative. The browser never reads the filesystem directly; the
                  read-only API resolves only allowlisted roots.
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Data traceability</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-[13px] leading-relaxed text-muted-foreground">
                <p>
                  Summary metrics come from the artifact-specific JSON/CSV files. Per-event scores and
                  confusion matrices are not reconstructed from rounded summary values.
                </p>
                <p>
                  Where a required artifact is absent, the dashboard displays an unavailable state rather
                  than estimating the missing value.
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link to="/limitations">
                    Read methodological limitations <ArrowRight />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {data.figures && data.figures.length > 0 ? (
            <div>
              <SectionHeading
                title="Stored evaluation figures"
                description="Figures generated by the research pipeline and served directly from results/."
              />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.figures.slice(0, 9).map((figure) => (
                  <FigureCard
                    key={figure.key}
                    title={titleCase(figure.filename.replace(/\.png$/, ""))}
                    src={figureUrl(figure.key)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<CircleAlert className="size-6" />}
              title="No stored figures for this entry"
              description="Baselines and analytical studies may not have per-run figures. Summary metrics remain available where measured."
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
