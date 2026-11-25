import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CircleAlert,
  FlaskConical,
  Search,
} from "lucide-react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  EmptyState,
  ErrorState,
  InfoCallout,
  KpiCard,
  LoadingBlock,
  PageHeader,
  StatusBadge,
} from "@/components/features/common";
import { useExperiments } from "@/hooks/queries";
import { formatDecimal, formatNumber, titleCase } from "@/lib/format";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { ExperimentScatter } from "@/components/charts/ExperimentScatter";
import type { ExperimentSummary } from "@/types/api";

const columnHelper = createColumnHelper<ExperimentSummary>();

function SortHeader({
  label,
  sorted,
  onClick,
  align = "left",
}: {
  label: string;
  sorted: false | "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-8 items-center gap-1 whitespace-nowrap ${align === "right" ? "ml-auto" : ""} transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
    >
      {label}
      {sorted === "asc" ? (
        <ArrowUp className="size-3" />
      ) : sorted === "desc" ? (
        <ArrowDown className="size-3" />
      ) : (
        <ArrowUpDown className="size-3 opacity-50" />
      )}
    </button>
  );
}

export function ExperimentsPage() {
  const { data, isLoading, error, refetch } = useExperiments();
  const [sorting, setSorting] = useState<SortingState>([{ id: "id", desc: false }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");

  const experiments = data ?? [];
  const filtered = useMemo(
    () =>
      experiments.filter((experiment) => {
        const matchesStatus = statusFilter === "all" || experiment.status === statusFilter;
        const matchesGroup = groupFilter === "all" || experiment.group === groupFilter;
        return matchesStatus && matchesGroup;
      }),
    [experiments, statusFilter, groupFilter],
  );

  const groups = useMemo(
    () => Array.from(new Set(experiments.map((experiment) => experiment.group))).sort(),
    [experiments],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor("id", {
        header: ({ column }) => (
          <SortHeader
            label="ID"
            sorted={column.getIsSorted()}
            onClick={() => column.toggleSorting()}
          />
        ),
        cell: (info) => (
          <Link
            to={`/experiments/${info.getValue()}`}
            className="whitespace-nowrap font-mono text-[12px] font-medium text-primary hover:underline"
          >
            {info.getValue()}
          </Link>
        ),
        size: 70,
      }),
      columnHelper.accessor("name", {
        header: "Experiment",
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="max-w-[360px]">
              <Link
                to={`/experiments/${row.id}`}
                className="line-clamp-1 text-[13px] font-medium text-foreground hover:text-primary"
              >
                {info.getValue()}
              </Link>
              <div className="line-clamp-1 text-[12px] text-muted-foreground">
                {row.research_question}
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor("group", {
        header: "Group",
        cell: (info) => <Badge variant="outline">{titleCase(info.getValue())}</Badge>,
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => <StatusBadge status={info.getValue()} />,
      }),
      columnHelper.accessor("roc_auc", {
        header: ({ column }) => (
          <SortHeader
            label="ROC-AUC"
            align="right"
            sorted={column.getIsSorted()}
            onClick={() => column.toggleSorting()}
          />
        ),
        cell: (info) => (
          <div className="text-right font-mono text-[12px] tabular">
            {formatDecimal(info.getValue(), 4)}
          </div>
        ),
        sortingFn: (a, b) => (a.original.roc_auc ?? -1) - (b.original.roc_auc ?? -1),
      }),
      columnHelper.accessor("average_precision", {
        header: ({ column }) => (
          <SortHeader
            label="AP"
            align="right"
            sorted={column.getIsSorted()}
            onClick={() => column.toggleSorting()}
          />
        ),
        cell: (info) => (
          <div className="text-right font-mono text-[12px] tabular">
            {formatDecimal(info.getValue(), 4)}
          </div>
        ),
        sortingFn: (a, b) => (a.original.average_precision ?? -1) - (b.original.average_precision ?? -1),
      }),
      columnHelper.accessor("recall", {
        header: "Recall",
        cell: (info) => (
          <div className="text-right font-mono text-[12px] tabular">
            {info.getValue() === null || info.getValue() === undefined
              ? "n/a"
              : `${(info.getValue()! * 100).toFixed(1)}%`}
          </div>
        ),
      }),
      columnHelper.display({
        id: "artifacts",
        header: "",
        cell: (info) =>
          info.row.original.warnings?.length ? (
            <span title={info.row.original.warnings[0]}>
              <CircleAlert className="size-3.5 text-warning" />
            </span>
          ) : info.row.original.availability?.status === "available" ? (
            <span className="size-1.5 rounded-full bg-success" title="Measured artifact available" />
          ) : (
            <span className="size-1.5 rounded-full bg-muted-foreground/40" title="No measured metrics" />
          ),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, value) => {
      const query = String(value).toLowerCase();
      const item = row.original;
      return [item.id, item.name, item.group, item.algorithm, item.representation, item.status]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(query));
    },
  });

  if (isLoading) return <LoadingBlock rows={8} />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;

  const completed = experiments.filter((experiment) => experiment.status === "completed").length;
  const measured = experiments.filter((experiment) => experiment.roc_auc !== null).length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Experiments, Registry"
        title="Experiment registry"
        description="Central record of baselines, autoencoder variants, analytical studies and representation ablations. Status is maintained in web/content/experiments.json; measured metrics are merged from result artifacts."
        actions={
          <Badge variant="outline" className="font-mono">
            {experiments.length} entries
          </Badge>
        }
      />

      <InfoCallout tone="info" title="How to read this registry">
        Status is maintained content; AP and ROC-AUC are merged from saved artifacts. n/a means no
        measured metric, not zero. Ranking metrics do not describe a deployment threshold.{" "}
        <Link className="font-medium text-primary underline underline-offset-4" to="/glossary">
          Glossary
        </Link>
        .
      </InfoCallout>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Registered entries"
          value={formatNumber(experiments.length)}
          definition="Models, analyses and planned work in the registry."
          source="web/content/experiments.json"
        />
        <KpiCard
          label="Completed"
          value={formatNumber(completed)}
          definition="Entries marked completed, including two analytical studies."
          tone="success"
          source="web/content/experiments.json"
        />
        <KpiCard
          label="Measured model rows"
          value={formatNumber(measured)}
          definition="Rows with ROC-AUC and AP loaded from saved artifacts."
          tone="accent"
          source="results/autoencoder_comparison/ranking_summary.csv"
        />
        <KpiCard
          label="Next activity"
          value="E7"
          definition="Multiple-seed reproducibility with seeds 42, 123 and 456."
          tone="warning"
          source="web/content/roadmap.json"
        />
      </div>

      <ChartFrame
        title="Ranking shape across measured models"
        description="ROC-AUC against Average Precision. The top-right corner is better on both axes. E2-D is highlighted; the other measured models are in cool blue. A ranking metric is not a deployment recommendation."
        source="results/autoencoder_comparison/ranking_summary.csv; results/baselines/baseline_summary.json"
        glossaryId="average-precision"
        footnote="Each point is one measured configuration. Hover or focus a point for its ID, group and exact values. The registry table below carries the full metadata."
      >
        <ExperimentScatter experiments={experiments} />
      </ChartFrame>

      <Card>
        <div className="flex flex-col gap-2 border-b border-border p-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder="Search ID, experiment, algorithm or representation…"
              className="pl-8"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
              className="w-[150px]"
            >
              <option value="all">All statuses</option>
              <option value="completed">Completed</option>
              <option value="in_progress">In progress</option>
              <option value="next">Next</option>
              <option value="planned">Planned</option>
            </Select>
            <Select
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value)}
              aria-label="Filter by group"
              className="w-[160px]"
            >
              <option value="all">All groups</option>
              {groups.map((group) => (
                <option key={group} value={group}>
                  {titleCase(group)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {table.getRowModel().rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No experiments match these filters"
              description="Clear the search or status filters to view the full registry."
              icon={<FlaskConical className="size-6" />}
            />
          </div>
        ) : (
          <>
            <p className="px-4 pt-3 text-[12px] text-muted-foreground sm:hidden">
              Scroll the table horizontally to see every column.
            </p>
            <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} style={{ width: header.getSize() }}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
            </Table>
          </>
        )}
        <div className="flex flex-wrap items-center gap-3 border-t border-border px-3 py-2 text-[12px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-success" /> measured artifact available
          </span>
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-muted-foreground/40" /> no measured metrics
          </span>
          <span className="flex items-center gap-1">
            <CircleAlert className="size-3 text-warning" /> status requires verification
          </span>
        </div>
      </Card>
    </div>
  );
}
