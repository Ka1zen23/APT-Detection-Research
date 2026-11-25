import type { AblationData, ExperimentDetail, Finding } from "@/types/api";
import { normaliseStepStatus, type StepStatus } from "./research-progress";

interface ExecutionStep {
  id: string;
  title: string;
  status: StepStatus;
  detail: string;
  sources: string[];
  links?: { label: string; to: string }[];
}

const e5Variants: Record<string, string> = {
  "E5-A": "operation_only",
  "E5-B": "operation_entities",
  "E5-C": "full_provenance",
};

export function getExecutionProgress(experiment: ExperimentDetail, ablation?: AblationData, findings: Finding[] = []) {
  const state = normaliseStepStatus(experiment.status);
  const available = experiment.artifact_availability.filter(({ status }) => status === "available").map(({ artifact }) => artifact);
  const select = (pattern: RegExp) => available.filter((artifact) => pattern.test(artifact));
  const training = select(/\/training_summary\.json$/);
  const evaluation = select(/\/evaluation_summary\.json$|\/attack_test_predictions\.parquet$/);
  const comparison = select(/comparison\.csv$|ranking_summary\.csv$/);
  const within = (...sources: string[][]) => [...new Set(sources.flat())];
  const related = findings.filter(({ related_experiments }) => related_experiments.includes(experiment.id));
  const findingLinks = related.map(({ id, title }) => ({ label: title, to: `/findings#${id}` }));
  const measured = experiment.metrics?.availability?.status === "available";
  const step = (id: string, title: string, confirmed: boolean, detail: string, sources: string[] = [], links?: ExecutionStep["links"]): ExecutionStep => ({
    id, title, detail, sources, links,
    status: confirmed ? "completed" : state === "planned" || state === "next" ? "planned" : "unverified",
  });
  const planned = (flow: [string, string][]) => flow.map(([title, detail], index) => step(`planned-${index}`, title, false, detail));

  if (experiment.id === "E7" && (state === "planned" || state === "next")) return planned([
    ["Lock the comparison plan", "Confirm the configurations, random seeds and evaluation protocol listed in the experiment record."],
    ["Repeat training across seeds", "Train the selected configurations with the recorded planned seeds. No new run is claimed here."],
    ["Evaluate repeated runs", "Apply the recorded validation rule and compare results on the existing evaluation partition."],
    ["Summarise variation", "Report individual results, means and standard deviations. This does not substitute for independent-scenario validation."],
    ["Publish the evidence", "Record run configurations, caveats and result artifacts once available."],
  ]);

  if (experiment.kind === "platform") {
    const execution = step("implementation", "Implement the research viewer", state === "completed" && available.length > 0, "Develop a read-only viewer for the research evidence. A deployment milestone is not a detection result.", available);
    return [
      { ...execution, status: ["in_progress", "blocked", "failed"].includes(state) ? state : execution.status },
      step("verification", "Verify the viewer", false, "Record deployment, accessibility and data-integrity checks as platform evidence."),
      step("documentation", "Document the demonstration", false, "Publish the demonstration notes and distinguish platform work from dissertation outcomes."),
    ];
  }

  if (experiment.kind === "framework") return planned([
    ["Define the review workflow", "Specify the evidence an analyst should review before considering a response."],
    ["Evaluate recommendations", "Assess potential recommendations independently of the anomaly score and keep a human in control."],
    ["Record limitations", "Document evaluation outcomes before making any mitigation claim."],
  ]);

  if (experiment.kind === "analysis") {
    return [
      step("inputs", "Collect comparison inputs", available.length > 0, "Use saved outputs from the relevant model runs.", available),
      step("measure", "Run the comparative analysis", comparison.length > 0, "Use the recorded operating points or alert budgets, without inventing intermediate measurements.", comparison),
      step("report", "Document findings", findingLinks.length > 0, "Link the interpretation and its limitations to the recorded analysis.", [], findingLinks),
    ];
  }

  const variant = e5Variants[experiment.id];
  if (variant) {
    const statistics = ablation?.statistics.some((row) => row.variant === variant && row.split === "train") ?? false;
    const preprocessing = ablation?.source_artifacts.filter((source) => /representation_statistics\.csv$/.test(source)) ?? [];
    const validation = ablation?.source_artifacts.filter((source) => /representation_conflicts\.json$/.test(source)) ?? [];
    const validationAvailable = Boolean(ablation?.conflicts[variant]);
    return [
      step("design", "Representation design", state === "completed" && Boolean(experiment.representation) && comparison.length > 0, experiment.representation ?? "Define the event representation.", comparison),
      step("preprocess", "Dataset preprocessing", statistics, "Check that the recorded statistics contain the training partition for this representation.", statistics ? preprocessing : []),
      step("validate", "Representation validation", validationAvailable, "Inspect the representation’s measured exact-description conflicts.", validationAvailable ? validation : []),
      step("embed", "Embedding generation", Boolean(experiment.encoder) && typeof experiment.training_summary?.train_samples === "number" && training.length > 0, "The recorded training inputs and configured encoder provide evidence that the run consumed embeddings. The original vectors are not public.", training),
      step("train", "Autoencoder training", training.length > 0 && Boolean(experiment.training_summary), "Train on the recorded benign inputs and retain the saved training summary.", training),
      step("evaluate", "Model evaluation", evaluation.length > 0 && Boolean(experiment.evaluation_summary), "Evaluate the trained model at its recorded operating point.", evaluation),
      step("compare", "Comparative analysis", comparison.length > 0 && measured, "Compare performance across the E5 representations.", comparison, [{ label: "Open the E5 comparison", to: "/experiments/ablation" }]),
      step("report", "Findings documentation", findingLinks.length > 0, "Publish the interpretation and the caveats alongside the numerical evidence.", [], findingLinks),
    ];
  }

  return [
    step("plan", "Record the configuration", Object.keys(experiment.training_configuration).length > 0 && available.length > 0, "Identify the recorded representation, algorithm and comparison settings.", within(training, select(/baseline_summary|training_frequencies/))),
    step("run", experiment.id.startsWith("B") ? "Run the baseline" : "Run the experiment", evaluation.length > 0 || training.length > 0, "Use recorded run outputs; this step does not assume that a baseline trains an autoencoder.", within(training, evaluation)),
    step("evaluate", "Evaluate the results", measured || evaluation.length > 0, "Check the saved evaluation artifact or the registered measured metrics.", within(evaluation, comparison)),
    step("report", "Document the outcome", findingLinks.length > 0 || (state === "completed" && comparison.length > 0), "Link the outcome to a saved comparison or a finding, where one exists.", comparison, findingLinks),
  ];
}
