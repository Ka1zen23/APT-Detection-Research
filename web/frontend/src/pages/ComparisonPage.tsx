import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDown,
  ArrowUp,
  Check,
  GitCompareArrows,
  Info,
  Layers,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartTooltip,
  CHART_AXIS,
  CHART_COLORS,
  CHART_GRID,
  ConfusionMatrix,
} from "@/components/features/data";
import {
  ErrorState,
  InfoCallout,
  KpiCard,
  LoadingBlock,
  PageHeader,
  SectionHeading,
} from "@/components/features/common";
import { api } from "@/services/api";
import { useDescriptionOverlap, useExperiment, useModelComparison } from "@/hooks/queries";
import { formatDecimal, formatDuration, formatNumber, formatPercent, formatThreshold } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CurvePayload } from "@/types/api";

const DEFAULT_SELECTION = ["E2-D", "E5-C", "B3", "E2-A", "E5-B"];
const MAX_SELECTION = 6;

type SortKey = "average_precision" | "roc_auc" | "recall" | "precision" | "false_positives" | "contextual_recall" | "training_seconds";

function SortButton({
  label,
  active,
  desc,
  onClick,
  align = "right",
}: {
  label: string;
  active: boolean;
  desc: boolean;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-8 items-center gap-1 whitespace-nowrap text-[12px] transition-colors hover:text-foreground",
        active ? "text-foreground" : "text-muted-foreground",
        align === "right" && "ml-auto",
      )}
    >
      {label}
      {active ? desc ? <ArrowDown className="size-2.5" /> : <ArrowUp className="size-2.5" /> : null}
    </button>
  );
}

export function ComparisonPage() {
  const { data, isLoading, error, refetch } = useModelComparison();
  const { data: e2d } = useExperiment("E2-D");
  const { data: overlapData } = useDescriptionOverlap();
  const [selected, setSelected] = useState<string[]>(DEFAULT_SELECTION);
  const [sortKey, setSortKey] = useState<SortKey>("average_precision");
  const [sortDesc, setSortDesc] = useState(true);
  const [operatingId, setOperatingId] = useState("E2-D");

  const curveQueries = useQueries({
    queries: selected.map((id) => ({
      queryKey: ["curves", id, "original"],
      queryFn: () => api.curves(id, "original"),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const models = data?.models ?? [];
  const leader = useMemo(
    () =>
      [...models].sort(
        (a, b) => (b.average_precision ?? -1) - (a.average_precision ?? -1),
      )[0],
    [models],
  );
  const rocLeader = models.reduce<(typeof models)[number] | undefined>((best, model) =>
    model.roc_auc != null && (best?.roc_auc == null || model.roc_auc > best.roc_auc) ? model : best, undefined);
  const selectedModels = useMemo(
    () => models.filter((model) => selected.includes(model.id)),
    [models, selected],
  );
  const sorted = useMemo(() => {
    return [...models].sort((a, b) => {
      const left = (a[sortKey] ?? -1) as number;
      const right = (b[sortKey] ?? -1) as number;
      return sortDesc ? right - left : left - right;
    });
  }, [models, sortKey, sortDesc]);

  if (isLoading) return <LoadingBlock rows={8} />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;

  const toggle = (id: string) => {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= MAX_SELECTION) return current;
      return [...current, id];
    });
  };

  const sort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  const curvePayloads = curveQueries
    .map((query) => query.data)
    .filter((payload): payload is CurvePayload => Boolean(payload));
  const operating = models.find((model) => model.id === operatingId) ?? models[0];
  const apChartData = models
    .filter((model) => model.average_precision !== null)
    .sort((a, b) => (b.average_precision ?? 0) - (a.average_precision ?? 0))
    .map((model) => ({ id: model.id, AP: model.average_precision }));
  const rocChartData = models
    .filter((model) => model.roc_auc !== null)
    .sort((a, b) => (b.roc_auc ?? 0) - (a.roc_auc ?? 0))
    .map((model) => ({ id: model.id, ROC: model.roc_auc }));
  const fpChartData = models
    .filter((model) => model.false_positives !== null)
    .sort((a, b) => (a.false_positives ?? 0) - (b.false_positives ?? 0))
    .map((model) => ({ id: model.id, FP: model.false_positives }));

  const zeroPrecision = models.filter((model) => model.precision === 0);
  const fullRecall = models.filter((model) => model.recall === 1);

  const seen = e2d?.evaluation_summary?.attack_test?.description_overlap as
    | Record<string, Record<string, number | null>>
    | undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        level={2}
        eyebrow="Experiments, Comparison"
        title="Model comparison"
        description="Compare 12 measured configurations. Ranking metrics are threshold-independent; threshold-based metrics use each model's recorded operating point. No curve is fabricated from summary values."
        actions={<Badge variant="outline">{models.length} models</Badge>}
      />

      <InfoCallout tone="info" title="How to read this page">
        ROC-AUC and Average Precision rank across all thresholds. Threshold metrics use each model's
        recorded operating point. The leading AP and the leading ROC-AUC can come from different
        models.{" "}
        <Link className="font-medium text-primary underline underline-offset-4" to="/glossary">
          Glossary
        </Link>
        .
      </InfoCallout>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Leading Average Precision"
          metricId="average-precision"
          value={formatDecimal(leader?.average_precision, 4)}
          detail={<><span className="font-mono text-foreground">{leader?.id}</span>, leading anomaly ranker</>}
          tone="success"
          source="results/autoencoder_comparison/ranking_summary.csv"
        />
        <KpiCard
          label="Leading ROC-AUC"
          metricId="roc-auc"
          value={formatDecimal(rocLeader?.roc_auc, 4)}
          detail={`${rocLeader?.id ?? "n/a"}, threshold-independent ranking`}
          tone="accent"
        />
        <KpiCard
          label="Models with full recall"
          metricId="recall"
          value={String(fullRecall.length)}
          detail="Recovered all originally annotated positives at their recorded operating points"
          tone="warning"
        />
        <KpiCard
          label="Models with zero precision"
          definition="Models whose recorded operating point raises no true positives."
          value={String(zeroPrecision.length)}
          detail={zeroPrecision.map((model) => model.id).join(", ") || "None"}
          tone="error"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select models for comparison</CardTitle>
          <div className="text-xs text-muted-foreground">
            Up to {MAX_SELECTION} models. Selection drives the curves, charts and configuration matrix.
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          {models.map((model) => {
            const active = selected.includes(model.id);
            return (
              <button
                key={model.id}
                type="button"
                onClick={() => toggle(model.id)}
                className={cn(
                  "inline-flex min-h-8 items-center gap-1.5 rounded border px-2 py-1 font-mono text-[12px] transition-colors",
                  active
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-surface text-muted-foreground hover:border-primary/30 hover:text-foreground",
                )}
                title={model.name}
              >
                {active && <Check className="size-2.5" />}
                {model.id}
                <span className="hidden text-[12px] opacity-70 sm:inline">
                  {formatDecimal(model.average_precision, 3)}
                </span>
              </button>
            );
          })}
          <span className="ml-auto self-center text-[12px] text-muted-foreground">
            {selected.length}/{MAX_SELECTION} selected
          </span>
        </CardContent>
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div>
            <div className="text-sm font-semibold text-foreground">Measured model leaderboard</div>
            <div className="text-[12px] text-muted-foreground">Click a column to sort. Click a row to set the confusion-matrix model.</div>
          </div>
          <Badge variant="outline">Attack test, original labels</Badge>
        </div>
        <p className="px-4 pb-2 text-[12px] text-muted-foreground sm:hidden">
          Scroll horizontally to see every column.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-xs">
            <thead>
              <tr className="border-b border-border bg-elevated/40">
                <th className="px-3 py-2 text-left text-[12px] text-muted-foreground">ID</th>
                <th className="px-3 py-2 text-left text-[12px] text-muted-foreground">Model</th>
                <th className="px-3 py-2 text-right">
                  <SortButton label="AP" active={sortKey === "average_precision"} desc={sortDesc} onClick={() => sort("average_precision")} />
                </th>
                <th className="px-3 py-2 text-right">
                  <SortButton label="ROC-AUC" active={sortKey === "roc_auc"} desc={sortDesc} onClick={() => sort("roc_auc")} />
                </th>
                <th className="px-3 py-2 text-right">
                  <SortButton label="Recall" active={sortKey === "recall"} desc={sortDesc} onClick={() => sort("recall")} />
                </th>
                <th className="px-3 py-2 text-right">
                  <SortButton label="Precision" active={sortKey === "precision"} desc={sortDesc} onClick={() => sort("precision")} />
                </th>
                <th className="px-3 py-2 text-right">
                  <SortButton label="FP" active={sortKey === "false_positives"} desc={sortDesc} onClick={() => sort("false_positives")} />
                </th>
                <th className="px-3 py-2 text-right">
                  <SortButton label="Ctx recall" active={sortKey === "contextual_recall"} desc={sortDesc} onClick={() => sort("contextual_recall")} />
                </th>
                <th className="px-3 py-2 text-right">
                  <SortButton label="Train" active={sortKey === "training_seconds"} desc={sortDesc} onClick={() => sort("training_seconds")} />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((model) => (
                <tr
                  key={model.id}
                  className={cn(
                    "cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-elevated/50",
                    operating.id === model.id && "bg-primary/5",
                  )}
                  onClick={() => setOperatingId(model.id)}
                >
                  <td className="px-3 py-2 font-mono text-[12px] text-primary">
                    <Link to={`/experiments/${model.id}`} onClick={(event) => event.stopPropagation()} className="hover:underline">
                      {model.id}
                    </Link>
                  </td>
                  <td className="max-w-[260px] truncate px-3 py-2 text-[13px] text-foreground">{model.name}</td>
                  <td className="px-3 py-2 text-right font-mono text-[12px] tabular text-foreground">{formatDecimal(model.average_precision, 4)}</td>
                  <td className="px-3 py-2 text-right font-mono text-[12px] tabular">{formatDecimal(model.roc_auc, 4)}</td>
                  <td className="px-3 py-2 text-right font-mono text-[12px] tabular">{formatPercent(model.recall, 1)}</td>
                  <td className="px-3 py-2 text-right font-mono text-[12px] tabular">{formatPercent(model.precision, 3)}</td>
                  <td className="px-3 py-2 text-right font-mono text-[12px] tabular">{formatNumber(model.false_positives)}</td>
                  <td className="px-3 py-2 text-right font-mono text-[12px] tabular">{formatPercent(model.contextual_recall, 1)}</td>
                  <td className="px-3 py-2 text-right font-mono text-[12px] tabular text-muted-foreground">{formatDuration(model.training_seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
          B5 uses operation-frequency scoring; E2-T/E2-R are analytical studies and are not trained models, so they are excluded from this ranking. The "best recall group" includes models at different thresholds.
        </div>
      </Card>

      <Tabs defaultValue="ranking">
        <TabsList>
          <TabsTrigger value="ranking">Ranking metrics</TabsTrigger>
          <TabsTrigger value="curves">ROC / PR curves</TabsTrigger>
          <TabsTrigger value="operating">Operating points</TabsTrigger>
          <TabsTrigger value="overlap">Seen / unseen</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="ranking" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Average Precision comparison</CardTitle>
                <div className="text-xs text-muted-foreground">Higher is better. Severe imbalance makes absolute AP small.</div>
              </CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={apChartData} layout="vertical" margin={{ left: 6, right: 12, top: 2, bottom: 2 }}>
                    <CartesianGrid {...CHART_GRID} horizontal={false} />
                    <XAxis type="number" {...CHART_AXIS} tickFormatter={(value) => Number(value).toFixed(3)} />
                    <YAxis type="category" dataKey="id" width={46} {...CHART_AXIS} />
                    <Tooltip content={<ChartTooltip formatter={(value) => Number(value).toFixed(6)} />} />
                    <Bar dataKey="AP" radius={[0, 2, 2, 0]}>
                      {apChartData.map((item, index) => (
                        <Cell key={item.id} fill={item.id === "E2-D" ? "var(--success)" : CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>ROC-AUC comparison</CardTitle>
                <div className="text-xs text-muted-foreground">Threshold-independent ranking quality; not a precision claim.</div>
              </CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rocChartData} layout="vertical" margin={{ left: 6, right: 12, top: 2, bottom: 2 }}>
                    <CartesianGrid {...CHART_GRID} horizontal={false} />
                    <XAxis type="number" domain={[0.5, 1]} {...CHART_AXIS} tickFormatter={(value) => Number(value).toFixed(2)} />
                    <YAxis type="category" dataKey="id" width={46} {...CHART_AXIS} />
                    <Tooltip content={<ChartTooltip formatter={(value) => Number(value).toFixed(6)} />} />
                    <Bar dataKey="ROC" radius={[0, 2, 2, 0]}>
                      {rocChartData.map((item, index) => (
                        <Cell key={item.id} fill={item.id === "E2-D" ? "var(--success)" : CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>False-positive volume at recorded thresholds</CardTitle>
                <div className="text-xs text-muted-foreground">Log scale. Attack test has 100,892 events including 70 original positives.</div>
              </CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fpChartData} layout="vertical" margin={{ left: 6, right: 12, top: 2, bottom: 2 }}>
                    <CartesianGrid {...CHART_GRID} horizontal={false} />
                    <XAxis type="number" scale="log" domain={[1, "auto"]} {...CHART_AXIS} tickFormatter={(value) => Number(value).toLocaleString()} />
                    <YAxis type="category" dataKey="id" width={46} {...CHART_AXIS} />
                    <Tooltip content={<ChartTooltip formatter={(value) => Number(value).toLocaleString()} />} />
                    <Bar dataKey="FP" fill="var(--error)" radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Contextual recall comparison</CardTitle>
                <div className="text-xs text-muted-foreground">Derived connected-node indicators, not independent ground truth.</div>
              </CardHeader>
              <CardContent className="space-y-2 pt-3">
                {models
                  .filter((model) => model.contextual_recall !== null)
                  .sort((a, b) => (b.contextual_recall ?? 0) - (a.contextual_recall ?? 0))
                  .map((model) => (
                    <div key={model.id} className="flex items-center gap-2">
                      <span className="w-12 font-mono text-[12px] text-muted-foreground">{model.id}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded bg-elevated">
                        <div className="h-full bg-primary" style={{ width: `${(model.contextual_recall ?? 0) * 100}%` }} />
                      </div>
                      <span className="w-12 text-right font-mono text-[12px] text-foreground">{formatPercent(model.contextual_recall, 1)}</span>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="curves" className="space-y-4">
          <InfoCallout tone="info" title="Curves are computed from stored per-event scores">
            Each curve is derived from the attack-test prediction Parquet and downsampled for display. AUC and AP in the API are recomputed from raw scores. The charts show only saved sample points; intermediate values are not estimated.
          </InfoCallout>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>ROC curves, original labels</CardTitle>
              </CardHeader>
              <CardContent className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                   <ScatterChart margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                    <CartesianGrid {...CHART_GRID} />
                    <XAxis type="number" dataKey="x" domain={[0, 1]} {...CHART_AXIS} tickFormatter={(value) => Number(value).toFixed(1)} label={{ value: "False positive rate", position: "insideBottom", offset: -2, fontSize: 9, fill: "var(--muted-foreground)" }} />
                     <YAxis type="number" dataKey="y" name="True positive rate" domain={[0, 1]} {...CHART_AXIS} tickFormatter={(value) => Number(value).toFixed(1)} />
                     <Tooltip formatter={(value) => typeof value === "number" ? value.toFixed(3) : value} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                     {selected.map((id, index) => {
                       const points = curvePayloads.find((payload) => payload.experiment_id === id && payload.available)?.roc;
                       return points?.length ? <Scatter key={id} name={id} data={points} fill={CHART_COLORS[index % CHART_COLORS.length]} shape="circle" isAnimationActive={false} /> : null;
                     })}
                   </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Precision-recall curves, original labels</CardTitle>
              </CardHeader>
              <CardContent className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                   <ScatterChart margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                    <CartesianGrid {...CHART_GRID} />
                    <XAxis type="number" dataKey="x" domain={[0, 1]} {...CHART_AXIS} tickFormatter={(value) => Number(value).toFixed(1)} label={{ value: "Recall", position: "insideBottom", offset: -2, fontSize: 9, fill: "var(--muted-foreground)" }} />
                     <YAxis type="number" dataKey="y" name="Precision" domain={[0, 1]} {...CHART_AXIS} tickFormatter={(value) => Number(value).toFixed(2)} />
                     <Tooltip formatter={(value) => typeof value === "number" ? value.toFixed(4) : value} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                     {selected.map((id, index) => {
                       const points = curvePayloads.find((payload) => payload.experiment_id === id && payload.available)?.pr;
                       return points?.length ? <Scatter key={id} name={id} data={points} fill={CHART_COLORS[index % CHART_COLORS.length]} shape="circle" isAnimationActive={false} /> : null;
                     })}
                   </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {curvePayloads.map((payload) => (
              <div key={payload.experiment_id} className="rounded border border-border px-3 py-2 text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-foreground">{payload.experiment_id}</span>
                  <Badge variant="outline">{payload.label}</Badge>
                </div>
                <div className="mt-1 flex justify-between text-muted-foreground">
                  <span>Computed ROC-AUC</span>
                  <span className="font-mono text-foreground">{formatDecimal(payload.computed_roc_auc, 4)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Computed AP</span>
                  <span className="font-mono text-foreground">{formatDecimal(payload.computed_average_precision, 4)}</span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="operating" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Operating point: {operating.id}</CardTitle>
              <div className="text-xs text-muted-foreground">
                Click a leaderboard row to change the model. Counts are measured at the recorded threshold.
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <ConfusionMatrix
                tp={operating.true_positives}
                fp={operating.false_positives}
                fn={operating.false_negatives}
                tn={operating.true_negatives}
              />
              <div className="grid grid-cols-2 gap-2 text-[12px]">
                {[
                  ["Threshold", formatThreshold(operating.threshold)],
                  ["Operating point", operating.operating_point ?? "n/a"],
                  ["Precision", formatPercent(operating.precision, 3)],
                  ["Recall", formatPercent(operating.recall, 2)],
                  ["F1", formatPercent(operating.f1, 3)],
                  ["Attack FPR", formatPercent(operating.attack_fpr, 3)],
                  ["Benign FPR", formatPercent(operating.benign_fpr, 3)],
                  ["Contextual recall", formatPercent(operating.contextual_recall, 2)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded border border-border px-2 py-1.5">
                    <div className="text-muted-foreground">{label}</div>
                    <div className="font-mono text-foreground">{value}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Seen versus unseen descriptions (E2-D)</CardTitle>
                <div className="text-xs text-muted-foreground">
                  An E2-D diagnostic: 80,100 attack-test descriptions were seen in training, 20,792 were unseen.
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                {seen ? (
                  (["seen", "unseen"] as const).map((key) => {
                    const item = seen[key];
                    return (
                      <div key={key} className="rounded border border-border p-2.5">
                        <div className="text-[12px] text-muted-foreground">{key}</div>
                        <div className="mt-1 space-y-1 text-[12px]">
                          <div className="flex justify-between"><span className="text-muted-foreground">Records</span><span className="font-mono text-foreground">{formatNumber(item?.records ?? null)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Positives</span><span className="font-mono text-foreground">{formatNumber(item?.positives ?? null)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Recall</span><span className="font-mono text-foreground">{formatPercent(item?.recall ?? null, 1)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">FPR</span><span className="font-mono text-foreground">{formatPercent(item?.fpr ?? null, 1)}</span></div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-2 text-xs text-muted-foreground">No seen/unseen diagnostic available.</div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Interpretation guardrails</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-[13px] leading-relaxed text-muted-foreground">
                <p><TrendingUp className="mr-1 inline size-3 text-success" /> E2-D leads on AP (0.1091) and ROC-AUC (0.9956), but precision is still 0.805% at P99.</p>
                <p><Layers className="mr-1 inline size-3 text-primary" /> E5-C has higher AP than E5-B but is worse on benign FPR, attack FPR, precision and F1 at P99.</p>
                <p><Info className="mr-1 inline size-3 text-warning" /> Recall values at different thresholds are not directly comparable without checking the operating point.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="overlap" className="space-y-4">
          <InfoCallout tone="info" title="Exact-description overlap diagnostic">
            Attack-test descriptions are split by whether the exact text appeared in the benign training set.
            This is not a generalisation test: an unseen description can still be semantically similar to a
            seen description. Subgroups with zero positives have no defined recall.
          </InfoCallout>
          <Card>
            <CardHeader>
              <CardTitle>Seen versus unseen attack-test performance</CardTitle>
              <div className="text-xs text-muted-foreground">
                Available for E2 and E5 runs whose evaluation summaries recorded the subgroup split.
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[980px] text-xs">
                <thead>
                  <tr className="border-b border-border bg-elevated/40">
                    {["Model", "Subgroup", "Records", "Positives", "Alerts", "Precision", "Recall", "FPR", "ROC-AUC", "AP"].map((header) => (
                      <th key={header} className="px-2.5 py-2 text-right text-[12px] text-muted-foreground first:text-left">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(overlapData?.models ?? []).flatMap((model) =>
                    (["seen", "unseen"] as const).map((key) => {
                      const item = model[key];
                      return (
                        <tr key={`${model.id}-${key}`} className="border-b border-border last:border-0">
                          <td className="px-2.5 py-2 font-mono text-[12px] text-primary">
                            <Link to={`/experiments/${model.id}`} className="hover:underline">{model.id}</Link>
                          </td>
                          <td className="px-2.5 py-2 text-right text-[12px] text-muted-foreground">{key}</td>
                          <td className="px-2.5 py-2 text-right font-mono text-[12px]">{formatNumber(item.records)}</td>
                          <td className="px-2.5 py-2 text-right font-mono text-[12px]">{formatNumber(item.positives)}</td>
                          <td className="px-2.5 py-2 text-right font-mono text-[12px]">{formatNumber(item.alerts)}</td>
                          <td className="px-2.5 py-2 text-right font-mono text-[12px]">{formatPercent(item.precision, 3)}</td>
                          <td className="px-2.5 py-2 text-right font-mono text-[12px]">{formatPercent(item.recall, 2)}</td>
                          <td className="px-2.5 py-2 text-right font-mono text-[12px]">{formatPercent(item.false_positive_rate, 2)}</td>
                          <td className="px-2.5 py-2 text-right font-mono text-[12px]">{formatDecimal(item.roc_auc, 4)}</td>
                          <td className="px-2.5 py-2 text-right font-mono text-[12px]">{formatDecimal(item.average_precision, 4)}</td>
                        </tr>
                      );
                    }),
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <div className="text-[12px] leading-relaxed text-muted-foreground">
            {overlapData?.note}
          </div>
          <div className="flex flex-wrap gap-2">
            {(overlapData?.source_artifacts ?? []).map((source) => (
              <Badge key={source} variant="outline" className="font-mono text-[12px]">{source}</Badge>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="configuration">
          <Card>
            <CardHeader>
              <CardTitle>Selected configuration matrix</CardTitle>
              <div className="text-xs text-muted-foreground">
                Only the selected models are shown. Configuration is merged from the registry and measured run summaries.
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-xs">
                <thead>
                  <tr className="border-b border-border">
                    {["ID", "Representation", "Encoder", "Algorithm", "Threshold", "Operating point", "Seed"].map((header) => (
                      <th key={header} className="px-2 py-2 text-left text-[12px] text-muted-foreground">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedModels.map((model) => (
                    <tr key={model.id} className="border-b border-border last:border-0">
                      <td className="px-2 py-2 font-mono text-[12px] text-primary">{model.id}</td>
                      <td className="max-w-[220px] px-2 py-2 text-[12px] text-muted-foreground">{model.representation}</td>
                      <td className="max-w-[180px] px-2 py-2 text-[12px] text-muted-foreground">{model.encoder}</td>
                      <td className="max-w-[180px] px-2 py-2 text-[12px] text-muted-foreground">{model.algorithm}</td>
                      <td className="px-2 py-2 font-mono text-[12px] text-foreground">{formatThreshold(model.threshold)}</td>
                      <td className="px-2 py-2 text-[12px] text-muted-foreground">{model.operating_point}</td>
                      <td className="px-2 py-2 font-mono text-[12px]">{model.seed ?? "n/a"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="p-3">
        <SectionHeading
          title="Curve data provenance"
          description="AUC/AP are recomputed from the stored attack-test scores. Selection is limited to six models to keep the comparison legible."
          className="mb-0"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {curvePayloads.map((payload) => (
            <Badge key={payload.experiment_id} variant="outline" className="font-mono text-[12px]">
              {payload.experiment_id}: {payload.source}
            </Badge>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/thresholds"><GitCompareArrows /> Threshold analysis</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/alerts">Alert prioritisation</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
