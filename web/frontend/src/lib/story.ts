/**
 * Narrative snapshot of the research artifacts, current on 25 November 2026.
 * Every value below is copied from a saved artifact; the live evidence layer is
 * the read-only dashboard at /overview. Sources are printed beside the numbers.
 */

export interface Representation {
  id: "E5-A" | "E5-B" | "E5-C";
  short: string;
  label: string;
  averagePrecision: number;
  rocAuc: number;
  conflictRecords: number;
  conflictDescriptions: number;
  preview: string;
  description: string;
  contains: string[];
  omits: string[];
  interpretation: string;
}

export const REPRESENTATIONS: Representation[] = [
  {
    id: "E5-A",
    short: "A",
    label: "Operation only",
    averagePrecision: 0.003219,
    rocAuc: 0.826367,
    conflictRecords: 8463,
    conflictDescriptions: 1,
    preview: "Operations: execve; load; load; load.",
    description: "Operations: execve; load; load; load.",
    contains: ["System operation names"],
    omits: ["Process attributes", "Artifact attributes", "Directed relationships"],
    interpretation: "Operation names cannot separate events that share a verb.",
  },
  {
    id: "E5-B",
    short: "B",
    label: "With entities",
    averagePrecision: 0.018724,
    rocAuc: 0.982755,
    conflictRecords: 0,
    conflictDescriptions: 0,
    preview:
      "Operations plus process and artifact attributes: names, paths and permissions.",
    description:
      "Operations: execve; load; load; load. Entities: Artifact; type: file; path: /bin/sh; permissions: 755. Artifact; type: file; path: /etc/network/if-up.d/ethtool; permissions: 755. Artifact; type: file; path: /lib64/ld-linux-x86-64.so.2; permissions: 755. Process; name: ethtool; executable: /usr/bin/dash; UID: 0; EUID: 0. Process; name: ethtool; executable: /usr/bin/dash; UID: 0; EUID: 0; command: /bin/sh /etc/network/if-up.d/ethtool.",
    contains: ["System operation names", "Process attributes", "Artifact attributes"],
    omits: ["Directed relationships"],
    interpretation: "Entity attributes remove the exact-description collision.",
  },
  {
    id: "E5-C",
    short: "C",
    label: "Full provenance",
    averagePrecision: 0.021743,
    rocAuc: 0.985507,
    conflictRecords: 0,
    conflictDescriptions: 0,
    preview:
      "Operations, attributes and three directed load relationships.",
    description:
      "Relationships: P1 was triggered by P2; operation: execve. P1 used A1; operation: load. P1 used A2; operation: load. P1 used A3; operation: load. Entities: P1: Process; name: ethtool; executable: /usr/bin/dash; UID: 0; EUID: 0; command: /bin/sh /etc/network/if-up.d/ethtool. P2: Process; name: ethtool; executable: /usr/bin/dash; UID: 0; EUID: 0. A1: Artifact; type: file; path: /etc/network/if-up.d/ethtool; permissions: 755. A2: Artifact; type: file; path: /bin/sh; permissions: 755. A3: Artifact; type: file; path: /lib64/ld-linux-x86-64.so.2; permissions: 755.",
    contains: [
      "System operation names",
      "Process attributes",
      "Artifact attributes",
      "Directed relationships",
    ],
    omits: [],
    interpretation: "Relationships improve the ranking beyond entities.",
  },
];

export interface FindingStory {
  id: string;
  reading: string;
  readingLabel: string;
  struck?: string;
  struckBy?: string;
  readingBy?: string;
  claim: string;
  evidence: string;
  detailEvidence: string;
  detailLimit: string;
  experiments: string[];
  experimentsLabel: string;
}

export const FINDINGS: FindingStory[] = [
  {
    id: "F03",
    reading: "0.1091",
    struck: "0.0208",
    struckBy: "E2-A",
    readingBy: "E2-D",
    readingLabel: "average precision",
    claim: "Frequency-balanced training lifts ranking 5.2 times.",
    evidence: "E2-D finds 46 of 70 positives within 500 alerts. E2-A finds none.",
    detailEvidence:
      "E2-D reaches ROC-AUC 0.995584 and AP 0.109080. E2-A reaches 0.984482 and 0.020832 on the same attack-test partition.",
    detailLimit:
      "Only seed 42 is available. The comparison has not been repeated across seeds or independent scenarios.",
    experiments: ["E2-D", "E2-A"],
    experimentsLabel: "Experiments E2-D and E2-A",
  },
  {
    id: "F01",
    reading: "0/70",
    readingLabel: "original positives found at P99",
    claim: "Operation names alone find nothing at P99.",
    evidence: "All 70 positives share one description with 8,393 negative events.",
    detailEvidence:
      "E5-A reaches ROC-AUC 0.826367 and AP 0.003219. One conflicting description covers 8,463 records, including every labelled positive.",
    detailLimit:
      "The conflict analysis measures exact-description collisions. It does not prove that every ambiguous event is semantically indistinguishable.",
    experiments: ["E5-A", "B5"],
    experimentsLabel: "Experiments E5-A and B5",
  },
  {
    id: "F02",
    reading: "73.23%",
    readingLabel: "of benign training events in one template",
    claim: "One benign template owns the training set.",
    evidence: "72,986 of 99,665 training events, across 13,029 unique descriptions.",
    detailEvidence:
      "The count comes from the E2-D and E5 training logs. Frequency dominance can let one recurring benign template steer the reconstruction objective.",
    detailLimit:
      "Measured on the training partition only. It may reflect the collection scenario rather than general benign behaviour.",
    experiments: ["E2-A", "E2-D"],
    experimentsLabel: "Experiments E2-A and E2-D",
  },
  {
    id: "F04",
    reading: "46/70",
    readingLabel: "positives inside the top 500 alerts",
    claim: "Ranking puts attacks where analysts look.",
    evidence: "Within 500 alerts. E2-B finds 7. E2-C finds none.",
    detailEvidence:
      "Tie-aware alert budgets for E2-D: 5 at 50 alerts, 16 at 100, 29 at 200, 46 at 500. E2-A and E2-C recover nothing until 1,000.",
    detailLimit:
      "Budgets are measured points, not interpolated estimates. Precision inside 500 alerts is 9.2%.",
    experiments: ["E2-D", "E2-R"],
    experimentsLabel: "Experiments E2-D and E2-R",
  },
  {
    id: "F05",
    reading: "+16.1%",
    readingLabel: "relative average precision over entities",
    claim: "Relationships add signal beyond entities.",
    evidence: "Average precision 0.0217 against 0.0187, on the same event text.",
    detailEvidence:
      "E5-C reaches ROC-AUC 0.985507 and AP 0.021743. E5-B reaches 0.982755 and 0.018724. E5-A reaches 0.826367 and 0.003219.",
    detailLimit:
      "The ablation changes text length and formatting alongside content, so it does not isolate the causal effect of relationships alone.",
    experiments: ["E5-A", "E5-B", "E5-C"],
    experimentsLabel: "Experiments E5-A to E5-C",
  },
  {
    id: "F06",
    reading: "2,339",
    readingLabel: "false positives at P99.95, down from 8,628",
    claim: "A stricter threshold trades recall for quiet.",
    evidence: "Contextual recall falls from 77.33% to 49.33%. Original recall stays at 100%.",
    detailEvidence:
      "P99 precision is 0.805%, benign false-positive rate 0.754%. P99.95 precision is 2.906%, benign false-positive rate 0.126%.",
    detailLimit:
      "P99.95 was examined retrospectively after attack-test inspection. It is exploratory, not a validated deployment threshold.",
    experiments: ["E2-D", "E2-T"],
    experimentsLabel: "Experiments E2-D and E2-T",
  },
];

export const METHOD_STEPS = [
  {
    title: "Provenance log",
    body: "Two SPADE collections, benign and attack.",
    reading: "243,271 events",
  },
  {
    title: "Verbalise",
    body: "One description per event, with entities and relationships.",
    reading: "13,029 unique",
  },
  {
    title: "Encode",
    body: "Frozen MiniLM writes a 384-dimension vector.",
    reading: "384-d",
  },
  {
    title: "Reconstruct",
    body: "A benign-trained autoencoder rebuilds each vector.",
    reading: "107,168 parameters",
  },
  {
    title: "Score",
    body: "High error is flagged, ranked and reviewed.",
    reading: "P99 threshold",
  },
];

export const HERO_READINGS = REPRESENTATIONS.map((representation) => ({
  id: representation.id,
  label: representation.label,
  averagePrecision: representation.averagePrecision,
}));

export interface BudgetPoint {
  budget: number;
  e2d: number;
  e2a: number;
  precision: number;
  recall: number;
}

export const BUDGETS: BudgetPoint[] = [
  { budget: 50, e2d: 5, e2a: 0, precision: 0.1, recall: 0.0714 },
  { budget: 100, e2d: 16, e2a: 0, precision: 0.16, recall: 0.2286 },
  { budget: 200, e2d: 29, e2a: 0, precision: 0.145, recall: 0.4143 },
  { budget: 500, e2d: 46, e2a: 0, precision: 0.092, recall: 0.6571 },
  { budget: 1000, e2d: 58, e2a: 1, precision: 0.058, recall: 0.8286 },
  { budget: 2000, e2d: 69, e2a: 69, precision: 0.0345, recall: 0.9857 },
  { budget: 5000, e2d: 70, e2a: 70, precision: 0.014, recall: 1 },
];

export const SELECTABLE_BUDGETS = [100, 200, 500, 1000];

export interface ThresholdState {
  id: "p99" | "p9995";
  label: string;
  note: string;
  falsePositives: number;
  contextualRecall: number;
  originalRecall: number;
  precision: number;
  benignFpr: number;
}

export const THRESHOLDS: Record<"p99" | "p9995", ThresholdState> = {
  p99: {
    id: "p99",
    label: "P99",
    note: "Primary operating point",
    falsePositives: 8628,
    contextualRecall: 0.7733,
    originalRecall: 1,
    precision: 0.00805,
    benignFpr: 0.00754,
  },
  p9995: {
    id: "p9995",
    label: "P99.95",
    note: "Retrospective and exploratory",
    falsePositives: 2339,
    contextualRecall: 0.4933,
    originalRecall: 1,
    precision: 0.02906,
    benignFpr: 0.00126,
  },
};

export const LIMITS = [
  {
    title: "Seventy labels",
    body: "Only 70 original positives, mostly credential access.",
  },
  {
    title: "One scenario",
    body: "The Phase 2 partition has been inspected repeatedly.",
  },
  {
    title: "One seed",
    body: "Every experiment uses seed 42. No repeat study yet.",
  },
  {
    title: "No mitigation",
    body: "No response framework has been evaluated.",
  },
];
