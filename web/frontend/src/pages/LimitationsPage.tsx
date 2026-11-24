import { useMemo, useState } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { ErrorState, InfoCallout, LoadingBlock, PageHeader, SeverityBadge } from "@/components/features/common";
import { useLimitations } from "@/hooks/queries";
import { cn } from "@/lib/utils";
import { titleCase } from "@/lib/format";

export function LimitationsPage() {
  const { data, isLoading, error, refetch } = useLimitations();
  const [severity, setSeverity] = useState("all");
  const [category, setCategory] = useState("all");

  const categories = useMemo(
    () => Array.from(new Set(data?.limitations.map((item) => item.category) ?? [])).sort(),
    [data],
  );

  if (isLoading) return <LoadingBlock rows={10} />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;

  const filtered = data.limitations.filter((item) => {
    const matchesSeverity = severity === "all" || item.severity === severity;
    const matchesCategory = category === "all" || item.category === category;
    return matchesSeverity && matchesCategory;
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Documentation · Limitations"
        title="Methodological limitations"
        description="Constraints that bound the interpretation of every result in this repository. The dashboard must never imply production-ready APT detection or effective automated mitigation."
        actions={<Badge variant="error">{data.counts.high ?? 0} high severity</Badge>}
      />

      <InfoCallout tone="error" title="Interpretation boundary">
        The current evidence is single-seed, single-scenario, event-level anomaly ranking. Low absolute
        precision, derived contextual labels, retrospective threshold inspection and the absence of
        mitigation evaluation mean the research has not demonstrated deployable APT detection.
      </InfoCallout>

      <div className="grid gap-2 sm:grid-cols-3">
        {(["high", "medium", "low"] as const).map((level) => (
          <Card key={level} className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{level} severity</span>
              <SeverityBadge severity={level} />
            </div>
            <div className="mt-1 font-mono text-xl font-semibold text-foreground">{data.counts[level] ?? 0}</div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <ShieldAlert className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Limitations register</span>
          <div className="ml-auto flex gap-2">
            <Select value={severity} onChange={(event) => setSeverity(event.target.value)} className="w-[140px]" aria-label="Severity filter">
              <option value="all">All severities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
            <Select value={category} onChange={(event) => setCategory(event.target.value)} className="w-[150px]" aria-label="Category filter">
              <option value="all">All categories</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
          </div>
        </div>
        <div className="divide-y divide-border">
          {filtered.map((limitation) => (
            <div key={limitation.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded border", limitation.severity === "high" ? "border-error/20 bg-error/5" : "border-warning/20 bg-warning/5")}>
                  <AlertTriangle className={cn("size-3.5", limitation.severity === "high" ? "text-error" : "text-warning")} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[9px] text-muted-foreground">{limitation.id}</span>
                    <h2 className="text-xs font-semibold text-foreground">{limitation.title}</h2>
                    <SeverityBadge severity={limitation.severity} />
                    <Badge variant="outline">{limitation.category}</Badge>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{limitation.detail}</p>
                  <div className="mt-2 rounded border border-success/15 bg-success/5 px-2.5 py-1.5 text-[10px] leading-relaxed text-muted-foreground">
                    <span className="font-medium text-success">Mitigation / handling: </span>{limitation.mitigation}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="px-4 py-8 text-center text-xs text-muted-foreground">No limitations match the selected filters.</div>}
        </div>
      </Card>

      <Card className="p-4">
        <div className="text-xs font-semibold text-foreground">Research integrity note</div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Negative and ambiguous results are retained. The dashboard does not hide anomalous counts, does
          not convert contextual indicators into ground truth, and does not present retrospective
          thresholds as validated deployment choices. {titleCase("all displayed metrics remain traceable to source artifacts")}.
        </p>
      </Card>
    </div>
  );
}
