import { useQueries } from "@tanstack/react-query";
import { api } from "@/services/api";
import { modelColour } from "@/lib/model-colours";
import type { CSSProperties } from "react";

type PreviewRow = { id: string; value?: number | null };

export function FindingPreview({ title, mode, rows, maximum, highlight }: {
  title: string;
  mode: "bar" | "dot" | "queue";
  rows: PreviewRow[];
  maximum?: number | null;
  highlight?: string;
}) {
  const available = rows.filter((row): row is { id: string; value: number } => row.value != null && Number.isFinite(row.value));
  const max = Math.max(maximum ?? 0, ...available.map(({ value }) => value), Number.EPSILON);
  const precision = mode === "queue" ? 0 : 6;
  return <figure className="pub-finding-preview" data-mode={mode}>
    <figcaption>{title}</figcaption>
    {available.length ? <>
      <ul>{available.map(({ id, value }) => <li key={id} data-highlight={id === highlight || undefined} style={{ "--preview-colour": modelColour(id) } as CSSProperties}>
        <strong>{id}</strong>
        <span className="pub-preview-track" aria-hidden="true"><span style={{ width: `${100 * value / max}%` }} /></span>
        <span>{mode === "queue" && !Number.isInteger(value) ? value.toFixed(2) : value.toFixed(precision)}</span>
      </li>)}</ul>
      <p>{mode === "queue" ? maximum != null ? `Scale: 0–${maximum} originally annotated positives.` : "Scale uses the largest available expected count." : "Zero baseline · scale ends at the highest shown score."}</p>
    </> : <p>Measured values unavailable.</p>}
  </figure>;
}

export function Top500Preview({ maximum }: { maximum?: number }) {
  const ids = ["E2-A", "E2-B", "E2-C", "E2-D"];
  const results = useQueries({ queries: ids.map((id) => ({ queryKey: ["budgets", id], queryFn: () => api.alertBudgets(id) })) });
  return <FindingPreview title="Expected positives within 500 reviewed alerts" mode="queue" maximum={maximum}
    rows={ids.map((id, index) => ({ id, value: results[index].data?.rows?.find(({ budget }) => budget === 500)?.expected_true_positives }))} />;
}
