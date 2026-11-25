import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type EventFilters } from "@/services/api";

export const queryKeys = {
  overview: ["overview"] as const,
  researchStatus: ["research-status"] as const,
  experiments: (params?: { status?: string; group?: string }) => ["experiments", params] as const,
  experiment: (id: string) => ["experiment", id] as const,
  comparison: ["comparison"] as const,
  ablation: ["ablation"] as const,
  trainingComparison: ["training-comparison"] as const,
  scoreHistogram: (id: string) => ["score-histogram", id] as const,
  descriptionOverlap: ["description-overlap"] as const,
  dataset: ["dataset"] as const,
  events: (filters: EventFilters) => ["events", filters] as const,
  findings: ["findings"] as const,
  roadmap: ["roadmap"] as const,
  journal: ["journal"] as const,
  journalEntry: (slug: string) => ["journal", slug] as const,
  reports: ["reports"] as const,
  environment: ["environment"] as const,
  methodology: ["methodology"] as const,
  limitations: ["limitations"] as const,
  architecture: ["architecture"] as const,
  objectives: ["objectives"] as const,
  health: ["health"] as const,
  thresholds: (id: string) => ["thresholds", id] as const,
  budgets: (id: string) => ["budgets", id] as const,
  curves: (id: string, label: string) => ["curves", id, label] as const,
};

export function useOverview() {
  return useQuery({ queryKey: queryKeys.overview, queryFn: api.overview });
}

export function useResearchStatus() {
  return useQuery({ queryKey: queryKeys.researchStatus, queryFn: api.status });
}

export function useExperiments(
  params?: { status?: string; group?: string },
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.experiments(params),
    queryFn: () => api.experiments(params),
    enabled,
  });
}

export function useExperiment(id: string) {
  return useQuery({
    queryKey: queryKeys.experiment(id),
    queryFn: () => api.experiment(id),
    enabled: Boolean(id),
  });
}

export function useModelComparison() {
  return useQuery({ queryKey: queryKeys.comparison, queryFn: api.modelComparison });
}

export function useAblation(enabled = true) {
  return useQuery({ queryKey: queryKeys.ablation, queryFn: api.ablation, enabled });
}

export function useTrainingComparison() {
  return useQuery({ queryKey: queryKeys.trainingComparison, queryFn: api.trainingComparison });
}

export function useScoreHistogram(id: string) {
  return useQuery({ queryKey: queryKeys.scoreHistogram(id), queryFn: () => api.scoreHistogram(id), enabled: Boolean(id) });
}

export function useDescriptionOverlap() {
  return useQuery({
    queryKey: queryKeys.descriptionOverlap,
    queryFn: api.descriptionOverlap,
  });
}

export function useDataset() {
  return useQuery({
    queryKey: queryKeys.dataset,
    queryFn: api.dataset,
    staleTime: 5 * 60 * 1000,
  });
}

export function useEvents(filters: EventFilters) {
  return useQuery({
    queryKey: queryKeys.events(filters),
    queryFn: () => api.events(filters),
    placeholderData: (previous) => previous,
  });
}

export function useFindings(enabled = true) {
  return useQuery({ queryKey: queryKeys.findings, queryFn: api.findings, enabled });
}

export function useRoadmap() {
  return useQuery({ queryKey: queryKeys.roadmap, queryFn: api.roadmap });
}

export function useJournal() {
  return useQuery({ queryKey: queryKeys.journal, queryFn: api.journal });
}

export function useJournalEntry(slug: string) {
  return useQuery({
    queryKey: queryKeys.journalEntry(slug),
    queryFn: () => api.journalEntry(slug),
    enabled: Boolean(slug),
  });
}

export function useReports() {
  return useQuery({ queryKey: queryKeys.reports, queryFn: api.reports });
}

export function useEnvironment() {
  return useQuery({ queryKey: queryKeys.environment, queryFn: api.environment });
}

export function useMethodology() {
  return useQuery({ queryKey: queryKeys.methodology, queryFn: api.methodology });
}

export function useLimitations() {
  return useQuery({ queryKey: queryKeys.limitations, queryFn: api.limitations });
}

export function useArchitecture() {
  return useQuery({ queryKey: queryKeys.architecture, queryFn: api.architecture });
}

export function useObjectives() {
  return useQuery({ queryKey: queryKeys.objectives, queryFn: api.objectives });
}

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: api.health,
    refetchInterval: 60_000,
  });
}

export function useThresholds(id: string) {
  return useQuery({
    queryKey: queryKeys.thresholds(id),
    queryFn: () => api.thresholds(id),
    enabled: Boolean(id),
  });
}

export function useAlertBudgets(id: string) {
  return useQuery({
    queryKey: queryKeys.budgets(id),
    queryFn: () => api.alertBudgets(id),
    enabled: Boolean(id),
  });
}

export function useBudgets(id: string) {
  return useAlertBudgets(id);
}

export function useCurves(id: string, label: "original" | "contextual") {
  return useQuery({
    queryKey: queryKeys.curves(id, label),
    queryFn: () => api.curves(id, label),
    enabled: Boolean(id),
  });
}

export function useRefreshData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.refreshCache,
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
  });
}
