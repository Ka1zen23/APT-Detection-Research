import type {
  AblationData,
  AlertBudgetPayload,
  ArchitectureData,
  CurvePayload,
  DatasetSummary,
  Envelope,
  EnvironmentData,
  EventPage,
  ExperimentDetail,
  ExperimentSummary,
  Finding,
  HealthData,
  JournalEntry,
  JournalEntryMeta,
  Limitation,
  MethodologyData,
  ModelRow,
  Objective,
  OverviewData,
  ReportItem,
  ResearchStatus,
  Roadmap,
  ThresholdPayload,
} from "@/types/api";

const configuredBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
const API_BASE = configuredBase ? configuredBase.replace(/\/$/, "") : "/api/v1";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function buildQuery(params?: Record<string, unknown>): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

async function request<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE}${path}${buildQuery(params)}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) message = payload.detail;
    } catch {
      // Keep the status-based message.
    }
    throw new ApiError(message, response.status);
  }
  const payload = (await response.json()) as Envelope<T>;
  return payload.data;
}

export interface EventFilters {
  [key: string]: unknown;
  phase?: string;
  split?: string;
  event_id?: string;
  original_label?: number;
  contextual_label?: number;
  tactic?: string;
  min_score?: number;
  max_score?: number;
  prediction?: number;
  seen?: boolean;
  timestamp_from?: number;
  timestamp_to?: number;
  search?: string;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export const api = {
  overview: () => request<OverviewData>("/overview"),
  status: () => request<ResearchStatus>("/status"),
  objectives: () => request<{ objectives: Objective[] }>("/objectives"),
  experiments: (params?: { status?: string; group?: string }) =>
    request<ExperimentSummary[]>("/experiments", params),
  experiment: (id: string) => request<ExperimentDetail>(`/experiments/${encodeURIComponent(id)}`),
  experimentMetrics: (id: string) =>
    request<{ experiment_id: string; available: boolean; metrics?: ModelRow; reason?: string }>(
      `/experiments/${encodeURIComponent(id)}/metrics`,
    ),
  thresholds: (id: string) =>
    request<ThresholdPayload>(`/experiments/${encodeURIComponent(id)}/thresholds`),
  alertBudgets: (id: string) =>
    request<AlertBudgetPayload>(`/experiments/${encodeURIComponent(id)}/alert-budgets`),
  curves: (id: string, label: "original" | "contextual" = "original") =>
    request<CurvePayload>(`/experiments/${encodeURIComponent(id)}/curves`, { label }),
  figures: (id: string) =>
    request<{ experiment_id: string; figures: ExperimentDetail["figures"] }>(
      `/experiments/${encodeURIComponent(id)}/figures`,
    ),
  modelComparison: () =>
    request<{ models: ModelRow[]; leaderboard: ModelRow[]; note: string }>("/comparisons/models"),
  ablation: () => request<AblationData>("/comparisons/ablation"),
  descriptionOverlap: () =>
    request<{
      models: {
        id: string;
        name: string;
        seen: Record<string, number | null>;
        unseen: Record<string, number | null>;
      }[];
      note: string;
      source_artifacts: string[];
    }>("/comparisons/description-overlap"),
  dataset: () => request<DatasetSummary>("/dataset/summary"),
  events: (filters: EventFilters) => request<EventPage>("/dataset/events", filters),
  event: (phase: string, eventId: string) =>
    request<Record<string, unknown>>(
      `/dataset/events/${encodeURIComponent(phase)}/${encodeURIComponent(eventId)}`,
    ),
  findings: () => request<{ findings: Finding[]; count: number }>("/findings"),
  roadmap: () => request<Roadmap>("/roadmap"),
  journal: () => request<{ entries: JournalEntryMeta[] }>("/journal"),
  journalEntry: (slug: string) =>
    request<JournalEntry>(`/journal/${encodeURIComponent(slug)}`),
  reports: () =>
    request<{ reports: ReportItem[]; available: number; documents: Record<string, unknown>[] }>(
      "/reports",
    ),
  environment: () => request<EnvironmentData>("/environment"),
  methodology: () => request<MethodologyData>("/methodology"),
  limitations: () =>
    request<{ limitations: Limitation[]; counts: Record<string, number> }>("/limitations"),
  architecture: () => request<ArchitectureData>("/architecture"),
  health: () => request<HealthData>("/health"),
  refreshCache: async () => {
    const response = await fetch(`${API_BASE}/cache/refresh`, { method: "POST" });
    if (!response.ok) throw new ApiError("Cache refresh failed", response.status);
    return (await response.json()) as Envelope<Record<string, unknown>>;
  },
};

export function figureUrl(key: string): string {
  const [run, ...rest] = key.split(":");
  return `${API_BASE}/artifacts/figures/${encodeURIComponent(run)}/${encodeURIComponent(rest.join(":"))}`;
}

export function documentUrl(key: string): string {
  return `${API_BASE}/artifacts/documents/${encodeURIComponent(key)}`;
}
