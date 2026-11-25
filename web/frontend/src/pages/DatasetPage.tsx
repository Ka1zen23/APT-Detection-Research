import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartTooltip, CHART_AXIS, CHART_GRID } from "@/components/features/data";
import {
  ErrorState,
  InfoCallout,
  KpiCard,
  LoadingBlock,
  PageHeader,
  SourceNote,
} from "@/components/features/common";
import { DatasetLens } from "@/components/publication/DatasetLens";
import { useDataset } from "@/hooks/queries";
import { formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DistributionItem } from "@/types/api";

function DistributionList({ items, total, color = "var(--chart-1)" }: { items: DistributionItem[]; total: number; color?: string }) {
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    <div className="space-y-1.5">
      {items.slice(0, 8).map((item) => (
        <div key={item.name}>
          <div className="flex items-center justify-between text-[10px]">
            <span className="truncate font-mono text-muted-foreground">{item.name}</span>
            <span className="ml-2 shrink-0 font-mono text-foreground">{formatNumber(item.count)}</span>
          </div>
          <div className="mt-0.5 h-1 overflow-hidden rounded bg-elevated">
            <div className="h-full rounded" style={{ width: `${(item.count / max) * 100}%`, backgroundColor: color }} />
          </div>
          <div className="mt-0.5 text-right font-mono text-[12px] text-muted-foreground">
            {total ? formatPercent(item.count / total, 1) : "n/a"}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DatasetPage() {
  const { data, isLoading, error, refetch } = useDataset();
  const [tacticView, setTacticView] = useState<"original" | "contextual">("original");

  if (isLoading) return <LoadingBlock rows={10} />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;

  const counts = data.counts;
  const attackTest = data.class_balance.find((row) => row.partition === "Attack test");
  const partitionData = data.partitions.map((partition) => ({ name: partition.name.replace("_", " "), records: partition.records }));
  const imbalanceData = [
    { name: "Original negatives", count: attackTest ? attackTest.records - attackTest.positives : 0, type: "neg" },
    { name: "Contextual positives", count: attackTest?.contextual_positives ?? 0, type: "ctx" },
    { name: "Original positives", count: attackTest?.positives ?? 0, type: "pos" },
  ].filter(({ count }) => count > 0);
  const topOperations = data.operations.slice(0, 10);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Research, Dataset"
        title="CICAPT-IIoT dataset overview"
        description="Aggregate provenance structure, reconstructed event counts, label imbalance and representation diversity. Individual event descriptions are intentionally excluded from this public cloud snapshot."
        actions={<Badge variant="outline">Aggregate snapshot</Badge>}
      >
        <InfoCallout tone="info" title="Event-level provenance is not included">
          This deployment exposes aggregate dataset statistics and experiment results only. It does
          not include individual provenance events, event descriptions, node IDs or event-level
          anomaly scores.
        </InfoCallout>
      </PageHeader>

      <InfoCallout tone="info" title="How to read this page">
        A record is one raw provenance row. An event groups edges that share an event ID. Original
        positives are edge-derived annotations; contextual indicators are derived from connected
        nodes and stay separate.{" "}
        <Link className="font-medium text-primary underline underline-offset-4" to="/glossary">
          Glossary
        </Link>
        .
      </InfoCallout>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Raw provenance records" value={formatNumber(counts.raw_records)} definition="Rows in the two raw provenance logs, before event grouping." detail={`${formatNumber(counts.phase1_raw_records)} Phase 1, ${formatNumber(counts.phase2_raw_records)} Phase 2`} source="results/eda/dataset_inspection.txt" />
        <KpiCard label="Provenance nodes" value={formatNumber(counts.nodes)} definition="Distinct process and artifact nodes in the reconstructed graph." detail={`${formatNumber(counts.edges)} directed edges`} source="results/eda/graph_inspection.txt" />
        <KpiCard label="Reconstructed events" value={formatNumber(counts.events)} definition="Edge records grouped by event ID into event-level units." detail={`${formatNumber(counts.phase1_events)} Phase 1, ${formatNumber(counts.phase2_events)} Phase 2`} tone="accent" source="data/processed/cicapt-iiot-v2/*_events.parquet" />
        <KpiCard label="Original positives" value={formatNumber(counts.original_positives)} metricId="original-labels" detail={`${formatPercent(counts.attack_prevalence_percent, 4, true)} of Phase 2 events, ${formatNumber(counts.contextual_positives)} contextual`} tone="error" source="results/eda/ground_truth_inspection.txt" />
      </div>

      <DatasetLens data={data} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Partition distribution</CardTitle><div className="text-xs text-muted-foreground">Chronological event partitions.</div></CardHeader>
          <CardContent className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={partitionData} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid {...CHART_GRID} />
                <XAxis dataKey="name" {...CHART_AXIS} interval={0} angle={-12} textAnchor="end" height={38} />
                <YAxis {...CHART_AXIS} tickFormatter={(value) => Number(value).toLocaleString()} />
                <Tooltip content={<ChartTooltip formatter={(value) => Number(value).toLocaleString()} />} />
                <Bar dataKey="records" fill="var(--chart-1)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Attack-test class imbalance</CardTitle><div className="text-xs text-muted-foreground">Log scale. Contextual indicators are shown separately; counts are not additive.</div></CardHeader>
          <CardContent className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={imbalanceData} layout="vertical" margin={{ left: 8, right: 18, top: 4, bottom: 4 }}>
                <CartesianGrid {...CHART_GRID} horizontal={false} />
                <XAxis type="number" scale="log" domain={[1, "auto"]} {...CHART_AXIS} tickFormatter={(value) => Number(value).toLocaleString()} />
                <YAxis type="category" dataKey="name" width={110} {...CHART_AXIS} />
                <Tooltip content={<ChartTooltip formatter={(value) => Number(value).toLocaleString()} />} />
                <Bar dataKey="count" radius={[0, 2, 2, 0]}>
                  {imbalanceData.map((item) => <Cell key={item.name} fill={item.type === "pos" ? "var(--error)" : item.type === "ctx" ? "var(--warning)" : "var(--muted-foreground)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Temporal coverage</CardTitle><div className="text-xs text-muted-foreground">Reconstructed events per UTC day and partition.</div></CardHeader>
          <CardContent className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.timeline} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid {...CHART_GRID} />
                <XAxis dataKey="date" {...CHART_AXIS} tickFormatter={(value) => String(value).slice(5)} />
                <YAxis {...CHART_AXIS} tickFormatter={(value) => Number(value).toLocaleString()} />
                <Tooltip content={<ChartTooltip formatter={(value) => Number(value).toLocaleString()} />} />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                <Bar dataKey="train" stackId="a" fill="var(--chart-1)" name="train" />
                <Bar dataKey="validation" stackId="a" fill="var(--success)" name="validation" />
                <Bar dataKey="benign_test" stackId="a" fill="var(--warning)" name="benign test" />
                <Bar dataKey="attack_test" stackId="a" fill="var(--error)" name="attack test" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <details className="pub-disclosure">
        <summary>Read exact daily event counts</summary>
        <div className="pub-dataset-table" role="region" aria-label="Daily event counts table scroll area" tabIndex={0}>
          <table>
            <caption>Reconstructed events per UTC day and partition</caption>
            <thead><tr>{["UTC day", "Training", "Validation", "Benign test", "Attack test", "Total"].map((title) => <th key={title} scope="col">{title}</th>)}</tr></thead>
            <tbody>{data.timeline.map(({ date, train, validation, benign_test, attack_test, total }) => <tr key={date}>
              <th scope="row">{date}</th>{[train, validation, benign_test, attack_test, total].map((count, index) => <td key={index}>{formatNumber(count)}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
      </details>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card><CardHeader><CardTitle>Node types</CardTitle></CardHeader><CardContent><DistributionList items={data.node_types} total={counts.nodes} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Edge types</CardTitle></CardHeader><CardContent><DistributionList items={data.edge_types} total={counts.edges} color="var(--success)" /></CardContent></Card>
        <Card><CardHeader><CardTitle>Top operations</CardTitle></CardHeader><CardContent><DistributionList items={topOperations} total={data.operations_total} color="var(--warning)" /></CardContent></Card>
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>ATT&amp;CK tactics</CardTitle>
              <div className="pub-controls" role="group" aria-label="Tactic label scheme">
                <button type="button" className="pub-segment" aria-pressed={tacticView === "original"} onClick={() => setTacticView("original")}>Original</button>
                <button type="button" className="pub-segment" aria-pressed={tacticView === "contextual"} onClick={() => setTacticView("contextual")}>Contextual</button>
              </div>
            </div>
          </CardHeader>
          <CardContent><DistributionList items={tacticView === "original" ? data.tactics.original : data.tactics.contextual} total={tacticView === "original" ? counts.original_positives : counts.contextual_positives} color={tacticView === "original" ? "var(--error)" : "var(--warning)"} /></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Missing values, raw provenance columns</CardTitle><div className="text-xs text-muted-foreground">Combined across both raw CSV files. Node-only and edge-only fields are structurally missing.</div></CardHeader>
          <CardContent className="space-y-2">
            {data.missing_values.slice(0, 12).map((row) => (
              <div key={row.column}>
                <div className="flex justify-between text-[10px]"><span className="font-mono text-muted-foreground">{row.column}</span><span className="font-mono text-foreground">{formatNumber(row.missing)}, {formatPercent(row.percent, 1, true)}</span></div>
                <div className="mt-0.5 h-1 overflow-hidden rounded bg-elevated"><div className="h-full bg-warning/70" style={{ width: `${row.percent}%` }} /></div>
              </div>
            ))}
            <div className="pt-1 text-[9px] text-muted-foreground">Top 12 columns shown. Values are computed from the raw CSVs, not estimated.</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Description overlap</CardTitle><div className="text-xs text-muted-foreground">Exact-description overlap between splits and seen/unseen attack-test descriptions.</div></CardHeader>
          <CardContent className="space-y-2">
            {[
              ["Training vs validation", data.overlap.training_vs_validation],
              ["Training vs benign test", data.overlap.training_vs_benign_test],
              ["Training vs attack test", data.overlap.training_vs_attack_test],
            ].map(([label, value]) => {
              const item = value as { matching: number; percent: number };
              return (
                <div key={label as string} className="flex items-center gap-2">
                  <span className="w-40 text-[10px] text-muted-foreground">{label as string}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded bg-elevated"><div className="h-full bg-primary" style={{ width: `${item.percent}%` }} /></div>
                  <span className="w-24 text-right font-mono text-[10px] text-foreground">{formatNumber(item.matching)}, {item.percent}%</span>
                </div>
              );
            })}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded border border-border px-2.5 py-2">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Seen attack descriptions</div>
                <div className="font-mono text-sm text-foreground">{formatNumber(data.overlap.attack_test_seen)}</div>
                <div className="text-[9px] text-muted-foreground">{formatNumber(data.overlap.seen_positives)} original positives</div>
              </div>
              <div className="rounded border border-border px-2.5 py-2">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Unseen attack descriptions</div>
                <div className="font-mono text-sm text-foreground">{formatNumber(data.overlap.attack_test_unseen)}</div>
                <div className="text-[9px] text-muted-foreground">{formatNumber(data.overlap.unseen_positives)} original positives</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Representation diversity and truncation</CardTitle><div className="text-xs text-muted-foreground">Unique descriptions and encoder token-limit exceedances per ablation representation.</div></CardHeader>
          <CardContent className="overflow-x-auto p-0" role="region" aria-label="Representation diversity table scroll area" tabIndex={0}>
            <table className="w-full min-w-[560px] text-xs">
              <thead><tr className="border-b border-border bg-elevated/40">{["Variant", "Split", "Events", "Unique", "Mean tok.", "Max tok.", ">256"].map((h) => <th key={h} className="px-2 py-1.5 text-right text-[9px] uppercase tracking-wider text-muted-foreground first:text-left">{h}</th>)}</tr></thead>
              <tbody>
                {data.representation.filter((row) => ["train", "attack_test"].includes(row.split)).map((row) => (
                  <tr key={`${row.variant}-${row.split}`} className="border-b border-border last:border-0">
                    <td className="px-2 py-1.5 font-mono text-[9px] text-foreground">{row.variant}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-[9px] text-muted-foreground">{row.split}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-[9px]">{formatNumber(row.events)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-[9px]">{formatNumber(row.unique_descriptions)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-[9px]">{row.mean_tokens.toFixed(1)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-[9px]">{formatNumber(row.maximum_tokens)}</td>
                    <td className={cn("px-2 py-1.5 text-right font-mono text-[9px]", row.over_token_limit > 0 && "text-warning")}>{formatNumber(row.over_token_limit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Duplicate descriptions</CardTitle><div className="text-xs text-muted-foreground">Duplicate counts are exact-text duplicates, not semantic duplicates.</div></CardHeader>
          <CardContent className="space-y-2">
            {data.duplicates.filter((row) => ["train", "attack_test"].includes(row.split)).slice(0, 6).map((row) => (
              <div key={`${row.variant}-${row.split}`} className="flex items-center gap-2">
                <span className="w-32 font-mono text-[9px] text-muted-foreground">{row.variant}/{row.split}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded bg-elevated"><div className="h-full bg-warning/70" style={{ width: `${row.duplicate_percent}%` }} /></div>
                <span className="w-20 text-right font-mono text-[9px] text-foreground">{formatNumber(row.duplicates)}</span>
                <span className="w-12 text-right font-mono text-[9px] text-muted-foreground">{row.duplicate_percent.toFixed(1)}%</span>
              </div>
            ))}
            <div className="pt-1 text-[9px] text-muted-foreground">Operation-only descriptions are extremely repetitive; full provenance reduces exact duplication but still contains 79,303 duplicate attack descriptions.</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SourceNote source="web/content/dataset_profile.json" />
        <SourceNote source="data/processed/cicapt-iiot-v2/*.parquet (aggregate statistics only)" />
        <SourceNote source="data/splits/cicapt-iiot/split_summary.json" />
        <SourceNote source="results/eda/ablation/representation_statistics.csv" />
      </div>
    </div>
  );
}
