import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, CircleDashed, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { ErrorState, InfoCallout, LoadingBlock, PageHeader, SourceNote, StatusBadge } from "@/components/features/common";
import { useRoadmap } from "@/hooks/queries";
import { cn } from "@/lib/utils";

export function RoadmapPage() {
  const { data, isLoading, error, refetch } = useRoadmap();
  const [collapsed, setCollapsed] = useState<string[]>([]);

  const grouped = useMemo(() => {
    if (!data) return [];
    const phases = Array.from(new Set(data.milestones.map((milestone) => milestone.phase)));
    return phases.map((phase) => ({
      phase,
      milestones: data.milestones.filter((milestone) => milestone.phase === phase),
    }));
  }, [data]);

  if (isLoading) return <LoadingBlock rows={10} />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;

  const completed = data.counts.completed ?? 0;
  const inProgress = data.counts.in_progress ?? 0;
  const next = data.counts.next ?? 0;
  const planned = data.counts.planned ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Documentation · Roadmap"
        title="Research roadmap"
        description="Milestones, dependencies and evidence status. Completion reflects implemented research work, not dissertation completion. Status is maintained in web/content/roadmap.json."
        actions={<Badge variant="outline">{completed}/{data.total} completed</Badge>}
      />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-3.5"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Completed</div><div className="mt-1 font-mono text-xl font-semibold text-success">{completed}</div></Card>
        <Card className="p-3.5"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">In progress</div><div className="mt-1 font-mono text-xl font-semibold text-primary">{inProgress}</div></Card>
        <Card className="p-3.5"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Next</div><div className="mt-1 font-mono text-xl font-semibold text-warning">{next}</div></Card>
        <Card className="p-3.5"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Planned</div><div className="mt-1 font-mono text-xl font-semibold text-muted-foreground">{planned}</div></Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Implementation progress only</div>
            <div className="mt-1 text-sm font-semibold text-foreground">{completed} of {data.total} roadmap activities completed</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">No dissertation completion percentage is estimated.</div>
          </div>
          <div className="w-full md:w-64">
            <div className="mb-1 flex justify-between font-mono text-[9px] text-muted-foreground"><span>Activity progress</span><span>{Math.round((completed / data.total) * 100)}%</span></div>
            <Progress value={(completed / data.total) * 100} />
          </div>
        </div>
      </Card>

      {data.next_milestone && (
        <Card className="border-warning/30 bg-warning/5 p-4">
          <div className="flex items-start gap-3">
            <Target className="mt-0.5 size-5 text-warning" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">{data.next_milestone.id}</span>
                <h2 className="text-sm font-semibold text-foreground">{data.next_milestone.title}</h2>
                <Badge variant="warning">Next research activity</Badge>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{data.next_milestone.description}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {data.next_milestone.dependencies.map((dependency) => <Badge key={dependency} variant="outline" className="font-mono">{dependency}</Badge>)}
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {grouped.map((group) => (
          <div key={group.phase}>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.phase}</h2>
              <Badge variant="outline">{group.milestones.length}</Badge>
            </div>
            <div className="space-y-2">
              {group.milestones.map((milestone) => {
                const isCollapsed = collapsed.includes(milestone.id);
                return (
                  <Card key={milestone.id} className={cn("overflow-hidden", milestone.status === "next" && "border-warning/40")}>
                    <button
                      type="button"
                      onClick={() => setCollapsed((current) => current.includes(milestone.id) ? current.filter((id) => id !== milestone.id) : [...current, milestone.id])}
                      className="flex w-full items-start gap-3 p-3 text-left hover:bg-elevated/50"
                    >
                      {milestone.status === "completed" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : milestone.status === "next" ? <Target className="mt-0.5 size-4 shrink-0 text-warning" /> : milestone.status === "in_progress" ? <CircleDashed className="mt-0.5 size-4 shrink-0 text-primary" /> : <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[9px] text-muted-foreground">{milestone.id}</span>
                          <span className="text-xs font-medium text-foreground">{milestone.title}</span>
                          <StatusBadge status={milestone.status} />
                        </div>
                        <p className={cn("mt-0.5 text-[10px] leading-relaxed text-muted-foreground", !isCollapsed && "line-clamp-1")}>{milestone.description}</p>
                      </div>
                      <ChevronDown className={cn("mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform", !isCollapsed && "rotate-180")} />
                    </button>
                    {!isCollapsed && (
                      <div className="grid gap-4 border-t border-border p-3 md:grid-cols-2">
                        <div>
                          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Dependencies</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {milestone.dependencies.length ? milestone.dependencies.map((dependency) => <Badge key={dependency} variant="outline" className="font-mono">{dependency}</Badge>) : <span className="text-[10px] text-muted-foreground">None</span>}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Evidence</div>
                          <div className="mt-1 space-y-1">
                            {milestone.evidence.length ? milestone.evidence.map((evidence) => <SourceNote key={evidence} source={evidence} />) : <span className="text-[10px] text-muted-foreground">No artifact yet</span>}
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <InfoCallout tone="info" title="Status policy">
        An experiment is not marked completed merely because a script exists. Completion requires a measured artifact or documented analytical result. E7, B6, E1, E3, E4, E6, independent validation, M1 and dissertation work remain planned or in progress.
      </InfoCallout>
      <SourceNote source="web/content/roadmap.json · editable structured configuration" />
    </div>
  );
}
