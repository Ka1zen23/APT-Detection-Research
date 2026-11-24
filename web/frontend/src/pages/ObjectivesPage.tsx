import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, CircleDashed, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, SectionHeading, StatusBadge, ErrorState, LoadingBlock, InfoCallout } from "@/components/features/common";
import { useObjectives } from "@/hooks/queries";

export function ObjectivesPage() {
  const { data, isLoading, error, refetch } = useObjectives();
  if (isLoading) return <LoadingBlock rows={6} />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Research · Objectives"
        title="Research objectives and implementation state"
        description="The project investigates semantic provenance representations and benign-trained anomaly detection. Objectives are marked by what the repository actually demonstrates, not by what is planned."
        actions={<Badge variant="warning">Preliminary evidence</Badge>}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        {data.objectives.map((objective) => {
          const implemented = objective.status === "implemented";
          const inProgress = objective.status === "in_progress";
          return (
            <Card key={objective.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-elevated">
                  {implemented ? (
                    <CheckCircle2 className="size-4 text-success" />
                  ) : inProgress ? (
                    <Target className="size-4 text-warning" />
                  ) : (
                    <CircleDashed className="size-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">{objective.id}</span>
                    <h2 className="text-sm font-semibold text-foreground">{objective.title}</h2>
                    <StatusBadge status={objective.status === "implemented" ? "completed" : objective.status} />
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {objective.description}
                  </p>
                  <div className="mt-2 rounded border border-border bg-elevated/60 px-2.5 py-2">
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Evidence state</div>
                    <div className="mt-0.5 text-[11px] leading-relaxed text-foreground">{objective.evidence}</div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {objective.experiments.map((id) => (
                      <Link key={id} to={id.startsWith("E") || id.startsWith("B") ? `/experiments/${id}` : "/experiments"}>
                        <Badge variant="outline" className="font-mono hover:border-primary/40 hover:text-primary">
                          {id}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scope boundaries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs leading-relaxed text-muted-foreground">
          <p>
            The current implementation detects anomalous event-level behaviour using reconstruction
            error. It does not attribute an event to a specific APT group, prove malware execution, or
            perform automated mitigation.
          </p>
          <p>
            Objective O4 remains in progress: results exist for one attack scenario and one random seed,
            but no independent scenario validation or multi-seed estimate is available.
          </p>
          <div className="pt-1">
            <InfoCallout tone="warning" title="No production claim">
              A high ROC-AUC does not establish production-ready detection. Precision remains below 3%
              even at the highest measured threshold, and mitigation effectiveness has not been evaluated.
            </InfoCallout>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div>
            <SectionHeading title="Scope changes require approval" description="Substantive methodology changes should be agreed with the supervisor before implementation." className="mb-0" />
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/limitations">
              Review limitations <ArrowRight />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
