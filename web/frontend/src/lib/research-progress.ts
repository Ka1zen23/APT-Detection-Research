import type { Roadmap, RoadmapMilestone } from "@/types/api";

const stages = [
  { id: "foundation", title: "Research foundation", short: "Foundation", tasks: [1, 2, 3], experiments: [], why: "Establish the environment and test the idea on synthetic examples before evaluating real data." },
  { id: "dataset", title: "Dataset investigation", short: "Dataset", tasks: [4, 5, 6, 7], experiments: [], why: "Understand what the logs record and which events have source annotations." },
  { id: "semantic-representation", title: "Semantic representation", short: "Representation", tasks: [8, 9, 10], experiments: [], why: "Create consistent event descriptions, chronological splits and numerical representations." },
  { id: "initial-model", title: "Model development", short: "Model", tasks: [11], experiments: ["E2-A"], why: "Establish a benign-trained autoencoder reference run." },
  { id: "comparison", title: "Comparative experiments", short: "Comparison", tasks: [12, 13, 14, 15, 16], experiments: ["B1", "B2", "B3", "B4", "E2-B", "E2-C", "E2-D", "E2-T", "E2-R"], why: "Compare baselines, ways of training, operating points and alert prioritisation." },
  { id: "representation", title: "Provenance representation ablation", short: "Ablation", tasks: [17], experiments: ["B5", "E5-A", "E5-B", "E5-C"], why: "Find out how much useful context each description retains from the same events." },
  { id: "reproducibility", title: "Reproducibility", short: "Reproducibility", tasks: [18], experiments: ["E7"], why: "Test whether selected single-seed findings persist across repeated runs." },
  { id: "advanced-detection", title: "Advanced detection", short: "Advanced", tasks: [19, 20, 21, 22, 23], experiments: ["B6", "E1", "E3", "E4", "E6"], why: "Compare additional representations and study context across events." },
  { id: "mitigation", title: "Mitigation framework", short: "Mitigation", tasks: [25], experiments: ["M1"], why: "Investigate evidence-grounded recommendations for human review, separately from detection." },
  { id: "dissertation", title: "Final evaluation and dissertation", short: "Final evaluation", tasks: [24, 27], parallel: [26], experiments: ["IV-1", "D1"], why: "Test a frozen configuration on an independent scenario and document the findings and limits. The demonstration platform is a parallel activity, not dissertation completion." },
] satisfies StageDefinition[];

interface StageDefinition {
  id: string;
  title: string;
  short: string;
  why: string;
  tasks: number[];
  parallel?: number[];
  experiments: string[];
}

export type StepStatus = RoadmapMilestone["status"] | "unverified";

export const stepLabels: Record<StepStatus, string> = {
  completed: "Completed",
  in_progress: "In progress",
  next: "Next",
  planned: "Pending",
  blocked: "Blocked",
  failed: "Failed",
  unverified: "Not verified",
};

export function normaliseStepStatus(status: string): StepStatus {
  return Object.hasOwn(stepLabels, status) ? status as StepStatus : "unverified";
}

function stageStatus(tasks: RoadmapMilestone[], expected: number): StepStatus {
  const states = tasks.map(({ status }) => normaliseStepStatus(status));
  for (const status of ["failed", "blocked", "in_progress", "next"] as const) {
    if (states.includes(status)) return status;
  }
  if (states.length !== expected || states.includes("unverified")) return "unverified";
  return states.every((status) => status === "completed") ? "completed" : "planned";
}

const milestoneId = (number: number) => `R${String(number).padStart(2, "0")}`;

export function getResearchProgress(roadmap: Roadmap) {
  const byId = new Map(roadmap.milestones.map((milestone) => [milestone.id, milestone]));
  const stageByTask = new Map<string, string>();
  const groups = stages.map((stage) => {
    const getTasks = (ids: number[]) => ids.flatMap((id) => {
      const task = byId.get(milestoneId(id));
      if (!task) return [];
      stageByTask.set(task.id, stage.id);
      return [task];
    });
    const milestones = getTasks(stage.tasks);
    const parallel = getTasks(stage.parallel ?? []);
    return { ...stage, milestones, parallelActivities: parallel, status: stageStatus(milestones, stage.tasks.length) };
  });
  const unmapped = roadmap.milestones.filter(({ id }) => !stageByTask.has(id));
  if (unmapped.length) {
    groups.push({
      id: "additional", title: "Additional roadmap activities", short: "Additional",
      why: "Milestones added to the roadmap but not yet assigned to a research stage.",
      tasks: [], milestones: unmapped, parallelActivities: [], experiments: [], status: stageStatus(unmapped, unmapped.length),
    });
    unmapped.forEach(({ id }) => stageByTask.set(id, "additional"));
  }
  const next = roadmap.milestones.find(({ id, status }) => id === roadmap.next_milestone?.id && status === "next")
    ?? roadmap.milestones.find(({ status }) => status === "next");
  const current = groups.flatMap(({ milestones }) => milestones).find(({ status }) => status === "in_progress");
  const nextGroup = groups.find(({ id }) => id === (next && stageByTask.get(next.id)));
  const currentGroup = groups.find(({ id }) => id === (current && stageByTask.get(current.id)));
  const nextIndex = nextGroup ? groups.indexOf(nextGroup) : -1;
  const upcomingGroup = groups.slice(nextIndex + 1).find(({ milestones }) => milestones.some(({ status }) => status === "planned"));
  return {
    groups, byId, stageByTask, next, nextGroup, current, currentGroup, upcomingGroup,
    lastCompleted: [...groups].reverse().find(({ status }) => status === "completed"),
    completed: roadmap.milestones.filter(({ status }) => status === "completed").length,
    total: roadmap.milestones.length,
  };
}

export type ResearchProgress = ReturnType<typeof getResearchProgress>;
export type ResearchStage = ResearchProgress["groups"][number];
