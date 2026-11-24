import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const CHART_COLORS = [
  "var(--primary)",
  "var(--success)",
  "var(--warning)",
  "var(--error)",
  "#8b5cf6",
  "#0891b2",
  "#db2777",
  "#65a30d",
];

export const CHART_AXIS = {
  stroke: "var(--muted-foreground)",
  fontSize: 10,
  tickLine: false,
  axisLine: false,
} as const;

export const CHART_GRID = {
  stroke: "var(--border)",
  strokeDasharray: "3 3",
  vertical: false,
} as const;

export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
}: {
  active?: boolean;
  payload?: readonly { name?: string; value?: number | string; color?: string; dataKey?: string }[];
  label?: string | number;
  formatter?: (value: number | string, name: string) => string;
  labelFormatter?: (label: string | number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-elevated px-2.5 py-2 shadow-md">
      {label !== undefined && (
        <div className="mb-1 font-mono text-[10px] text-muted-foreground">
          {labelFormatter ? labelFormatter(label) : label}
        </div>
      )}
      <div className="space-y-0.5">
        {payload.map((item, index) => (
          <div key={`${item.dataKey ?? item.name}-${index}`} className="flex items-center gap-2 text-[11px]">
            <span
              className="size-1.5 rounded-full"
              style={{ backgroundColor: item.color ?? "var(--primary)" }}
            />
            <span className="text-muted-foreground">{item.name}</span>
            <span className="ml-auto font-mono tabular text-foreground">
              {formatter
                ? formatter(item.value ?? "", item.name ?? "")
                : typeof item.value === "number"
                  ? item.value.toLocaleString()
                  : item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PaginationBar({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  className,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2", className)}>
      <div className="text-[11px] text-muted-foreground">
        Showing <span className="font-mono tabular text-foreground">{start.toLocaleString()}</span>–
        <span className="font-mono tabular text-foreground">{end.toLocaleString()}</span> of{" "}
        <span className="font-mono tabular text-foreground">{total.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft />
        </Button>
        <span className="min-w-20 text-center font-mono text-[11px] text-muted-foreground">
          {page} / {Math.max(totalPages, 1)}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

export function ConfusionMatrix({
  tp,
  fp,
  fn,
  tn,
  positiveLabel = "Original positive",
  negativeLabel = "Negative",
  compact = false,
}: {
  tp: number | null;
  fp: number | null;
  fn: number | null;
  tn: number | null;
  positiveLabel?: string;
  negativeLabel?: string;
  compact?: boolean;
}) {
  const cell = (value: number | null, tone: "good" | "bad" | "neutral", label: string) => (
    <div
      className={cn(
        "rounded border px-2 py-1.5 text-center",
        tone === "good" && "border-success/25 bg-success/5",
        tone === "bad" && "border-error/25 bg-error/5",
        tone === "neutral" && "border-border bg-elevated/60",
      )}
    >
      <div className="font-mono text-sm font-semibold tabular text-foreground">
        {value === null ? "—" : value.toLocaleString()}
      </div>
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-[80px_1fr_1fr] items-center gap-1.5 text-[9px] uppercase tracking-wide text-muted-foreground">
        <div />
        <div className="text-center">Predicted positive</div>
        <div className="text-center">Predicted negative</div>
      </div>
      <div className="grid grid-cols-[80px_1fr_1fr] items-center gap-1.5">
        <div className="text-right text-[9px] uppercase tracking-wide text-muted-foreground">
          {positiveLabel}
        </div>
        {cell(tp, "good", "True positive")}
        {cell(fn, "bad", "False negative")}
      </div>
      <div className="grid grid-cols-[80px_1fr_1fr] items-center gap-1.5">
        <div className="text-right text-[9px] uppercase tracking-wide text-muted-foreground">
          {negativeLabel}
        </div>
        {cell(fp, "bad", "False positive")}
        {cell(tn, "neutral", "True negative")}
      </div>
      {!compact && (
        <div className="pt-0.5 text-[10px] leading-relaxed text-muted-foreground">
          Cells show measured event counts at the displayed operating point. False positives dominate
          because original positives are only 0.069% of the attack test.
        </div>
      )}
    </div>
  );
}
