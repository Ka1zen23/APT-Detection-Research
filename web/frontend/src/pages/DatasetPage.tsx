import { useEffect, useMemo, useState } from "react";
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
import { Filter, Search, Table2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaginationBar, ChartTooltip, CHART_AXIS, CHART_GRID } from "@/components/features/data";
import {
  ErrorState,
  KpiCard,
  LoadingBlock,
  PageHeader,
  SourceNote,
} from "@/components/features/common";
import { useDataset, useEvents } from "@/hooks/queries";
import { formatDateTime, formatNumber, formatPercent, truncate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DatasetSummary, DistributionItem, EventRow } from "@/types/api";

function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function DistributionList({ items, total, color = "var(--primary)" }: { items: DistributionItem[]; total: number; color?: string }) {
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
          <div className="mt-0.5 text-right font-mono text-[8px] text-muted-foreground/70">
            {total ? formatPercent(item.count / total, 1) : "—"}
          </div>
        </div>
      ))}
    </div>
  );
}

function DataTableShell({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto rounded border border-border">{children}</div>;
}

function ExplorerFilters({
  dataset,
  value,
  onChange,
  onReset,
}: {
  dataset: DatasetSummary;
  value: Record<string, string>;
  onChange: (key: string, next: string) => void;
  onReset: () => void;
}) {
  const tactics = Array.from(
    new Set([
      ...dataset.tactics.original.map((item) => item.name),
      ...dataset.tactics.contextual.map((item) => item.name),
    ]),
  ).sort();
  return (
    <div className="grid gap-2 border-b border-border p-3 md:grid-cols-2 xl:grid-cols-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={value.search} onChange={(event) => onChange("search", event.target.value)} placeholder="Search description text…" className="pl-8" />
      </div>
      <Input value={value.eventId} onChange={(event) => onChange("eventId", event.target.value)} placeholder="Event ID (exact or partial)…" className="font-mono text-[11px]" />
      <Select value={value.phase} onChange={(event) => onChange("phase", event.target.value)} aria-label="Phase">
        <option value="">All phases</option>
        <option value="phase1">Phase 1 (benign collection)</option>
        <option value="phase2">Phase 2 (attack scenario)</option>
      </Select>
      <Select value={value.split} onChange={(event) => onChange("split", event.target.value)} aria-label="Partition">
        <option value="">All partitions</option>
        <option value="train">Training</option>
        <option value="validation">Validation</option>
        <option value="benign_test">Benign test</option>
        <option value="attack_test">Attack test</option>
      </Select>
      <Select value={value.originalLabel} onChange={(event) => onChange("originalLabel", event.target.value)} aria-label="Original label">
        <option value="">Any original label</option>
        <option value="1">Original positive</option>
        <option value="0">Original negative</option>
      </Select>
      <Select value={value.contextualLabel} onChange={(event) => onChange("contextualLabel", event.target.value)} aria-label="Contextual label">
        <option value="">Any contextual label</option>
        <option value="1">Contextual positive</option>
        <option value="0">Contextual negative</option>
      </Select>
      <Select value={value.tactic} onChange={(event) => onChange("tactic", event.target.value)} aria-label="Tactic">
        <option value="">Any ATT&amp;CK tactic</option>
        {tactics.map((tactic) => <option key={tactic} value={tactic}>{tactic}</option>)}
      </Select>
      <Select value={value.prediction} onChange={(event) => onChange("prediction", event.target.value)} aria-label="E2-D prediction">
        <option value="">Any E2-D prediction</option>
        <option value="1">E2-D alert</option>
        <option value="0">E2-D normal</option>
      </Select>
      <div className="flex items-center gap-1.5">
        <Input type="number" step="0.000001" value={value.minScore} onChange={(event) => onChange("minScore", event.target.value)} placeholder="Min score" className="font-mono text-[10px]" />
        <Input type="number" step="0.000001" value={value.maxScore} onChange={(event) => onChange("maxScore", event.target.value)} placeholder="Max score" className="font-mono text-[10px]" />
      </div>
      <Select value={value.seen} onChange={(event) => onChange("seen", event.target.value)} aria-label="Seen in training">
        <option value="">Seen / unseen (any)</option>
        <option value="true">Description seen in training</option>
        <option value="false">Description unseen</option>
      </Select>
      <div className="flex items-center gap-1.5">
        <Input type="date" value={value.timestampFrom} onChange={(event) => onChange("timestampFrom", event.target.value)} aria-label="Timestamp from" className="font-mono text-[10px]" />
        <Input type="date" value={value.timestampTo} onChange={(event) => onChange("timestampTo", event.target.value)} aria-label="Timestamp to" className="font-mono text-[10px]" />
      </div>
      <Select value={value.sortBy} onChange={(event) => onChange("sortBy", event.target.value)} aria-label="Sort by">
        <option value="timestamp">Sort: timestamp</option>
        <option value="anomaly_score">Sort: E2-D anomaly score</option>
        <option value="event_id">Sort: event ID</option>
        <option value="original_label">Sort: original label</option>
      </Select>
      <div className="flex items-center gap-1.5">
        <Select value={value.sortOrder} onChange={(event) => onChange("sortOrder", event.target.value)} aria-label="Sort order">
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </Select>
        <Select value={value.pageSize} onChange={(event) => onChange("pageSize", event.target.value)} aria-label="Page size">
          <option value="25">25 / page</option>
          <option value="50">50 / page</option>
          <option value="100">100 / page</option>
        </Select>
      </div>
      <div className="flex items-center">
        <Button variant="ghost" size="sm" onClick={onReset} className="w-full">
          <X /> Reset filters
        </Button>
      </div>
    </div>
  );
}

function EventDrawer({ event, onClose }: { event: EventRow | null; onClose: () => void }) {
  return (
    <Dialog open={Boolean(event)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        {event && (
          <>
            <DialogTitle className="flex items-center gap-2 font-mono">
              <span>{event.phase}</span>
              <span className="text-muted-foreground">/</span>
              <span>event {event.event_id}</span>
            </DialogTitle>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant={event.original_label === 1 ? "error" : "outline"}>
                Original {event.original_label === 1 ? "positive" : "negative"}
              </Badge>
              <Badge variant={event.contextual_label === 1 ? "warning" : "outline"}>
                Contextual {event.contextual_label === 1 ? "positive" : "negative"}
              </Badge>
              <Badge variant="outline">{event.split?.replace("_", " ")}</Badge>
              {event.seen_in_training !== null && (
                <Badge variant="outline">{event.seen_in_training ? "Seen in training" : "Unseen description"}</Badge>
              )}
              {event.prediction !== null && (
                <Badge variant={event.prediction === 1 ? "warning" : "success"}>
                  E2-D {event.prediction === 1 ? "alert" : "normal"}
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] sm:grid-cols-4">
              {[
                ["Timestamp", formatDateTime(event.timestamp)],
                ["Edges", formatNumber(event.edge_count)],
                ["Anomaly score", event.anomaly_score === null ? "—" : event.anomaly_score.toExponential(4)],
                ["Original tactics", event.original_tactics.join(", ") || "—"],
                ["Contextual tactics", event.contextual_tactics.join(", ") || "—"],
                ["Prediction", event.prediction === null ? "—" : String(event.prediction)],
                ["Seen", event.seen_in_training === null ? "—" : String(event.seen_in_training)],
                ["Phase", event.phase],
              ].map(([label, value]) => (
                <div key={label} className="rounded border border-border px-2 py-1.5">
                  <div className="text-muted-foreground">{label}</div>
                  <div className="mt-0.5 break-words font-mono text-foreground">{value}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-1 text-[9px] uppercase tracking-wider text-muted-foreground">Verbalised event description</div>
              <div className="max-h-[40vh] overflow-y-auto rounded border border-border bg-elevated/50 p-3 font-mono text-[10px] leading-relaxed text-foreground">
                {event.text}
              </div>
            </div>
            <div className="text-[9px] text-muted-foreground">
              Scores are from E2-D and exist only for the attack-test partition. The description is the V2 full-provenance verbalisation.
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DatasetPage() {
  const { data, isLoading, error, refetch } = useDataset();
  const [tacticView, setTacticView] = useState<"original" | "contextual">("original");
  const [filters, setFilters] = useState({
    search: "",
    eventId: "",
    phase: "",
    split: "",
    originalLabel: "",
    contextualLabel: "",
    tactic: "",
    prediction: "",
    seen: "",
    minScore: "",
    maxScore: "",
    timestampFrom: "",
    timestampTo: "",
    sortBy: "timestamp",
    sortOrder: "desc",
    pageSize: "25",
  });
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<EventRow | null>(null);
  const debouncedSearch = useDebounced(filters.search);
  const debouncedEventId = useDebounced(filters.eventId);

  const queryFilters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      event_id: debouncedEventId || undefined,
      phase: filters.phase || undefined,
      split: filters.split || undefined,
      original_label: filters.originalLabel === "" ? undefined : Number(filters.originalLabel),
      contextual_label: filters.contextualLabel === "" ? undefined : Number(filters.contextualLabel),
      tactic: filters.tactic || undefined,
      prediction: filters.prediction === "" ? undefined : Number(filters.prediction),
      seen: filters.seen === "" ? undefined : filters.seen === "true",
      min_score: filters.minScore === "" ? undefined : Number(filters.minScore),
      max_score: filters.maxScore === "" ? undefined : Number(filters.maxScore),
      timestamp_from: filters.timestampFrom
        ? Date.parse(`${filters.timestampFrom}T00:00:00Z`) / 1000
        : undefined,
      timestamp_to: filters.timestampTo
        ? Date.parse(`${filters.timestampTo}T23:59:59Z`) / 1000
        : undefined,
      sort_by: filters.sortBy,
      sort_order: filters.sortOrder as "asc" | "desc",
      page,
      page_size: Number(filters.pageSize),
    }),
    [filters, debouncedSearch, debouncedEventId, page],
  );

  const events = useEvents(queryFilters);

  const updateFilter = (key: string, next: string) => {
    setFilters((current) => ({ ...current, [key]: next }));
    setPage(1);
  };
  const reset = () => {
    setFilters({ search: "", eventId: "", phase: "", split: "", originalLabel: "", contextualLabel: "", tactic: "", prediction: "", seen: "", minScore: "", maxScore: "", timestampFrom: "", timestampTo: "", sortBy: "timestamp", sortOrder: "desc", pageSize: "25" });
    setPage(1);
  };

  if (isLoading) return <LoadingBlock rows={10} />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;

  const counts = data.counts;
  const partitionData = data.partitions.map((partition) => ({ name: partition.name.replace("_", " "), records: partition.records }));
  const imbalanceData = [
    { name: "Negatives", count: 100892 - counts.original_positives, type: "neg" },
    { name: "Contextual positives", count: counts.contextual_positives, type: "ctx" },
    { name: "Original positives", count: counts.original_positives, type: "pos" },
  ];
  const topOperations = data.operations.slice(0, 10);
  const pageData = events.data;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Research · Dataset"
        title="CICAPT-IIoT dataset explorer"
        description="Provenance graph structure, reconstructed events, label imbalance and event-level inspection. The browser receives one event page at a time; pagination and filtering run on the API."
        actions={<Badge variant="outline">CICAPT-IIoT</Badge>}
      />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Raw provenance records" value={formatNumber(counts.raw_records)} detail={`${formatNumber(counts.phase1_raw_records)} Phase 1 · ${formatNumber(counts.phase2_raw_records)} Phase 2`} source="results/eda/dataset_inspection.txt" />
        <KpiCard label="Provenance nodes" value={formatNumber(counts.nodes)} detail={`${formatNumber(counts.edges)} directed edges`} />
        <KpiCard label="Reconstructed events" value={formatNumber(counts.events)} detail={`${formatNumber(counts.phase1_events)} Phase 1 · ${formatNumber(counts.phase2_events)} Phase 2`} tone="accent" />
        <KpiCard label="Original positives" value={formatNumber(counts.original_positives)} detail={`${formatPercent(counts.attack_prevalence_percent, 4, true)} of Phase 2 events · ${formatNumber(counts.contextual_positives)} contextual`} tone="error" />
      </div>

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
                <Bar dataKey="records" fill="var(--primary)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Attack-test class imbalance</CardTitle><div className="text-xs text-muted-foreground">Log scale. Original positives are 70 of 100,892 events.</div></CardHeader>
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
                <Bar dataKey="train" stackId="a" fill="var(--primary)" name="train" />
                <Bar dataKey="validation" stackId="a" fill="var(--success)" name="validation" />
                <Bar dataKey="benign_test" stackId="a" fill="var(--warning)" name="benign test" />
                <Bar dataKey="attack_test" stackId="a" fill="var(--error)" name="attack test" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card><CardHeader><CardTitle>Node types</CardTitle></CardHeader><CardContent><DistributionList items={data.node_types} total={counts.nodes} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Edge types</CardTitle></CardHeader><CardContent><DistributionList items={data.edge_types} total={counts.edges} color="var(--success)" /></CardContent></Card>
        <Card><CardHeader><CardTitle>Top operations</CardTitle></CardHeader><CardContent><DistributionList items={topOperations} total={data.operations_total} color="var(--warning)" /></CardContent></Card>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>ATT&amp;CK tactics</CardTitle>
              <Tabs value={tacticView} onValueChange={(value) => setTacticView(value as "original" | "contextual")}>
                <TabsList className="h-6"><TabsTrigger value="original" className="px-1.5 text-[9px]">Original</TabsTrigger><TabsTrigger value="contextual" className="px-1.5 text-[9px]">Contextual</TabsTrigger></TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent><DistributionList items={tacticView === "original" ? data.tactics.original : data.tactics.contextual} total={tacticView === "original" ? counts.original_positives : counts.contextual_positives} color={tacticView === "original" ? "var(--error)" : "var(--warning)"} /></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Missing values — raw provenance columns</CardTitle><div className="text-xs text-muted-foreground">Combined across both raw CSV files. Node-only and edge-only fields are structurally missing.</div></CardHeader>
          <CardContent className="space-y-2">
            {data.missing_values.slice(0, 12).map((row) => (
              <div key={row.column}>
                <div className="flex justify-between text-[10px]"><span className="font-mono text-muted-foreground">{row.column}</span><span className="font-mono text-foreground">{formatNumber(row.missing)} · {formatPercent(row.percent, 1, true)}</span></div>
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
                  <span className="w-24 text-right font-mono text-[10px] text-foreground">{formatNumber(item.matching)} · {item.percent}%</span>
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
          <CardContent className="overflow-x-auto p-0">
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

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
          <div>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Table2 className="size-3.5" /> Event explorer</div>
            <div className="text-[10px] text-muted-foreground">Server-side pagination and filtering. Scores are E2-D and exist only for attack-test events.</div>
          </div>
          <Badge variant="outline" className="font-mono">{pageData ? `${formatNumber(pageData.total)} matching` : "loading"}</Badge>
        </div>
        <ExplorerFilters dataset={data} value={filters} onChange={updateFilter} onReset={reset} />
        {events.isError ? (
          <div className="p-4"><ErrorState error={events.error} onRetry={() => events.refetch()} /></div>
        ) : events.isLoading ? (
          <div className="p-4"><LoadingBlock rows={6} /></div>
        ) : (
          <>
            <DataTableShell>
              <table data-testid="event-table" className="w-full min-w-[1050px] text-xs">
                <thead><tr className="border-b border-border bg-elevated/40">{["Event ID", "Timestamp (UTC)", "Phase", "Partition", "Original", "Contextual", "Tactics", "E2-D score", "E2-D pred.", "Seen", "Description"].map((h) => <th key={h} className="px-2.5 py-2 text-left text-[9px] uppercase tracking-wider text-muted-foreground">{h}</th>)}</tr></thead>
                <tbody>
                  {(pageData?.items ?? []).map((event) => (
                    <tr key={`${event.phase}-${event.event_id}`} onClick={() => setDetail(event)} className="cursor-pointer border-b border-border last:border-0 hover:bg-elevated/50">
                      <td className="px-2.5 py-2 font-mono text-[9px] text-primary">{event.event_id}</td>
                      <td className="px-2.5 py-2 font-mono text-[9px] text-muted-foreground">{formatDateTime(event.timestamp)}</td>
                      <td className="px-2.5 py-2 font-mono text-[9px]">{event.phase}</td>
                      <td className="px-2.5 py-2 text-[9px] text-muted-foreground">{event.split?.replace("_", " ")}</td>
                      <td className="px-2.5 py-2"><Badge variant={event.original_label === 1 ? "error" : "outline"}>{event.original_label}</Badge></td>
                      <td className="px-2.5 py-2"><Badge variant={event.contextual_label === 1 ? "warning" : "outline"}>{event.contextual_label}</Badge></td>
                      <td className="max-w-[150px] truncate px-2.5 py-2 text-[9px] text-muted-foreground">{event.original_tactics.join(", ") || event.contextual_tactics.join(", ") || "—"}</td>
                      <td className="px-2.5 py-2 font-mono text-[9px]">{event.anomaly_score === null ? "—" : event.anomaly_score.toExponential(3)}</td>
                      <td className="px-2.5 py-2">{event.prediction === null ? "—" : <Badge variant={event.prediction === 1 ? "warning" : "outline"}>{event.prediction === 1 ? "alert" : "normal"}</Badge>}</td>
                      <td className="px-2.5 py-2 text-[9px] text-muted-foreground">{event.seen_in_training === null ? "—" : event.seen_in_training ? "yes" : "no"}</td>
                      <td className="max-w-[320px] truncate px-2.5 py-2 font-mono text-[9px] text-muted-foreground">{truncate(event.text ?? "", 90)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>
            {pageData && pageData.items.length === 0 && (
              <div className="p-6 text-center text-xs text-muted-foreground">No events match the current filters.</div>
            )}
            {pageData && (
              <PaginationBar page={pageData.page} totalPages={pageData.total_pages} total={pageData.total} pageSize={pageData.page_size} onPageChange={setPage} />
            )}
          </>
        )}
        <div className="border-t border-border px-3 py-2 text-[9px] leading-relaxed text-muted-foreground">
          <Filter className="mr-1 inline size-3" /> Filters and pagination are executed by the FastAPI backend. The frontend never loads the full 243,271-event dataset. Click a row to inspect the complete verbalisation.
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <SourceNote source="data/processed/cicapt-iiot-v2/phase1_events.parquet" />
        <SourceNote source="data/processed/cicapt-iiot-v2/phase2_events.parquet" />
        <SourceNote source="data/splits/cicapt-iiot/event_split_manifest.parquet" />
        <SourceNote source="results/e2d-unique-matched/evaluation/attack_test_predictions.parquet" />
      </div>
      <EventDrawer event={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
