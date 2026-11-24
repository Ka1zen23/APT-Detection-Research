import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Gauge, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { ChartTooltip, CHART_AXIS, CHART_COLORS, CHART_GRID } from "@/components/features/data";
import {
  ErrorState,
  InfoCallout,
  KpiCard,
  LoadingBlock,
  PageHeader,
  SourceNote,
} from "@/components/features/common";
import { api } from "@/services/api";
import type { AlertBudgetPayload } from "@/types/api";
import { formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

const MODELS = ["E2-A", "E2-B", "E2-C", "E2-D"];

export function AlertsPage() {
  const [budgetIndex, setBudgetIndex] = useState(4);
  const [visibleModels, setVisibleModels] = useState<string[]>(MODELS);
  const queries = useQueries({
    queries: MODELS.map((id) => ({
      queryKey: ["budgets", id],
      queryFn: () => api.alertBudgets(id),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const loading = queries.some((query) => query.isLoading);
  const error = queries.find((query) => query.error)?.error;
  const payloads = queries
    .map((query) => query.data)
    .filter((payload): payload is AlertBudgetPayload => Boolean(payload));

  const budgets = useMemo(() => {
    const values = new Set<number>();
    for (const payload of payloads) {
      for (const row of payload?.rows ?? []) values.add(row.budget);
    }
    return [...values].sort((a, b) => a - b);
  }, [payloads]);

  const budget = budgets[Math.min(budgetIndex, budgets.length - 1)] ?? 1000;
  const primary = payloads.find((payload) => payload?.experiment_id === "E2-D") ?? payloads[0];

  const chartData = useMemo(
    () =>
      budgets.map((value) => {
        const record: Record<string, number | string> = { budget: value };
        for (const payload of payloads) {
          const row = payload?.rows.find((item) => item.budget === value);
          if (row) record[payload.experiment_id] = row.expected_true_positives;
        }
        return record;
      }),
    [budgets, payloads],
  );

  if (loading) return <LoadingBlock rows={8} />;
  if (error) {
    return <ErrorState error={error} onRetry={() => queries.forEach((query) => query.refetch())} />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Experiments · Alert prioritisation"
        title="Analyst alert-budget simulator"
        description="How many original malicious events are recovered if an analyst investigates only the top-ranked alerts? Only measured budget points are shown; intermediate budgets are not invented."
        actions={<Badge variant="outline">Tie-aware analysis</Badge>}
      />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Investigating budget" value={formatNumber(budget)} detail="Top-N ranked alerts" tone="accent" icon={<Users className="size-3.5" />} />
        <KpiCard label="E2-D expected true positives" value={formatNumber(primary?.rows.find((row) => row.budget === budget)?.expected_true_positives ?? null)} detail="Within the selected alert budget" tone="success" />
        <KpiCard label="E2-D expected precision" value={formatPercent(primary?.rows.find((row) => row.budget === budget)?.expected_precision ?? null, 2)} detail="Expected TP ÷ budget" tone="warning" />
        <KpiCard label="E2-D expected recall" value={formatPercent(primary?.rows.find((row) => row.budget === budget)?.expected_recall ?? null, 2)} detail="Of 70 original positives" tone="warning" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5"><Gauge className="size-3.5" /> Select an investigation budget</CardTitle>
          <div className="text-xs text-muted-foreground">
            The slider snaps to measured budgets: {budgets.join(", ")}. There are no interpolated values.
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="px-1">
            <Slider
              value={[budgetIndex]}
              min={0}
              max={Math.max(budgets.length - 1, 0)}
              step={1}
              onValueChange={(value) => setBudgetIndex(value[0])}
              aria-label="Alert budget"
            />
            <div className="mt-2 flex justify-between font-mono text-[9px] text-muted-foreground">
              {budgets.map((value) => (
                <button key={value} type="button" onClick={() => setBudgetIndex(budgets.indexOf(value))} className={cn(value === budget && "font-semibold text-primary")}>
                  {value >= 1000 ? `${value / 1000}k` : value}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] text-muted-foreground">Models:</span>
            {MODELS.map((id) => {
              const active = visibleModels.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setVisibleModels((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
                  className={cn(
                    "rounded border px-2 py-1 font-mono text-[10px] transition-colors",
                    active ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {id}
                </button>
              );
            })}
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {payloads.map((payload) => {
              const row = payload?.rows.find((item) => item.budget === budget);
              const hidden = !visibleModels.includes(payload!.experiment_id);
              return (
                <div key={payload!.experiment_id} className={cn("rounded-md border border-border p-2.5", hidden && "opacity-40")}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-medium text-foreground">{payload!.experiment_id}</span>
                    <Badge variant={payload!.experiment_id === "E2-D" ? "success" : "outline"}>
                      {payload!.experiment_id === "E2-D" ? "Leading" : "Comparison"}
                    </Badge>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1 text-[10px]">
                    <div>
                      <span className="text-muted-foreground">TP</span>
                      <div className="font-mono text-foreground">{row ? formatNumber(row.expected_true_positives) : "—"}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tie range</span>
                      <div className="font-mono text-foreground">{row ? `${row.minimum_true_positives}–${row.maximum_true_positives}` : "—"}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Precision</span>
                      <div className="font-mono text-foreground">{row ? formatPercent(row.expected_precision, 2) : "—"}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Recall</span>
                      <div className="font-mono text-foreground">{row ? formatPercent(row.expected_recall, 1) : "—"}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Expected original true positives by alert budget</CardTitle>
            <div className="text-xs text-muted-foreground">Measured budgets only. Higher curves recover more malicious events at the same analyst cost.</div>
          </CardHeader>
          <CardContent className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
                <CartesianGrid {...CHART_GRID} />
                <XAxis
                  dataKey="budget"
                  type="number"
                  scale="log"
                  domain={[50, 10000]}
                  ticks={budgets}
                  {...CHART_AXIS}
                  tickFormatter={(value) => Number(value).toLocaleString()}
                />
                <YAxis domain={[0, 70]} {...CHART_AXIS} />
                <Tooltip content={<ChartTooltip formatter={(value) => Number(value).toFixed(0)} labelFormatter={(label) => `Budget ${Number(label).toLocaleString()}`} />} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {payloads.filter((payload) => visibleModels.includes(payload.experiment_id)).map((payload) => (
                  <Line
                    key={payload!.experiment_id}
                    type="monotone"
                    dataKey={payload!.experiment_id}
                    stroke={CHART_COLORS[MODELS.indexOf(payload!.experiment_id) % CHART_COLORS.length]}
                    strokeWidth={payload!.experiment_id === "E2-D" ? 2.5 : 1.5}
                    dot={{ r: 2.5 }}
                    isAnimationActive={false}
                    name={payload!.experiment_id}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Analyst workload interpretation</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-[11px] leading-relaxed text-muted-foreground">
              <p><Users className="mr-1 inline size-3 text-primary" /> At a 500-alert budget, E2-D recovers 46 of 70 original positives, while E2-B recovers 7 and E2-A/E2-C recover 0.</p>
              <p>Expected precision at 500 alerts is 9.2% for E2-D: about 46 true alerts among 500 investigations. This is a triage result, not autonomous classification.</p>
              <p>At 2,000 alerts, all four models recover at least 64 of 70, but the analyst cost is four times larger.</p>
              <InfoCallout tone="warning" title="Tie handling">
                When scores are tied at the budget boundary, the analysis reports expected, minimum and maximum true positives. In the current artifacts, these bounds are equal at every measured budget.
              </InfoCallout>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>What this analysis does not show</CardTitle></CardHeader>
            <CardContent className="text-[11px] leading-relaxed text-muted-foreground">
              It does not measure analyst decision quality, investigation time, mitigation success or alert fatigue. It also uses a single seed and a repeatedly inspected attack scenario.
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Measured budget table</CardTitle>
          <div className="text-xs text-muted-foreground">Each row is an exact artifact value. No intermediate budget is estimated.</div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-xs">
            <thead>
              <tr className="border-b border-border bg-elevated/40">
                {["Budget", ...MODELS.flatMap((id) => [`${id} TP`, `${id} precision`])].map((header) => (
                  <th key={header} className="px-2.5 py-2 text-right text-[9px] uppercase tracking-wider text-muted-foreground first:text-left">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {budgets.map((value) => (
                <tr key={value} onClick={() => setBudgetIndex(budgets.indexOf(value))} className={cn("cursor-pointer border-b border-border last:border-0 hover:bg-elevated/50", value === budget && "bg-primary/5")}>
                  <td className="px-2.5 py-2 font-mono text-[10px] text-foreground">{formatNumber(value)}</td>
                  {MODELS.map((id) => {
                    const payload = payloads.find((item) => item?.experiment_id === id);
                    const row = payload?.rows.find((item) => item.budget === value);
                    return [
                      <td key={`${id}-${value}-tp`} className="px-2.5 py-2 text-right font-mono text-[10px]">{row ? formatNumber(row.expected_true_positives) : "—"}</td>,
                      <td key={`${id}-${value}-p`} className="px-2.5 py-2 text-right font-mono text-[10px]">{row ? formatPercent(row.expected_precision, 2) : "—"}</td>,
                    ];
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <SourceNote source="results/autoencoder_comparison/alert_budget_comparison.csv" />
    </div>
  );
}
