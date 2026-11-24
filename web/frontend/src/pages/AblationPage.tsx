import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, Boxes, GitBranch, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartTooltip, CHART_AXIS, CHART_GRID } from "@/components/features/data";
import {
  ErrorState,
  InfoCallout,
  KpiCard,
  LoadingBlock,
  PageHeader,
  SectionHeading,
  SourceNote,
} from "@/components/features/common";
import { useAblation } from "@/hooks/queries";
import { formatDecimal, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

const REPRESENTATION_NOTES: Record<string, { summary: string; icon: typeof Layers }> = {
  "E5-A": {
    summary: "Only the sequence of operation names. No entity attributes or graph relationships.",
    icon: Layers,
  },
  "E5-B": {
    summary: "Operation names plus process and artifact attributes. No explicit directed relationships.",
    icon: Boxes,
  },
  "E5-C": {
    summary: "Operations, entity attributes and explicit directed relationships between nodes.",
    icon: GitBranch,
  },
};

export function AblationPage() {
  const { data, isLoading, error, refetch } = useAblation();
  const [representation, setRepresentation] = useState("E5-C");

  const stats = useMemo(() => {
    if (!data) return [];
    const wanted = [
      ["operation_only", "E5-A"],
      ["operation_entities", "E5-B"],
      ["full_provenance", "E5-C"],
    ];
    return wanted.map(([variant, id]) => {
      const train = data.statistics.find((row) => row.variant === variant && row.split === "train");
      const attack = data.statistics.find((row) => row.variant === variant && row.split === "attack_test");
      return {
        id,
        uniqueTrain: train?.unique_descriptions ?? 0,
        uniqueAttack: attack?.unique_descriptions ?? 0,
        positivesSeen: attack?.original_positives_seen ?? 0,
        meanTokens: train?.mean_tokens ?? 0,
        maxTokens: train?.maximum_tokens ?? 0,
        truncation: attack?.over_token_limit ?? 0,
        conflict: data.conflicts[variant]?.original.conflicting_positives ?? 0,
        conflictingRecords: data.conflicts[variant]?.original.conflicting_records ?? 0,
      };
    });
  }, [data]);

  if (isLoading) return <LoadingBlock rows={8} />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;

  const byId = Object.fromEntries(data.models.map((model) => [model.id, model]));
  const selectedExample = data.examples.representations.find((item) => item.id === representation);
  const apChart = data.models
    .filter((model) => model.average_precision !== null)
    .map((model) => ({ id: model.id, AP: model.average_precision, ROC: model.roc_auc }));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Experiments · Provenance ablation"
        title="What does provenance context contribute?"
        description="The E5 family holds the detector and encoder constant while changing how an event is verbalised: operations only, operations with entities, or full directed provenance."
        actions={<Badge variant="warning">Preliminary ablation</Badge>}
      />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="E5-C Average Precision"
          value={formatDecimal(byId["E5-C"]?.average_precision, 4)}
          detail="Full provenance · best E5 result"
          tone="success"
          source="results/ablation_comparison/ablation_comparison.csv"
        />
        <KpiCard
          label="AP uplift over E5-B"
          value={data.derived.e5c_over_e5b_ap_uplift_percent ? `+${data.derived.e5c_over_e5b_ap_uplift_percent.toFixed(1)}%` : "—"}
          detail="Derived from measured AP values"
          tone="accent"
        />
        <KpiCard
          label="Operation-only conflicting negatives"
          value={formatNumber(data.derived.operation_only_conflicting_negative_events)}
          detail="Share one description with all 70 positives"
          tone="error"
        />
        <KpiCard
          label="Original positives seen in training"
          value="E5-A 70 · E5-B 0 · E5-C 0"
          detail="Exact-description overlap with training"
          tone="warning"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {Object.entries(REPRESENTATION_NOTES).map(([id, note]) => {
          const Icon = note.icon;
          const model = byId[id];
          return (
            <Card key={id} className={cn("p-4", representation === id && "border-primary/40")}>
              <div className="flex items-center gap-2">
                <Icon className="size-4 text-primary" />
                <span className="font-mono text-[11px] font-medium text-foreground">{id}</span>
                <Badge variant="outline" className="ml-auto">{id === "E5-A" ? "Operation only" : id === "E5-B" ? "Operations + entities" : "Full provenance"}</Badge>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{note.summary}</p>
              <div className="mt-3 grid grid-cols-2 gap-1.5 text-[10px]">
                <div className="rounded border border-border px-2 py-1.5"><span className="text-muted-foreground">AP</span><div className="font-mono text-foreground">{formatDecimal(model?.average_precision, 4)}</div></div>
                <div className="rounded border border-border px-2 py-1.5"><span className="text-muted-foreground">ROC-AUC</span><div className="font-mono text-foreground">{formatDecimal(model?.roc_auc, 4)}</div></div>
              </div>
              <button type="button" onClick={() => setRepresentation(id)} className="mt-3 inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
                Compare verbalisations <ArrowRight className="size-3" />
              </button>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Same event, three representations</CardTitle>
          <div className="text-xs text-muted-foreground">
            Event {data.examples.event_id} ({data.examples.phase}). Descriptions are taken directly from the ablation preprocessing log.
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {data.examples.representations.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setRepresentation(item.id)}
                className={cn(
                  "rounded border px-2.5 py-1 font-mono text-[10px] transition-colors",
                  representation === item.id ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {item.id} · {item.label}
              </button>
            ))}
          </div>
          {selectedExample && (
            <div className="mt-3 grid gap-3 lg:grid-cols-[1.5fr_1fr]">
              <div className="rounded-md border border-border bg-elevated/40 p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-medium text-foreground">{selectedExample.label}</span>
                  <Badge variant="outline">{selectedExample.description.length} chars</Badge>
                </div>
                <p className="break-words font-mono text-[10px] leading-relaxed text-muted-foreground">{selectedExample.description}</p>
              </div>
              <div className="space-y-2">
                <div className="rounded border border-success/20 bg-success/5 p-2.5">
                  <div className="text-[9px] uppercase tracking-wider text-success">Contains</div>
                  <ul className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
                    {selectedExample.contains.map((item) => <li key={item}>+ {item}</li>)}
                  </ul>
                </div>
                <div className="rounded border border-border bg-elevated/50 p-2.5">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Omits</div>
                  <ul className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
                    {selectedExample.omits.length ? selectedExample.omits.map((item) => <li key={item}>− {item}</li>) : <li>Nothing in this representation</li>}
                  </ul>
                </div>
              </div>
            </div>
          )}
          <SourceNote source={data.examples.source} className="mt-2" />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Representation statistics</CardTitle>
            <div className="text-xs text-muted-foreground">Training and attack-test description diversity, measured before encoding.</div>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[620px] text-xs">
              <thead>
                <tr className="border-b border-border bg-elevated/40">
                  {["Model", "Unique train", "Unique attack", "Positives seen", "Conflicting records", "Mean tokens", "Max tokens", "Attack >256"].map((header) => (
                    <th key={header} className="px-2.5 py-2 text-right text-[9px] uppercase tracking-wider text-muted-foreground first:text-left">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="px-2.5 py-2 font-mono text-[10px] text-foreground">{row.id}</td>
                    <td className="px-2.5 py-2 text-right font-mono text-[10px]">{formatNumber(row.uniqueTrain)}</td>
                    <td className="px-2.5 py-2 text-right font-mono text-[10px]">{formatNumber(row.uniqueAttack)}</td>
                    <td className="px-2.5 py-2 text-right font-mono text-[10px]">{row.positivesSeen}</td>
                    <td className={cn("px-2.5 py-2 text-right font-mono text-[10px]", row.conflictingRecords > 0 && "text-error")}>{formatNumber(row.conflictingRecords)}</td>
                    <td className="px-2.5 py-2 text-right font-mono text-[10px]">{row.meanTokens.toFixed(1)}</td>
                    <td className="px-2.5 py-2 text-right font-mono text-[10px]">{row.maxTokens}</td>
                    <td className="px-2.5 py-2 text-right font-mono text-[10px]">{row.truncation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Detection results</CardTitle>
            <div className="text-xs text-muted-foreground">At each model's P99 validation threshold, original labels.</div>
          </CardHeader>
          <CardContent className="space-y-2">
            {["B5", "E5-A", "E5-B", "E5-C"].map((id) => {
              const model = byId[id];
              return (
                <div key={id} className="rounded border border-border px-2.5 py-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-foreground">{id}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{formatDecimal(model?.average_precision, 4)} AP</span>
                  </div>
                  <div className="mt-1 flex gap-3 text-[9px] text-muted-foreground">
                    <span>ROC {formatDecimal(model?.roc_auc, 3)}</span>
                    <span>Recall {formatPercent(model?.recall, 1)}</span>
                    <span>FP {formatNumber(model?.false_positives)}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Average Precision by representation</CardTitle>
            <div className="text-xs text-muted-foreground">B5 is the operation-frequency baseline; E5-A is the operation-only autoencoder.</div>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={apChart} layout="vertical" margin={{ left: 4, right: 12, top: 2, bottom: 2 }}>
                <CartesianGrid {...CHART_GRID} horizontal={false} />
                <XAxis type="number" {...CHART_AXIS} tickFormatter={(value) => Number(value).toFixed(3)} />
                <YAxis type="category" dataKey="id" width={48} {...CHART_AXIS} />
                <Tooltip content={<ChartTooltip formatter={(value) => Number(value).toFixed(6)} />} />
                <Bar dataKey="AP" radius={[0, 2, 2, 0]}>
                  {apChart.map((item) => (
                    <Cell key={item.id} fill={item.id === "E5-C" ? "var(--success)" : item.id === "E5-A" || item.id === "B5" ? "var(--error)" : "var(--primary)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <div className="space-y-3">
          <InfoCallout tone="warning" title="Full provenance is not better on every metric">
            At P99, E5-C has a slightly higher benign FPR (1.049% vs 1.007%), attack FPR (11.14% vs 11.01%), and lower precision (0.619% vs 0.627%) and F1 (1.231% vs 1.246%) than E5-B. Its advantage is in ranking (AP/ROC-AUC), not uniformly across threshold metrics.
          </InfoCallout>
          <InfoCallout tone="info" title="What the ablation cannot isolate">
            The three representations also differ in text length, ordering and formatting. The experiment measures overall representation differences, not the isolated causal effect of adding graph edges.
          </InfoCallout>
          <div className="rounded-md border border-border p-3 text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Finding F05:</span> Full provenance achieves better observed AP than operation-only and entity-based representations in this controlled E5 experiment. This remains preliminary and single-seed.
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conflict analysis</CardTitle>
          <div className="text-xs text-muted-foreground">An exact-description conflict exists when the same text has both positive and negative labels.</div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {Object.entries(data.conflicts).map(([variant, conflict]) => (
            <div key={variant} className="rounded border border-border p-3">
              <div className="font-mono text-[10px] text-foreground">{variant}</div>
              <div className="mt-1.5 space-y-1 text-[10px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Conflicting descriptions</span><span className="font-mono">{conflict.original.conflicting_descriptions}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Conflicting records</span><span className="font-mono">{formatNumber(conflict.original.conflicting_records)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Conflicting positives</span><span className={cn("font-mono", conflict.original.conflicting_positives > 0 && "text-error")}>{conflict.original.conflicting_positives}</span></div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="p-3">
        <SectionHeading title="Source artifacts" description="Every value on this page is loaded from the listed files." className="mb-2" />
        <div className="flex flex-wrap gap-2">
          {data.source_artifacts.map((source) => <SourceNote key={source} source={source} />)}
        </div>
      </Card>
    </div>
  );
}
