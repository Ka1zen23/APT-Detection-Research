import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, FlaskConical, Lightbulb, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/misc";
import {
  ErrorState,
  InfoCallout,
  KpiCard,
  LoadingBlock,
  PageHeader,
  SourceNote,
} from "@/components/features/common";
import { FindingMiniChart } from "@/components/charts/FindingMiniChart";
import {
  useAblation,
  useBudgets,
  useFindings,
  useModelComparison,
  useThresholds,
} from "@/hooks/queries";
import { cn } from "@/lib/utils";
import { titleCase } from "@/lib/format";

const VISUALISATION_LINKS: Record<string, string> = {
  ablation: "/ablation",
  comparison: "/comparison",
  alerts: "/alerts",
  thresholds: "/thresholds",
  dataset: "/dataset",
};

export function FindingsPage() {
  const { data, isLoading, error, refetch } = useFindings();
  const { data: ablation } = useAblation();
  const { data: comparison } = useModelComparison();
  const { data: budgets } = useBudgets("E2-D");
  const { data: thresholds } = useThresholds("E2-D");
  const [open, setOpen] = useState<string[]>(["F03"]);

  if (isLoading) return <LoadingBlock rows={8} />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;

  const chartData = { ablation, comparison, budgets, thresholds };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Research findings"
        description="Six preliminary findings grounded in measured artifacts. Each card pairs an observation with a chart from the same evidence. These are experimental observations, not deployment claims."
        actions={<Badge variant="warning">All preliminary</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Findings"
          value={String(data.count)}
          definition="Preliminary observations F01 to F06, each linked to an experiment."
          source="web/content/findings.json"
        />
        <KpiCard
          label="Evidence base"
          value="12"
          unit="measured models"
          definition="Models and analyses with saved artifacts. One seed and one attack scenario."
          source="web/content/experiments.json"
        />
        <KpiCard
          label="Validation state"
          value="Pending"
          tone="warning"
          definition="Independent scenario and multi-seed validation have not run."
          source="web/content/roadmap.json"
        />
      </div>

      <InfoCallout tone="info" title="How to read these findings">
        Each card shows the observation and a small chart from the same measured data. Open a card for
        the research question, supporting evidence, interpretation and limits.{" "}
        <Link className="font-medium text-primary underline underline-offset-4" to="/glossary">
          Glossary
        </Link>
        .
      </InfoCallout>

      <div className="space-y-3">
        {data.findings.map((finding) => {
          const isOpen = open.includes(finding.id);
          return (
            <Card key={finding.id} className="overflow-hidden">
              <Collapsible
                open={isOpen}
                onOpenChange={(next) =>
                  setOpen((current) =>
                    next ? [...current, finding.id] : current.filter((id) => id !== finding.id),
                  )
                }
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="grid w-full grid-cols-[minmax(0,1fr)_24px] items-start gap-4 p-5 text-left hover:bg-elevated/30 lg:grid-cols-[minmax(0,1fr)_250px_24px]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 rounded border border-border bg-elevated px-2 py-0.5 font-mono text-[12px] text-muted-foreground">
                          {finding.id}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-[15px] font-medium leading-snug text-foreground">
                              {finding.title}
                            </h2>
                            <Badge variant="warning">{titleCase(finding.validation_status)}</Badge>
                          </div>
                          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
                            {finding.observation}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2 min-w-0 lg:col-span-1" aria-hidden="true">
                      <FindingMiniChart id={finding.id} data={chartData} />
                    </div>

                    <ChevronDown
                      className={cn(
                        "mt-1 size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="grid gap-5 border-t border-border p-5 lg:grid-cols-[1.25fr_1fr]">
                    <div className="space-y-4">
                      <div>
                        <div className="text-[12px] font-medium text-muted-foreground">
                          Research question
                        </div>
                        <p className="mt-1 text-[13px] leading-relaxed text-foreground">
                          {finding.research_question}
                        </p>
                      </div>
                      <div>
                        <div className="text-[12px] font-medium text-muted-foreground">
                          Observation
                        </div>
                        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                          {finding.observation}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
                          <Lightbulb className="size-3.5" /> Interpretation
                        </div>
                        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                          {finding.interpretation}
                        </p>
                      </div>
                      <div className="rounded-lg border border-warning/20 bg-warning/5 p-3">
                        <div className="flex items-center gap-1.5 text-[12px] font-medium text-warning">
                          <TriangleAlert className="size-3.5" /> Limitations
                        </div>
                        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                          {finding.limitations}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-lg border border-border bg-elevated/50 p-3">
                        <div className="text-[12px] font-medium text-muted-foreground">
                          Supporting evidence
                        </div>
                        <p className="mt-1 text-[13px] leading-relaxed text-foreground">
                          {finding.evidence}
                        </p>
                      </div>
                      <div>
                        <div className="text-[12px] font-medium text-muted-foreground">
                          Related experiments
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {finding.related_experiments.map((id) => (
                            <Link key={id} to={`/experiments/${id}`}>
                              <Badge
                                variant="outline"
                                className="font-mono hover:border-primary/40 hover:text-primary"
                              >
                                <FlaskConical className="size-3" /> {id}
                              </Badge>
                            </Link>
                          ))}
                        </div>
                      </div>
                      {VISUALISATION_LINKS[finding.visualisation] && (
                        <Link
                          to={VISUALISATION_LINKS[finding.visualisation]}
                          className="inline-flex text-[13px] font-medium text-primary underline underline-offset-4"
                        >
                          Open supporting visualisation
                        </Link>
                      )}
                      <SourceNote source={`web/content/findings.json, ${finding.id}`} />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

      <Card className="p-5">
        <div className="text-[14px] font-medium text-foreground">What these findings do not establish</div>
        <p className="mt-2 max-w-[72ch] text-[13px] leading-relaxed text-muted-foreground">
          Findings describe observed behaviour in the current artifacts. They do not establish general
          APT detection performance, causal explanations or mitigation effectiveness. F03 depends on a
          single seed; F05 changes several textual properties at once; F06 includes a retrospective
          threshold that was not independently validated.{" "}
          <Link className="font-medium text-primary underline underline-offset-4" to="/limitations">
            Read all limitations
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
