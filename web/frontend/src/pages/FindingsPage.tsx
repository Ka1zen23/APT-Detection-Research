import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, FlaskConical, Lightbulb, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/misc";
import { ErrorState, LoadingBlock, PageHeader, SourceNote } from "@/components/features/common";
import { useFindings } from "@/hooks/queries";
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
  const [open, setOpen] = useState<string[]>(["F01", "F02", "F03", "F04", "F05", "F06"]);

  if (isLoading) return <LoadingBlock rows={8} />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Documentation · Findings"
        title="Research findings"
        description="Six preliminary findings grounded in measured artifacts. These are experimental observations, not universally established conclusions or deployment claims."
        actions={<Badge variant="warning">All preliminary</Badge>}
      />

      <div className="grid gap-2 sm:grid-cols-3">
        <Card className="p-3.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Findings</div>
          <div className="mt-1 font-mono text-xl font-semibold text-foreground">{data.count}</div>
          <div className="text-[10px] text-muted-foreground">F01–F06, all preliminary</div>
        </Card>
        <Card className="p-3.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Evidence base</div>
          <div className="mt-1 text-sm font-semibold text-foreground">12 measured models</div>
          <div className="text-[10px] text-muted-foreground">Single seed, one attack scenario</div>
        </Card>
        <Card className="p-3.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Validation state</div>
          <div className="mt-1 text-sm font-semibold text-warning">Independent validation pending</div>
          <div className="text-[10px] text-muted-foreground">E7 and IV-1 are required before stronger claims</div>
        </Card>
      </div>

      <div className="space-y-3">
        {data.findings.map((finding) => {
          const isOpen = open.includes(finding.id);
          return (
            <Card key={finding.id} className="overflow-hidden">
              <Collapsible open={isOpen} onOpenChange={(next) => setOpen((current) => next ? [...current, finding.id] : current.filter((id) => id !== finding.id))}>
                <CollapsibleTrigger asChild>
                  <button type="button" className="flex w-full items-start gap-3 p-4 text-left hover:bg-elevated/40">
                    <span className="mt-0.5 rounded border border-border bg-elevated px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">{finding.id}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold text-foreground">{finding.title}</h2>
                        <Badge variant="warning">{titleCase(finding.validation_status)}</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{finding.observation}</p>
                    </div>
                    <ChevronDown className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid gap-4 border-t border-border p-4 lg:grid-cols-[1.3fr_1fr]">
                    <div className="space-y-3">
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Research question</div>
                        <p className="mt-1 text-xs leading-relaxed text-foreground">{finding.research_question}</p>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Observation</div>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{finding.observation}</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground"><Lightbulb className="size-3" /> Interpretation</div>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{finding.interpretation}</p>
                      </div>
                      <div className="rounded border border-warning/20 bg-warning/5 p-2.5">
                        <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-warning"><TriangleAlert className="size-3" /> Limitations</div>
                        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{finding.limitations}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="rounded border border-border bg-elevated/40 p-2.5">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Supporting evidence</div>
                        <p className="mt-1 text-[10px] leading-relaxed text-foreground">{finding.evidence}</p>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Related experiments</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {finding.related_experiments.map((id) => (
                            <Link key={id} to={`/experiments/${id}`}>
                              <Badge variant="outline" className="font-mono hover:border-primary/40 hover:text-primary"><FlaskConical className="size-2.5" /> {id}</Badge>
                            </Link>
                          ))}
                        </div>
                      </div>
                      {VISUALISATION_LINKS[finding.visualisation] && (
                        <Link to={VISUALISATION_LINKS[finding.visualisation]} className="inline-flex text-[10px] text-primary hover:underline">
                          Open supporting visualisation →
                        </Link>
                      )}
                      <SourceNote source={`web/content/findings.json · ${finding.id}`} />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

      <Card className="p-4">
        <div className="text-xs font-semibold text-foreground">How to read these findings</div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Findings describe observed behaviour in the current artifacts. They do not establish general
          APT detection performance, causal explanations or mitigation effectiveness. F03 depends on a
          single seed; F05 changes several textual properties at once; F06 includes a retrospective
          threshold that was not independently validated.
        </p>
      </Card>
    </div>
  );
}
