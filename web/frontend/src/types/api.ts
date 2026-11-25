export interface Meta {
  generated_at: string;
  last_artifact_update: string | null;
  data_mode: "live_artifacts" | "static_snapshot";
  warnings: string[];
}

export interface Envelope<T> {
  data: T;
  meta: Meta;
}

export interface Availability {
  status: "available" | "missing" | "partial";
  artifact: string | null;
  note: string | null;
}

export interface MetricSummary {
  value: number;
  experiment_id: string;
  experiment_ids: string[];
  tied_count: number;
}

export interface ExperimentSummary {
  id: string;
  name: string;
  group: string;
  kind: string;
  status: string;
  representation: string | null;
  encoder: string | null;
  algorithm: string | null;
  research_question: string | null;
  hypothesis: string | null;
  roc_auc: number | null;
  average_precision: number | null;
  recall: number | null;
  precision: number | null;
  f1: number | null;
  true_positives: number | null;
  false_positives: number | null;
  false_negatives: number | null;
  true_negatives: number | null;
  benign_fpr: number | null;
  attack_fpr: number | null;
  contextual_recall: number | null;
  threshold: number | null;
  threshold_percentile: number | null;
  training_seconds: number | null;
  seed: number | null;
  availability: Availability | null;
  rank?: number | null;
  operating_point?: string | null;
  warnings?: string[];
}

export interface TrainingConfig {
  [key: string]: unknown;
}

export interface ExperimentDetail extends ExperimentSummary {
  training_strategy?: string;
  training_configuration: TrainingConfig;
  checkpoint_selection: string;
  evaluation_configuration: TrainingConfig;
  results_summary: string;
  interpretation: string;
  limitations: string;
  source_artifacts: string[];
  metrics: ExperimentSummary | null;
  warnings: string[];
  artifact_availability: { artifact: string; status: string }[];
  training_summary?: Record<string, unknown>;
  evaluation_summary?: Record<string, any>;
  figures?: { key: string; run: string; filename: string; title: string }[];
}

export interface ResearchStatus {
  official_title: string;
  institution: string;
  phase: string;
  status: string;
  status_tone: string;
  description: string;
  current_activity: string;
  next_activity: string;
  primary_operating_point: string;
  implementation_note: string;
  last_reviewed: string;
}

export interface OverviewData {
  research: ResearchStatus;
  dataset: DatasetSummary;
  kpis: {
    raw_records: number;
    events: number;
    original_positives: number;
    contextual_positives: number;
    completed_experiments: number;
    completed_models: number;
    completed_analyses: number;
    best_roc_auc: MetricSummary;
    best_average_precision: MetricSummary;
    best_recall: MetricSummary;
  };
  leaderboard: ModelRow[];
  roadmap: Roadmap;
  findings: Finding[];
  limitations: Limitation[];
  journal: JournalEntryMeta[];
  upcoming: ExperimentSummary[];
  counts: {
    completed: number;
    in_progress: number;
    planned: number;
    total_experiments: number;
    reports_available: number;
  };
  status: ResearchStatus;
}

export type ModelRow = ExperimentSummary;

export interface DatasetCounts {
  raw_records: number;
  phase1_raw_records: number;
  phase2_raw_records: number;
  nodes: number;
  edges: number;
  events: number;
  phase1_events: number;
  phase2_events: number;
  original_positives: number;
  contextual_positives: number;
  attack_prevalence_percent: number;
}

export interface DistributionItem {
  name: string;
  count: number;
}

export interface Partition {
  name: string;
  records: number;
  unique_descriptions: number;
  start_timestamp: number;
  end_timestamp: number;
}

export interface DatasetSummary {
  counts: DatasetCounts;
  partitions: Partition[];
  class_balance: {
    partition: string;
    records: number;
    positives: number;
    contextual_positives?: number;
    note: string;
  }[];
  node_types: DistributionItem[];
  record_types: DistributionItem[];
  edge_types: DistributionItem[];
  operations: DistributionItem[];
  operations_total: number;
  tactics: {
    original: DistributionItem[];
    contextual: DistributionItem[];
  };
  timeline: {
    date: string;
    total: number;
    train: number;
    validation: number;
    benign_test: number;
    attack_test: number;
  }[];
  missing_values: {
    column: string;
    missing: number;
    total: number;
    percent: number;
  }[];
  representation: {
    variant: string;
    split: string;
    events: number;
    unique_descriptions: number;
    mean_tokens: number;
    p95_tokens: number;
    maximum_tokens: number;
    over_token_limit: number;
    original_positives: number;
    contextual_positives: number;
    seen_in_training: number;
    original_positives_seen: number;
    contextual_positives_seen: number;
  }[];
  duplicates: {
    variant: string;
    split: string;
    events: number;
    unique: number;
    duplicates: number;
    duplicate_percent: number;
  }[];
  truncation: {
    variant: string;
    split: string;
    events: number;
    over_token_limit: number;
    truncation_percent: number;
    maximum_tokens: number;
    mean_tokens: number;
  }[];
  overlap: {
    training_vs_validation: { matching: number; percent: number };
    training_vs_benign_test: { matching: number; percent: number };
    training_vs_attack_test: { matching: number; percent: number };
    attack_test_seen: number | null;
    attack_test_unseen: number | null;
    seen_positives: number | null;
    unseen_positives: number | null;
  };
  sources: string[];
}

export interface EventRow {
  phase: string;
  event_id: string;
  timestamp: number | null;
  split: string | null;
  original_label: number | null;
  contextual_label: number | null;
  original_tactics: string[];
  contextual_tactics: string[];
  anomaly_score: number | null;
  prediction: number | null;
  seen_in_training: boolean | null;
  edge_count: number | null;
  text: string | null;
}

export interface EventPage {
  items: EventRow[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  sort_by: string;
  sort_order: string;
  filters: Record<string, unknown>;
}

export interface ThresholdRow {
  percentile: number;
  threshold: number;
  validation_fpr: number;
  benign_false_positives: number;
  benign_fpr: number;
  true_positives: number;
  false_positives: number;
  true_negatives: number;
  false_negatives: number;
  total_alerts: number;
  precision: number;
  recall: number;
  f1: number;
  attack_fpr: number;
  contextual_true_positives: number;
  contextual_recall: number;
  exploratory: boolean;
}

export interface ThresholdPayload {
  available: boolean;
  experiment_id: string;
  source?: string;
  primary_percentile?: number;
  note?: string;
  reason?: string;
  rows: ThresholdRow[];
}

export interface AlertBudgetRow {
  budget: number;
  expected_true_positives: number;
  minimum_true_positives: number;
  maximum_true_positives: number;
  expected_precision: number;
  expected_recall: number;
  minimum_recall: number | null;
  maximum_recall: number | null;
}

export interface AlertBudgetPayload {
  available: boolean;
  experiment_id: string;
  source?: string;
  note?: string;
  reason?: string;
  rows: AlertBudgetRow[];
}

export interface CurvePoint {
  x: number;
  y: number;
}

export interface CurvePayload {
  experiment_id: string;
  label: "original" | "contextual";
  available: boolean;
  reason?: string;
  computed_roc_auc?: number;
  computed_average_precision?: number;
  roc?: CurvePoint[];
  pr?: CurvePoint[];
  source?: string;
  points?: { roc_raw: number; pr_raw: number };
  note?: string;
}

export interface AblationStatistic {
  variant: string;
  split: string;
  events: number;
  unique_descriptions: number;
  mean_tokens: number;
  maximum_tokens: number;
  over_token_limit: number;
  original_positives: number;
  contextual_positives: number;
  seen_in_training: number;
  original_positives_seen: number;
  contextual_positives_seen: number;
}

export interface ConflictSummary {
  conflicting_descriptions: number;
  conflicting_records: number;
  conflicting_positives: number;
  positive_conflict_rate: number;
}

export interface AblationData {
  models: ModelRow[];
  statistics: AblationStatistic[];
  conflicts: Record<
    string,
    { original: ConflictSummary; contextual: ConflictSummary }
  >;
  budgets: {
    experiment: string;
    budget: number;
    expected_true_positives: number;
    minimum_true_positives: number;
    maximum_true_positives: number;
    expected_precision: number;
    expected_recall: number;
  }[];
  examples: {
    event_context: string;
    event_id: string;
    phase: string;
    source: string;
    representations: {
      id: string;
      label: string;
      description: string;
      contains: string[];
      omits: string[];
    }[];
  };
  derived: {
    e5c_over_e5b_ap_uplift_percent: number | null;
    operation_only_conflicting_negative_events: number | null;
  };
  source_artifacts: string[];
}

export interface Finding {
  id: string;
  title: string;
  research_question: string;
  observation: string;
  evidence: string;
  visualisation: string;
  interpretation: string;
  limitations: string;
  related_experiments: string[];
  validation_status: string;
}

export interface RoadmapMilestone {
  id: string;
  title: string;
  phase: string;
  status: "completed" | "next" | "planned" | "in_progress" | "blocked" | "failed";
  description: string;
  dependencies: string[];
  evidence: string[];
}

export interface Roadmap {
  milestones: RoadmapMilestone[];
  counts: Record<string, number>;
  total: number;
  next_milestone: RoadmapMilestone | null;
}

export interface JournalEntryMeta {
  slug: string;
  date: string;
  title: string;
  summary: string;
  status: string;
  experiments: string[];
  artifact: string;
}

export interface JournalEntry extends JournalEntryMeta {
  body: string;
}

export interface ReportItem {
  id: string;
  title: string;
  category: string;
  status: string;
  description: string;
  format: string;
  available: boolean;
  document_key?: string;
  artifact?: string;
}

export interface EnvironmentData {
  host: {
    operating_system: string;
    host_os: string;
    gpu: string;
    python: string;
    cuda: string;
  };
  packages: { name: string; package: string; version: string | null; recorded: boolean }[];
  runs: {
    experiment: string;
    seed: number | null;
    gpu: string | null;
    torch_version: string | null;
    elapsed_seconds: number | null;
    artifact: string;
  }[];
  seeds: { current_experiments: number[]; planned_reproducibility: number[] };
  partitions: Record<
    string,
    {
      records: number;
      unique_descriptions: number;
      start_timestamp: number;
      end_timestamp: number;
    }
  >;
  missing_reproducibility: string[];
  source_artifact: string;
}

export interface MethodologyData {
  pipeline: { id: string; label: string; status: string; description: string }[];
  encoder: {
    model: string;
    parameters: string;
    frozen: boolean;
    dimensions: number;
    max_tokens: number;
    normalised: boolean;
    revision: string | null;
    note: string;
  };
  autoencoder: {
    architecture: number[];
    trainable_parameters: number;
    loss: string;
    optimizer: string;
    learning_rate: number;
    batch_size: number;
    training_data: string;
    threshold_rule: string;
    activation: string;
  };
  glossary: { term: string; plain: string; detail: string }[];
  training_partitions: Record<string, string>;
}

export interface Limitation {
  id: string;
  category: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  mitigation: string;
}

export interface ArchitectureData {
  summary: string;
  layers: { title: string; description: string }[];
  data_flow: string[];
  boundaries: string[];
  stack: { frontend: string[]; backend: string[] };
}

export interface Objective {
  id: string;
  title: string;
  description: string;
  status: string;
  evidence: string;
  experiments: string[];
}

export interface HealthData {
  status: string;
  version: string;
  api_prefix: string;
  repository_root_exists: boolean;
  allowed_artifact_roots: string[];
  last_artifact_update: string | null;
  checked_at: string;
  read_only: boolean;
  deployment_mode?: string;
  auth_required?: boolean;
}
