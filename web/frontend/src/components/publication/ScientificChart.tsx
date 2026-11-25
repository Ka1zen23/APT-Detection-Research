import { useId, useRef, useState, type ReactNode } from "react";
import { Download, Maximize2, X } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_AXIS, CHART_GRID, ChartTooltip } from "@/components/features/data";
import { modelColour } from "@/lib/model-colours";
export { modelColour } from "@/lib/model-colours";

export const e2Ids = ["E2-A", "E2-B", "E2-C", "E2-D"];
export const e5Ids = ["B5", "E5-A", "E5-B", "E5-C"];
export const scientificNumber = (value: number) => value === 0 ? "0" : value.toExponential(2);
export const countLabel = (value: number) => value.toLocaleString("en-GB", { maximumFractionDigits: 2 });
export const percentLabel = (value: number) => `${countLabel(value * 100)}%`;

export type CellValue = string | number | null | undefined;
export interface ChartTable {
  columns: string[];
  rows: CellValue[][];
}

function downloadCsv(filename: string, table: ChartTable) {
  const cells = (row: CellValue[]) => row.map((cell) => {
    if (cell == null) return "";
    if (typeof cell === "number") return String(cell);
    const safe = /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell;
    return `"${safe.replaceAll('"', '""')}"`;
  }).join(",");
  const file = new Blob([[cells(table.columns), ...table.rows.map(cells)].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ScientificChart({ title, unit, interpretation, sources = [], filename, table, chart, children, minPlotHeight }: {
  title: string;
  unit: string;
  interpretation: string;
  sources?: (string | null | undefined)[];
  filename: string;
  table: ChartTable;
  chart: (expanded: boolean) => ReactNode;
  children?: ReactNode;
  minPlotHeight?: number;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const [expanded, setExpanded] = useState(false);
  const [showRows, setShowRows] = useState(false);
  const available = table.rows.length > 0;
  return <figure className="pub-scientific-chart">
    <figcaption>
      <div><h3>{title}</h3><p className="pub-chart-unit">{unit}</p></div>
      {available && <button type="button" className="pub-segment pub-chart-action" aria-label={`Expand ${title}`} onClick={() => { dialog.current?.showModal(); setExpanded(true); }}><Maximize2 size={15} aria-hidden="true" /> Expand</button>}
    </figcaption>
    {children}
    {available ? <div className="pub-chart-plot" style={{ minHeight: minPlotHeight }}>{chart(false)}</div> : <p className="pub-prose">No measured values are available for this selection.</p>}
    <p className="pub-chart-interpretation">{interpretation}</p>
    {available && <details className="pub-disclosure pub-chart-data" onToggle={(event) => setShowRows(event.currentTarget.open)}>
      <summary>Data table and source</summary>
      {showRows && <div>
        <button className="pub-segment pub-chart-action" type="button" onClick={() => downloadCsv(filename, table)}><Download size={15} aria-hidden="true" /> Download CSV</button>
        <div className="pub-chart-table" tabIndex={0} role="region" aria-label={`${title} data table`}>
          <table><thead><tr>{table.columns.map((column) => <th scope="col" key={column}>{column}</th>)}</tr></thead>
            <tbody>{table.rows.map((row, index) => <tr key={index}>{row.map((value, cell) => <td key={cell}>{typeof value === "number" ? String(value) : value ?? "—"}</td>)}</tr>)}</tbody>
          </table>
        </div>
        {[...new Set(sources.filter(Boolean))].map((source) => <p key={source} className="pub-chart-source">Source: <code>{source}</code></p>)}
      </div>}
    </details>}
    <dialog className="pub-chart-dialog" ref={dialog} aria-labelledby={heading} onClose={() => setExpanded(false)}>
      <div className="pub-chart-dialog-head"><h3 id={heading}>{title}</h3>
        <button className="pub-icon" type="button" aria-label="Close expanded chart" onClick={() => dialog.current?.close()}><X size={18} /></button></div>
      <p className="pub-chart-unit">{unit}</p>
      {expanded && <div className="pub-chart-plot" data-expanded="true" style={{ minHeight: minPlotHeight }}>{chart(true)}</div>}
      {expanded && <p className="pub-chart-interpretation">{interpretation}</p>}
    </dialog>
  </figure>;
}

export interface LineSeries { key: string; label: string; colour: string; dashed?: boolean }

export function ScientificLines<T extends object>({ rows, xKey, series, xFormat, yFormat = countLabel, domain, selected, reference, pointOnly = false, log = false }: {
  rows: T[];
  xKey: Extract<keyof T, string>;
  series: LineSeries[];
  xFormat?: (x: number) => string;
  yFormat?: (y: number) => string;
  domain?: [number, number | "auto"];
  selected?: number;
  reference?: number;
  pointOnly?: boolean;
  log?: boolean;
}) {
  return <ResponsiveContainer width="100%" height="100%">
    <LineChart data={rows} margin={{ top: 20, right: 16, bottom: 6, left: 2 }}>
      <CartesianGrid {...CHART_GRID} />
      <XAxis {...CHART_AXIS} dataKey={xKey} type={log ? "number" : "category"} scale={log ? "log" : "auto"}
        domain={log ? ["dataMin", "dataMax"] : undefined} ticks={log ? rows.map((row) => Number(row[xKey])) : undefined}
        tickFormatter={(value) => xFormat ? xFormat(Number(value)) : String(value)} />
      <YAxis {...CHART_AXIS} width={56} domain={domain ?? [0, "auto"]} tickFormatter={yFormat} />
      <Tooltip content={<ChartTooltip formatter={(value) => yFormat(Number(value))} labelFormatter={(value) => xFormat ? xFormat(Number(value)) : String(value)} />} />
      {reference !== undefined && <ReferenceLine x={reference} stroke="var(--warning)" strokeDasharray="4 3" />}
      {selected !== undefined && <ReferenceLine x={selected} stroke="var(--primary)" />}
      {series.map(({ key, label, colour, dashed }) => <Line type="linear" key={key} name={label} dataKey={key}
        stroke={colour} strokeOpacity={pointOnly ? 0 : 1} strokeWidth={2} strokeDasharray={dashed ? "5 4" : undefined}
        dot={pointOnly || rows.length <= 30 ? { r: 3, strokeOpacity: 1 } : false} connectNulls={false} isAnimationActive={false} />)}
    </LineChart>
  </ResponsiveContainer>;
}

export function ScientificLegend({ items, active, onToggle, label = "Chart series" }: {
  items: { id: string; label?: string; colour?: string }[];
  active: readonly string[];
  onToggle: (id: string) => void;
  label?: string;
}) {
  return <div className="pub-chart-legend" role="group" aria-label={label}>
    {items.map(({ id, label, colour }) => <button key={id} type="button" className="pub-segment" aria-pressed={active.includes(id)} onClick={() => onToggle(id)}>
      <span aria-hidden="true" style={{ background: colour ?? modelColour(id) }} />{label ?? id}
    </button>)}
  </div>;
}

export function toggleSeries(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}
