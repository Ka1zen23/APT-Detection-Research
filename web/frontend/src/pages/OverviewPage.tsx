import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Database,
  FlaskConical,
  Gauge,
  Layers,
  ListChecks,
  ShieldAlert,
  Target,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import {
  ErrorState,
  InfoCallout,
  KpiCard,
  LoadingBlock,
  PageHeader,
  SectionHeading,
  SourceNote,
  StatusBadge,
} from "@/components/features/common";
import { formatDate, formatDecimal, formatNumber, formatPercent } from "@/lib/format";
import { useBudgets, useMethodology, useOverview } from "@/hooks/queries";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { BudgetRecoveryChart, ModelRankingChart } from "@/components/charts/OverviewCharts";
import { cn } from "@/lib/utils";
import type { ModelRow, RoadmapMilestone } from "@/types/api";

function LeaderboardRow({ row }: { row: ModelRow }) {
  return (
    <Link
      to={`/experiments/${row.id}`}
      className="grid grid-cols-[24px_56px_1fr_auto_auto] items-center gap-2 border-b border-border px-3 py-2.5 text-[13px] last:border-0 hover:bg-elevated/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
    >
      <span className="font-mono text-[12px] text-muted-foreground">{row.rank}</span>
      <span className="font-mono text-[12px] font-medium text-foreground">{row.id}</span>
      <span className="truncate text-muted-foreground">{row.name}</span>
      <span className="text-right font-mono text-[13px] tabular text-foreground">
        {formatDecimal(row.average_precision, 4)}
      </span>
      <span className="text-right font-mono text-[12px] tabular text-muted-foreground">
        {formatDecimal(row.roc_auc, 3)}
      </span>
    </Link>
  );
}

function Milestone({ milestone, last }: { milestone: RoadmapMilestone; last: boolean }) {
  return (
    <div className="relative flex gap-3 pb-3 last:pb-0">
      {!last && <div className="absolute left-[5px] top-3.5 h-full w-px bg-border" />}
      <span
        className={cn(
          "relative mt-1 size-2.5 shrink-0 rounded-full border-2 bg-surface",
          milestone.status === "next" ? "border-warning" : "border-success",
        )}
      />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12px] text-muted-foreground">{milestone.id}</span>
          <span className="truncate text-[13px] font-medium text-foreground">{milestone.title}</span>
          {milestone.status === "next" && <Badge variant="warning">Next</Badge>}
        </div>
        <div className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
          {milestone.description}
        </div>
      </div>
    </div>
  );
}

export function OverviewPage() {
  const { data, isLoading, error, refetch } = useOverview();
  const { data: methodology } = useMethodology();
  const { data: budgetPrimary } = useBudgets("E2-D");
  const { data: budgetBaseline } = useBudgets("E2-A");

  if (isLoading) {
    return (
      <div className="space-y-4">
        <LoadingBlock rows={2} />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <LoadingBlock key={index} rows={1} />
          ))}
        </div>
      </div>
    );
  }
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;

  const { kpis, leaderboard, roadmap, findings, limitations, journal, upcoming, research, dataset, counts } = data;
  const complete = roadmap.counts.completed ?? 0;
  const completion = (complete / roadmap.total) * 100;
  const bestRecall = kpis.best_recall;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`${research.institution}, Master's Research Project`}
        title={research.official_title}
        description={research.description}
        actions={
          <>
            <StatusBadge status="in_progress" />
            <Button asChild size="sm">
              <Link to="/experiments">
                <FlaskConical /> Experiment registry
              </Link>
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
          <Badge variant="outline">Read-only research dashboard</Badge>
          <Badge variant="warning">Preliminary evidence</Badge>
          <span>Last reviewed {formatDate(research.last_reviewed)}</span>
          <span>Primary operating point: {research.primary_operating_point}</span>
        </div>
      </PageHeader>

      <div className="grid gap-3 lg:grid-cols-[1.7fr_1fr]">
        <Card className="overflow-hidden">
          <div className="grid-lines flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="text-[12px] font-medium text-muted-foreground">
                Current research phase
              </div>
              <div className="mt-1 text-base font-semibold tracking-tight text-foreground">
                {research.phase}
              </div>
              <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {research.current_activity}
              </div>
            </div>
            <div className="shrink-0 rounded-md border border-border bg-surface/80 px-3 py-2">
              <div className="text-[12px] text-muted-foreground">Research status</div>
              <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-foreground">
                <span className="size-1.5 rounded-full bg-warning" />
                {research.status}
              </div>
            </div>
          </div>
          <div className="border-t border-border p-4">
            <div className="flex items-center justify-between text-[12px] text-muted-foreground">
              <span>Roadmap activities completed (implementation only)</span>
              <span className="font-mono text-foreground">
                {complete}/{roadmap.total}
              </span>
            </div>
            <Progress value={completion} className="mt-2" />
            <div className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              {research.implementation_note} {counts.in_progress} in progress,{" "}
              {roadmap.counts.next ?? 0} next, {counts.planned} planned.
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
            <Target className="size-3.5" /> Next research activity
          </div>
          <div className="mt-2 text-sm font-semibold tracking-tight text-foreground">
            {roadmap.next_milestone?.title ?? "E7, Multiple-seed reproducibility"}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {roadmap.next_milestone?.description ?? research.next_activity}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge variant="outline">Seeds 42, 123, 456</Badge>
            <Badge variant="outline">Mean ± SD</Badge>
            <Badge variant="warning">Next</Badge>
          </div>
          <Button asChild variant="outline" size="sm" className="mt-3 w-full">
            <Link to="/roadmap">
              View roadmap <ArrowRight />
            </Link>
          </Button>
        </Card>
      </div>

      <section>
        <SectionHeading
          title="Dataset and evidence at a glance"
          description="Measured counts from CICAPT-IIoT provenance artifacts. Original positives and contextual indicators are different label sources."
          action={
            <Link
              className="text-[13px] font-medium text-primary underline underline-offset-4"
              to="/glossary"
            >
              Glossary
            </Link>
          }
        />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Raw provenance records"
            value={formatNumber(kpis.raw_records)}
            definition="Rows in both raw provenance logs, before events are grouped."
            detail={`${formatNumber(dataset.counts.phase1_raw_records)} Phase 1, ${formatNumber(dataset.counts.phase2_raw_records)} Phase 2`}
            source="results/eda/dataset_inspection.txt"
            href="/dataset"
            icon={<Database className="size-4" />}
          />
          <KpiCard
            label="Reconstructed events"
            value={formatNumber(kpis.events)}
            definition="Event-level units after edges are grouped by event ID."
            detail={`${formatNumber(dataset.counts.phase1_events)} Phase 1, ${formatNumber(dataset.counts.phase2_events)} Phase 2`}
            source="data/processed/cicapt-iiot-v2/*_events.parquet"
            href="/dataset"
            icon={<Layers className="size-4" />}
          />
          <KpiCard
            label="Original malicious events"
            value={formatNumber(kpis.original_positives)}
            definition="Edge-derived positive annotations. These are the primary evaluation labels."
            detail={`${formatPercent(dataset.counts.attack_prevalence_percent, 4, true)} of the attack test`}
            source="results/eda/ground_truth_inspection.txt"
            href="/dataset"
            tone="error"
            icon={<ShieldAlert className="size-4" />}
          />
          <KpiCard
            label="Contextual positive events"
            value={formatNumber(kpis.contextual_positives)}
            definition="Derived from provenance nodes connected to malicious edges. Supporting evidence, not independent ground truth."
            source="data/processed/cicapt-iiot-v2/phase2_events.parquet"
            href="/dataset"
            tone="warning"
            icon={<Layers className="size-4" />}
          />
          <KpiCard
            label="Completed experiments"
            value={formatNumber(kpis.completed_experiments)}
            definition="Runs with a saved evaluation artifact in the registry."
            detail={`${kpis.completed_models} trained models, ${kpis.completed_analyses} analytical studies`}
            source="web/content/experiments.json + measured artifacts"
            href="/experiments"
            icon={<FlaskConical className="size-4" />}
          />
          <KpiCard
            label="Best observed ROC-AUC"
            value={formatDecimal(kpis.best_roc_auc.value, 4)}
            definition="How well a model ranks a positive above a negative across all thresholds."
            detail={
              <>
                <span className="font-mono text-foreground">{kpis.best_roc_auc.experiment_id}</span>, threshold-independent ranking
              </>
            }
            source="results/autoencoder_comparison/ranking_summary.csv"
            href={`/experiments/${kpis.best_roc_auc.experiment_id}`}
            tone="accent"
            icon={<TrendingUp className="size-4" />}
          />
          <KpiCard
            label="Best observed Average Precision"
            value={formatDecimal(kpis.best_average_precision.value, 4)}
            definition="Area under the precision-recall curve. Sensitive to the 70 original positives."
            detail={
              <>
                <span className="font-mono text-foreground">{kpis.best_average_precision.experiment_id}</span>, leading anomaly ranker
              </>
            }
            source="results/autoencoder_comparison/ranking_summary.csv"
            href={`/experiments/${kpis.best_average_precision.experiment_id}`}
            tone="success"
            icon={<BarChart3 className="size-4" />}
          />
          <KpiCard
            label="Best observed recall"
            value={formatPercent(bestRecall.value, 1)}
            definition="Share of the 70 original positives found at the recorded operating point."
            detail={
              <>
                <span className="font-mono text-foreground">{bestRecall.experiment_id}</span>
                {bestRecall.tied_count > 1
                  ? `, tied across ${bestRecall.tied_count} models at their recorded operating points`
                  : " at its recorded operating point"}
              </>
            }
            source="results/autoencoder_comparison/threshold_comparison.csv; results/baselines/*"
            href="/comparison"
            tone="warning"
            icon={<Gauge className="size-4" />}
          />
        </div>
        <div className="mt-2">
          <InfoCallout tone="warning" title="Best metrics are not a single model recommendation">
            ROC-AUC, Average Precision and recall come from different operating points and can be tied.
            The best-recall group at P99 includes {bestRecall.experiment_ids.join(", ")}. High recall does
            not imply usable precision.
          </InfoCallout>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <ChartFrame
            title="Average precision by model"
            description="Average Precision on the 100,892-event attack test with original labels. E2-D is highlighted. Higher is better; a ranking metric is not a deployment recommendation."
            source="results/autoencoder_comparison/ranking_summary.csv"
            glossaryId="average-precision"
            footnote="Six measured model configurations. E2-D reaches 0.1091; the next model is E2-B at 0.0261. The full 12-entry registry is on the experiments page."
          >
            <ModelRankingChart rows={leaderboard} />
          </ChartFrame>
          <ChartFrame
            title="Attacks found inside the alert budget"
            description="Original labelled attacks found inside the top N alerts. Only measured budget points are plotted; intermediate budgets are not interpolated."
            source="results/autoencoder_comparison/alert_budget_comparison.csv"
            glossaryId="alert-budget"
            footnote="Solid line: E2-D. Dashed line: E2-A. At 500 alerts, E2-D finds 46 of 70; E2-A finds none."
          >
            {budgetPrimary?.rows?.length && budgetBaseline?.rows?.length ? (
              <BudgetRecoveryChart
                primary={budgetPrimary.rows}
                baseline={budgetBaseline.rows}
              />
            ) : (
              <div className="flex h-[360px] items-center justify-center text-[13px] text-muted-foreground">
                Budget data is unavailable.
              </div>
            )}
          </ChartFrame>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>Model performance leaderboard</CardTitle>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Ranked by Average Precision on the attack test using original labels.
              </div>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/comparison">
                Compare <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-1 pb-1 pt-3">
            <div className="grid grid-cols-[24px_56px_1fr_auto_auto] gap-2 border-b border-border px-3 pb-1.5 text-[12px] text-muted-foreground">
              <span>#</span>
              <span>ID</span>
              <span>Model</span>
              <span className="text-right">AP</span>
              <span className="text-right">ROC</span>
            </div>
            {leaderboard.map((row) => (
              <LeaderboardRow key={row.id} row={row} />
            ))}
            <div className="px-3 py-2 text-[12px] text-muted-foreground">
              Full 12-model table, ROC/PR curves and confusion matrices are on the comparison page.
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Research pipeline</CardTitle>
              <div className="text-xs text-muted-foreground">
                Implemented event-level pipeline; future components are not shown as complete.
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {(methodology?.pipeline ?? [])
                .filter((step) => ["P01", "P03", "P05", "P07", "P10", "P11"].includes(step.id))
                .map((step, index) => (
                  <div key={step.id} className="flex items-center gap-2">
                    <span className="grid size-5 shrink-0 place-items-center rounded border border-success/25 bg-success/5 font-mono text-[12px] text-success">
                      {index + 1}
                    </span>
                    <span className="text-[13px] text-foreground">{step.label}</span>
                    <ArrowRight className="ml-auto size-3 text-muted-foreground/50" />
                  </div>
                ))}
              <Button asChild variant="ghost" size="sm" className="mt-2 w-full">
                <Link to="/methodology">
                  Full methodology <ArrowRight />
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Current research activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-xs font-medium text-foreground">{research.current_activity}</div>
              <p className="text-[13px] leading-relaxed text-muted-foreground">{research.next_activity}</p>
              <div className="rounded border border-border bg-elevated/60 p-2">
                <div className="text-[12px] text-muted-foreground">
                  Upcoming experiments
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {upcoming.slice(0, 6).map((experiment) => (
                    <Badge key={experiment.id} variant="outline" className="font-mono">
                      {experiment.id}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Milestone timeline</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/roadmap">All</Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-3">
            {[...roadmap.milestones]
              .filter((milestone) => milestone.status === "completed")
              .slice(-5)
              .map((milestone) => (
                <Milestone
                  key={milestone.id}
                  milestone={milestone}
                  last={milestone.id === roadmap.milestones.slice(-5)[0]?.id}
                />
              ))}
            {roadmap.next_milestone && (
              <Milestone milestone={roadmap.next_milestone} last />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Latest preliminary findings</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/findings">All</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-3">
            {findings.slice(0, 4).map((finding) => (
              <Link key={finding.id} to="/findings" className="block group">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 font-mono text-[12px] text-muted-foreground">{finding.id}</span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-foreground group-hover:text-primary">
                      {finding.title}
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
                      {finding.observation}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Research journal</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/journal">Open</Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-3">
              {journal.length > 0 ? (
                <Link to={`/journal/${journal[0].slug}`} className="block group">
                  <div className="flex items-center gap-1.5 font-mono text-[12px] text-muted-foreground">
                    <BookOpen className="size-3" />
                    {formatDate(journal[0].date)}
                  </div>
                  <div className="mt-1 text-[13px] font-medium text-foreground group-hover:text-primary">
                    {journal[0].title}
                  </div>
                  <div className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-muted-foreground">
                    {journal[0].summary}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {journal[0].experiments.slice(0, 4).map((id) => (
                      <Badge key={id} variant="outline" className="font-mono text-[12px]">
                        {id}
                      </Badge>
                    ))}
                  </div>
                </Link>
              ) : (
                <div className="text-xs text-muted-foreground">No journal entries available.</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Methodological limitations</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/limitations">All</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 pt-3">
              {limitations.slice(0, 4).map((limitation) => (
                <div key={limitation.id} className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 size-3 shrink-0 text-warning" />
                  <div>
                    <div className="text-[12px] font-medium text-foreground">{limitation.title}</div>
                    <div className="line-clamp-1 text-[12px] text-muted-foreground">{limitation.detail}</div>
                  </div>
                </div>
              ))}
              <Button asChild variant="ghost" size="sm" className="w-full">
                <Link to="/limitations">
                  <ListChecks /> Review all limitations
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="p-5">
        <SectionHeading
          title="Evidence provenance"
          description="Every metric on this dashboard is loaded from an existing artifact or explicitly labelled as maintained content."
        />
        <div className="grid gap-2 text-[12px] text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
          {[
            "results/autoencoder_comparison/ranking_summary.csv",
            "results/autoencoder_comparison/threshold_comparison.csv",
            "results/ablation_comparison/ablation_comparison.csv",
            "data/splits/cicapt-iiot/split_summary.json",
          ].map((source) => (
            <SourceNote key={source} source={source} />
          ))}
        </div>
        <SourceNote
          className="mt-3"
          source="Read-only API, no model retraining, no checkpoint execution, no filesystem writes"
        />
      </Card>
    </div>
  );
}
