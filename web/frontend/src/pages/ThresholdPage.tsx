import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { ConfusionMatrix, ChartTooltip, CHART_AXIS, CHART_GRID } from "@/components/features/data";
import {
  ErrorState,
  InfoCallout,
  KpiCard,
  LoadingBlock,
  PageHeader,
  SourceNote,
} from "@/components/features/common";
import { useThresholds } from "@/hooks/queries";
import { formatNumber, formatPercent, formatThreshold } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ThresholdRow } from "@/types/api";

const EXPERIMENTS = ["E2-A", "E2-B", "E2-C", "E2-D"];

function percentileLabel(percentile: number) {
  return percentile === 100 ? "P100" : `P${percentile}`;
}

export function ThresholdPage() {
  const [experimentId, setExperimentId] = useState("E2-D");
  const [selectedPercentile, setSelectedPercentile] = useState(99);
  const { data, isLoading, error, refetch } = useThresholds(experimentId);

  const selected: ThresholdRow | undefined = useMemo(
    () => data?.rows?.find((row) => row.percentile === selectedPercentile),
    [data, selectedPercentile],
  );

  if (isLoading) return <LoadingBlock rows={8} />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data) return <div className="text-sm text-muted-foreground">No threshold data available.</div>;

  const rows = data.rows ?? [];
  const p99 = rows.find((row) => row.percentile === 99);
  const p9995 = rows.find((row) => row.percentile === 99.95);
  const chartData = rows.map((row) => ({
    percentile: percentileLabel(row.percentile),
    false_positives: row.false_positives,
    contextual_recall: row.contextual_recall * 100,
    precision: row.precision * 100,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Experiments, Threshold sensitivity"
        title="Validation-derived threshold analysis"
        description="Explore the measured percentile sweep for the autoencoder variants. Thresholds are derived from benign validation reconstruction errors, never from attack-test labels."
        actions={
          <div className="flex items-center gap-2">
            <Select value={experimentId} onChange={(event) => { setExperimentId(event.target.value); setSelectedPercentile(99); }} className="w-[130px]" aria-label="Experiment">
              {EXPERIMENTS.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </Select>
            <Badge variant="warning">P99 primary</Badge>
          </div>
        }
      />

      <InfoCallout tone="info" title="How to read this page">
        Metrics use original labels at the selected percentile. P99 is the primary operating point;
        P99.95 is retrospective. Precision is low because only 70 of 100,892 attack-test events are
        original positives.{" "}
        <Link className="font-medium text-primary underline underline-offset-4" to="/glossary">
          Glossary
        </Link>
        .
      </InfoCallout>

      {!data.available ? (
        <InfoCallout tone="neutral" title="Threshold sweep unavailable">
          {data.reason}
        </InfoCallout>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {rows.map((row) => (
              <button
                key={row.percentile}
                type="button"
                onClick={() => setSelectedPercentile(row.percentile)}
                className={cn(
                  "inline-flex min-h-8 items-center rounded border px-2.5 py-1 font-mono text-[12px] transition-colors",
                  selectedPercentile === row.percentile
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground",
                )}
              >
                {percentileLabel(row.percentile)}
                {row.exploratory && <span className="ml-1 text-warning">*</span>}
              </button>
            ))}
            <span className="self-center text-[12px] text-muted-foreground">
              <span className="text-warning">*</span> retrospective exploratory point (≥P99.95)
            </span>
          </div>

          {selected && (
            <>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard label="Anomaly threshold" value={formatThreshold(selected.threshold)} definition="Calibrated from benign validation errors at the selected percentile." detail={`${experimentId}, ${percentileLabel(selected.percentile)}`} source="results/autoencoder_comparison/threshold_comparison.csv" />
                <KpiCard label="True positives" value={formatNumber(selected.true_positives)} definition="Original positives at or above the selected threshold." detail={`${formatPercent(selected.recall, 2)} original recall`} tone="success" />
                <KpiCard label="False positives" value={formatNumber(selected.false_positives)} definition="Negatively labelled events at or above the selected threshold." detail={`${formatNumber(selected.total_alerts)} total alerts`} tone="error" />
                <KpiCard label="Precision" value={formatPercent(selected.precision, 3)} metricId="precision" detail={`F1 ${formatPercent(selected.f1, 3)}`} tone="warning" />
                <KpiCard label="Benign false-positive rate" value={formatPercent(selected.benign_fpr, 3)} metricId="benign-fpr" detail={`${formatNumber(selected.benign_false_positives)} benign-test alerts`} />
                <KpiCard label="Attack-scenario false-positive rate" value={formatPercent(selected.attack_fpr, 3)} metricId="attack-fpr" detail="Among negatively annotated attack-test events" />
                <KpiCard label="Contextual recall" value={formatPercent(selected.contextual_recall, 2)} metricId="contextual-recall" detail={`${formatNumber(selected.contextual_true_positives)} of 225 derived indicators`} tone="warning" />
                <KpiCard label="Validation FPR" value={formatPercent(selected.validation_fpr, 3)} definition="A calibration check, not a performance result. It sits near 1 minus the percentile." detail="Selected percentile is the calibration target" />
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
                <Card>
                  <CardHeader>
                    <CardTitle>Confusion matrix, {percentileLabel(selected.percentile)}</CardTitle>
                    <div className="text-xs text-muted-foreground">
                      Measured from the attack-test partition with original labels.
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ConfusionMatrix
                      tp={selected.true_positives}
                      fp={selected.false_positives}
                      fn={selected.false_negatives}
                      tn={selected.true_negatives}
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Trade-off across measured percentiles</CardTitle>
                    <div className="text-xs text-muted-foreground">
                      False positives (log scale) and contextual recall. Original recall remains 100% for most of this range.
                    </div>
                  </CardHeader>
                  <CardContent className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
                        <CartesianGrid {...CHART_GRID} />
                        <XAxis dataKey="percentile" {...CHART_AXIS} />
                        <YAxis yAxisId="left" scale="log" domain={[1, "auto"]} {...CHART_AXIS} tickFormatter={(value) => Number(value).toLocaleString()} />
                        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} {...CHART_AXIS} tickFormatter={(value) => `${value}%`} />
                        <Tooltip content={<ChartTooltip formatter={(value, name) => name === "Contextual recall" ? `${Number(value).toFixed(1)}%` : Number(value).toLocaleString()} />} />
                        <Line yAxisId="left" type="monotone" dataKey="false_positives" name="False positives" stroke="var(--error)" strokeWidth={1.5} dot={{ r: 2 }} />
                        <Line yAxisId="right" type="monotone" dataKey="contextual_recall" name="Contextual recall" stroke="var(--warning)" strokeWidth={1.5} dot={{ r: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {experimentId === "E2-D" && p99 && p9995 && (
                <Card className="border-warning/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-1.5">
                      <TriangleAlert className="size-3.5 text-warning" /> E2-D observed operating-point comparison
                    </CardTitle>
                    <div className="text-xs text-muted-foreground">
                      P99 is the primary experimental operating point. P99.95 is an exploratory candidate identified after inspecting attack-test results.
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-3">
                      {[
                        ["Original true positives", formatNumber(p99.true_positives), formatNumber(p9995.true_positives)],
                        ["False positives", formatNumber(p99.false_positives), formatNumber(p9995.false_positives)],
                        ["Original recall", formatPercent(p99.recall, 0), formatPercent(p9995.recall, 0)],
                        ["Precision", formatPercent(p99.precision, 3), formatPercent(p9995.precision, 3)],
                        ["Benign false-positive rate", formatPercent(p99.benign_fpr, 3), formatPercent(p9995.benign_fpr, 3)],
                        ["Contextual recall", formatPercent(p99.contextual_recall, 2), formatPercent(p9995.contextual_recall, 2)],
                      ].map(([label, left, right]) => (
                        <div key={label} className="rounded border border-border p-2.5">
                          <div className="text-[12px] text-muted-foreground">{label}</div>
                          <div className="mt-1 flex items-baseline justify-between gap-2">
                            <div><span className="font-mono text-[12px] text-muted-foreground">P99 </span><span className="font-mono text-xs text-foreground">{left}</span></div>
                            <div><span className="font-mono text-[12px] text-muted-foreground">P99.95 </span><span className="font-mono text-xs text-foreground">{right}</span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <InfoCallout tone="warning" className="mt-3" title="Exploratory diagnostic, not a deployment decision">
                      The higher percentile reduces false positives substantially but sacrifices contextual recall. It was selected retrospectively and has not been independently validated. No threshold should be chosen solely from attack-test performance.
                    </InfoCallout>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>All measured percentile rows, {experimentId}</CardTitle>
                  <div className="text-xs text-muted-foreground">Each row is a directly measured sweep point, not an interpolated value.</div>
                </CardHeader>
                <p className="px-5 pb-2 text-[12px] text-muted-foreground sm:hidden">
                  Scroll horizontally to see every column.
                </p>
                <CardContent className="overflow-x-auto p-0">
                  <table className="w-full min-w-[900px] text-xs">
                    <thead>
                      <tr className="border-b border-border bg-elevated/40">
                        {["Percentile", "Threshold", "TP", "FP", "FN", "Precision", "Recall", "F1", "Benign FPR", "Attack FPR", "Ctx recall", "Alerts"].map((label) => (
                          <th key={label} className="px-2.5 py-2 text-right text-[12px] text-muted-foreground first:text-left">{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr
                          key={row.percentile}
                          onClick={() => setSelectedPercentile(row.percentile)}
                          className={cn(
                            "cursor-pointer border-b border-border last:border-0 hover:bg-elevated/50",
                            selectedPercentile === row.percentile && "bg-primary/5",
                          )}
                        >
                          <td className="px-2.5 py-2 font-mono text-[12px] text-foreground">
                            {percentileLabel(row.percentile)}
                            {row.exploratory && <span className="ml-1 text-warning">*</span>}
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono text-[12px]">{formatThreshold(row.threshold)}</td>
                          <td className="px-2.5 py-2 text-right font-mono text-[12px]">{row.true_positives}</td>
                          <td className="px-2.5 py-2 text-right font-mono text-[12px]">{formatNumber(row.false_positives)}</td>
                          <td className="px-2.5 py-2 text-right font-mono text-[12px]">{row.false_negatives}</td>
                          <td className="px-2.5 py-2 text-right font-mono text-[12px]">{formatPercent(row.precision, 3)}</td>
                          <td className="px-2.5 py-2 text-right font-mono text-[12px]">{formatPercent(row.recall, 1)}</td>
                          <td className="px-2.5 py-2 text-right font-mono text-[12px]">{formatPercent(row.f1, 3)}</td>
                          <td className="px-2.5 py-2 text-right font-mono text-[12px]">{formatPercent(row.benign_fpr, 3)}</td>
                          <td className="px-2.5 py-2 text-right font-mono text-[12px]">{formatPercent(row.attack_fpr, 2)}</td>
                          <td className="px-2.5 py-2 text-right font-mono text-[12px]">{formatPercent(row.contextual_recall, 1)}</td>
                          <td className="px-2.5 py-2 text-right font-mono text-[12px]">{formatNumber(row.total_alerts)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <SourceNote source={data.source} />
            </>
          )}
        </>
      )}
    </div>
  );
}
