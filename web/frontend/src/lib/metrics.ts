export interface MetricDefinition {
  id: string;
  term: string;
  short: string;
  long: string;
  direction: string;
  denominator?: string;
  caveat?: string;
}

export const METRICS: MetricDefinition[] = [
  {
    id: "roc-auc",
    term: "ROC-AUC",
    short: "How well the model ranks a positive above a negative, across all thresholds.",
    long: "The probability that a randomly chosen positive event receives a higher anomaly score than a randomly chosen negative event. It is threshold-independent, so it says nothing about how many alerts an analyst would see at a chosen operating point.",
    direction: "Higher is better. 0.5 is chance, 1.0 is perfect ranking.",
    denominator: "Computed on the 100,892-event attack test with original labels unless stated.",
    caveat: "A high ROC-AUC can coexist with very low precision when positives are rare.",
  },
  {
    id: "average-precision",
    term: "Average Precision",
    short: "The area under the precision-recall curve; sensitive to the rare positive class.",
    long: "Average Precision summarises the precision-recall trade-off across every threshold. It rewards putting positives near the top of the ranking, which is what an analyst-facing alert queue needs.",
    direction: "Higher is better. It is not the same as accuracy.",
    denominator: "Computed on the 100,892-event attack test with original labels unless stated.",
    caveat: "AP can look small in absolute terms because only 70 of 100,892 events are original positives.",
  },
  {
    id: "precision",
    term: "Precision",
    short: "Of the alerts raised, the share that are true positives.",
    long: "True positives divided by all alerts. At a precision of 0.805%, roughly 8 of every 1,000 alerts are labelled positives, so the queue is dominated by false positives.",
    direction: "Higher is better, but it depends entirely on the operating point.",
    denominator: "True positives divided by total alerts at the selected threshold.",
  },
  {
    id: "recall",
    term: "Recall",
    short: "Of the labelled positives, the share the model found.",
    long: "True positives divided by all original positives. Recall can reach 100% by lowering the threshold far enough, at the cost of many more false positives.",
    direction: "Higher is better only alongside precision and alert volume.",
    denominator: "Denominator is 70 original positives unless contextual labels are named.",
  },
  {
    id: "f1",
    term: "F1",
    short: "The harmonic mean of precision and recall at one operating point.",
    long: "F1 balances precision and recall, but at extreme class imbalance it can hide a very large false-positive volume. It is shown for completeness, not as the primary selection metric.",
    direction: "Higher is better; use with precision and false-positive counts.",
  },
  {
    id: "benign-fpr",
    term: "Benign false-positive rate",
    short: "The share of benign events incorrectly flagged.",
    long: "False positives divided by benign events. The benign test partition and the attack-test negatives are different denominators and are reported separately.",
    direction: "Lower is better.",
  },
  {
    id: "attack-fpr",
    term: "Attack-scenario false-positive rate",
    short: "The share of negatively annotated attack-test events that were flagged.",
    long: "False positives divided by the negative events inside the attack-test partition. It is not the same as the benign-test false-positive rate.",
    direction: "Lower is better.",
  },
  {
    id: "contextual-recall",
    term: "Contextual recall",
    short: "Recall against connected-node indicators, not independent ground truth.",
    long: "The 225 contextual positives are derived from provenance nodes connected to known malicious edges. They are useful supporting indicators, but they are not a second independent annotation set.",
    direction: "Higher is better as a secondary signal; never present it as confirmed attack detection.",
    denominator: "225 derived contextual indicators.",
    caveat: "Original and contextual metrics must stay separate.",
  },
  {
    id: "p99",
    term: "P99 threshold",
    short: "The 99th percentile of benign validation reconstruction error.",
    long: "The threshold is calibrated on a separate benign validation set, never on attack-test labels. P99 is the primary operating point used across the comparison.",
    direction: "A higher percentile is stricter: fewer alerts, lower recall.",
    caveat: "The exact threshold value is model-specific.",
  },
  {
    id: "p9995",
    term: "P99.95 threshold",
    short: "A stricter retrospective threshold, shown for the trade-off.",
    long: "P99.95 was examined after the attack-test results were inspected. It is exploratory and is not an independently validated deployment threshold.",
    direction: "Fewer false positives, lower contextual recall.",
    caveat: "Retrospective. Do not read it as a deployment recommendation.",
  },
  {
    id: "original-labels",
    term: "Original labels",
    short: "Edge-derived annotations supplied with the CICAPT-IIoT scenario.",
    long: "The 70 original positives come from annotated malicious provenance edges. All headline detection metrics use these labels unless a panel says otherwise.",
    direction: "The primary evaluation labels.",
    denominator: "70 positives among 100,892 attack-test events.",
  },
  {
    id: "contextual-labels",
    term: "Contextual indicators",
    short: "Derived positives from provenance nodes connected to malicious edges.",
    long: "These 225 indicators broaden the view of the attack scenario but are not independent ground truth. They are reported separately and never merged into the original-label metrics.",
    direction: "Secondary supporting evidence.",
    denominator: "225 derived indicators.",
  },
  {
    id: "alert-budget",
    term: "Alert budget",
    short: "How many top-ranked events an analyst can review.",
    long: "The budget is a review capacity, not a threshold. At a budget of 500, the analyst investigates the 500 highest-scoring events and the analysis counts how many labelled positives appear inside that set.",
    direction: "More budget finds more positives, with diminishing precision.",
    caveat: "Only measured budget points are shown; intermediate budgets are not interpolated.",
  },
  {
    id: "seed",
    term: "Seed",
    short: "The random seed used for training and evaluation.",
    long: "Every current experiment uses seed 42. The planned E7 study repeats selected configurations with seeds 42, 123 and 456 and reports mean and standard deviation.",
    direction: "One seed means no variance estimate yet.",
    caveat: "Do not treat a single-seed difference as stable.",
  },
];

export const metricById = Object.fromEntries(METRICS.map((metric) => [metric.id, metric]));
