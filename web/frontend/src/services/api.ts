import type {
  AblationData,
  AlertBudgetPayload,
  ArchitectureData,
  CurvePayload,
  DatasetSummary,
  EmbeddingProjection,
  EmbeddingSplit,
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
  MatchedProvenanceEvents,
  MethodologyData,
  ModelRow,
  Objective,
  OverviewData,
  ProvenanceGraphData,
  ReportItem,
  ResearchStatus,
  Roadmap,
  ScoreHistogram,
  ThresholdPayload,
  TrainingComparison,
} from "@/types/api";

const configuredBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
const API_BASE = configuredBase ? configuredBase.replace(/\/$/, "") : "/api/v1";
const configuredMode = (import.meta.env.VITE_DATA_MODE as string | undefined)?.trim().toLowerCase();
export const DATA_MODE = configuredMode || (import.meta.env.PROD ? "static" : "api");
export const isStaticDataMode = DATA_MODE === "static";
const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");
const STATIC_DATA_ROOT = `${BASE_PATH}/data`;
const STATIC_ARTIFACT_ROOT = `${BASE_PATH}/artifacts`;

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

function staticPath(path: string, params?: Record<string, unknown>): string {
  const clean = path.replace(/\/+$/, "");
  const parts = clean.split("/").filter(Boolean);

  if (clean === "/overview") return "overview.json";
  if (clean === "/status") return "status.json";
  if (clean === "/objectives") return "objectives.json";
  if (clean === "/experiments") return "experiments.json";
  if (clean === "/comparisons/models") return "comparisons/models.json";
  if (clean === "/comparisons/ablation") return "comparisons/ablation.json";
  if (clean === "/comparisons/training") return "comparisons/training.json";
  if (clean === "/comparisons/description-overlap") {
    return "comparisons/description-overlap.json";
  }
  if (clean === "/dataset/summary") return "dataset-summary.json";
  if (clean.startsWith("/dataset/events")) {
    throw new ApiError(
      "Event-level provenance is not included in the static cloud deployment.",
      410,
    );
  }
  if (clean === "/findings") return "findings.json";
  if (clean === "/roadmap") return "roadmap.json";
  if (clean === "/journal") return "journal.json";
  if (clean === "/reports") return "reports.json";
  if (clean === "/environment") return "environment.json";
  if (clean === "/methodology") return "methodology.json";
  if (clean === "/limitations") return "limitations.json";
  if (clean === "/architecture") return "architecture.json";
  if (clean === "/health") return "health.json";

  if (parts[0] === "experiments" && parts[1]) {
    const id = decodeURIComponent(parts[1]);
    if (parts.length === 2) return `experiments/${id}.json`;
    if (parts.length === 3 && parts[2] === "metrics") {
      return `experiments/${id}/metrics.json`;
    }
    if (parts.length === 3 && parts[2] === "figures") {
      return `experiments/${id}/figures.json`;
    }
    if (parts.length === 3 && parts[2] === "thresholds") {
      return `thresholds/${id}.json`;
    }
    if (parts.length === 3 && parts[2] === "alert-budgets") {
      return `alert-budgets/${id}.json`;
    }
    if (parts.length === 3 && parts[2] === "score-histogram") {
      return `score-histograms/${id}.json`;
    }
    if (parts.length === 3 && parts[2] === "curves") {
      const label = String(params?.label ?? "original");
      return `curves/${id}-${label}.json`;
    }
  }

  if (parts[0] === "journal" && parts[1]) {
    return `journal/${decodeURIComponent(parts[1])}.json`;
  }

  throw new ApiError(`No static snapshot exists for ${path}`, 404);
}

async function staticRequest<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const relative = staticPath(path, params);
  const response = await fetch(`${STATIC_DATA_ROOT}/${relative}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new ApiError(
      `The static data snapshot is missing ${relative}. Regenerate it with export_static_site.py.`,
      response.status,
    );
  }
  const payload = (await response.json()) as Envelope<T>;
  return payload.data;
}

async function request<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  if (isStaticDataMode) return staticRequest<T>(path, params);

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
  scoreHistogram: (id: string) =>
    request<ScoreHistogram>(`/experiments/${encodeURIComponent(id)}/score-histogram`),
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
  trainingComparison: () => request<TrainingComparison>("/comparisons/training"),
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
  embeddingProjection: (split: EmbeddingSplit) =>
    request<EmbeddingProjection>("/dataset/events/embedding-projection", { split }),
  events: (filters: EventFilters) => request<EventPage>("/dataset/events", filters),
  event: (phase: string, eventId: string) =>
    request<Record<string, unknown>>(
      `/dataset/events/${encodeURIComponent(phase)}/${encodeURIComponent(eventId)}`,
    ),
  provenance: (phase: string, eventId: string) => request<ProvenanceGraphData>(
    `/dataset/events/${encodeURIComponent(phase)}/${encodeURIComponent(eventId)}/graph`,
  ),
  matchedProvenance: () => request<MatchedProvenanceEvents>("/dataset/events/matched-representations"),
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
    if (isStaticDataMode) {
      return {
        data: {
          refreshed: false,
          scope: "Static aggregate snapshot",
          filesystem_modified: false,
        },
        meta: {
          generated_at: new Date().toISOString(),
          last_artifact_update: null,
          data_mode: "static_snapshot",
          warnings: ["Static snapshots update only after re-export and redeploy."],
        },
      } as Envelope<Record<string, unknown>>;
    }
    const response = await fetch(`${API_BASE}/cache/refresh`, { method: "POST" });
    if (!response.ok) throw new ApiError("Cache refresh failed", response.status);
    return (await response.json()) as Envelope<Record<string, unknown>>;
  },
};

export function figureUrl(key: string): string {
  const [run, ...rest] = key.split(":");
  const filename = rest.join(":");
  if (isStaticDataMode) {
    return `${STATIC_ARTIFACT_ROOT}/figures/${encodeURIComponent(run)}/${encodeURIComponent(filename)}`;
  }
  return `${API_BASE}/artifacts/figures/${encodeURIComponent(run)}/${encodeURIComponent(filename)}`;
}

export function documentUrl(key: string): string {
  if (isStaticDataMode) {
    return `${STATIC_ARTIFACT_ROOT}/documents/${encodeURIComponent(key)}.txt`;
  }
  return `${API_BASE}/artifacts/documents/${encodeURIComponent(key)}`;
}
