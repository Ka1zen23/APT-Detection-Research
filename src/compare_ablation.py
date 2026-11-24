
from pathlib import Path
import json

import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from sklearn.metrics import precision_recall_curve

from evaluate import calculate_metrics


ROOT = Path(__file__).resolve().parents[1]

OUTPUT = ROOT / "results/ablation_comparison"

CONFIGS = {
    "E5-A": "e5a-operation-only",
    "E5-B": "e5b-operation-entities",
    "E5-C": "e5c-full-provenance",
}

ALERT_BUDGETS = [
    50, 100, 200, 500, 1000, 2000, 5000, 10000
]

PERCENTILES = [
    95, 97, 98, 99, 99.5, 99.9, 99.95, 99.99, 100
]


def alert_budget_metrics(labels, scores, budget):
    labels = np.asarray(labels, dtype=int)
    scores = np.asarray(scores, dtype=np.float64)

    budget = min(budget, len(scores))

    cutoff = np.sort(scores)[-budget]

    above = scores > cutoff
    tied = scores == cutoff

    fixed_tp = int(labels[above].sum())

    remaining = budget - int(above.sum())

    tied_count = int(tied.sum())
    tied_positives = int(labels[tied].sum())
    tied_negatives = tied_count - tied_positives

    expected_tp = (
        fixed_tp
        + remaining * tied_positives / tied_count
    )

    minimum_tp = (
        fixed_tp
        + max(0, remaining - tied_negatives)
    )

    maximum_tp = (
        fixed_tp
        + min(remaining, tied_positives)
    )

    return {
        "alert_budget": budget,
        "expected_tp": expected_tp,
        "minimum_tp": minimum_tp,
        "maximum_tp": maximum_tp,
        "expected_precision": expected_tp / budget,
        "expected_recall": expected_tp / labels.sum(),
    }


def operation_frequency_baseline():
    data_path = (
        ROOT / "data/processed/cicapt-iiot-ablation"
        / "operation_only"
    )

    events = pd.concat(
        [
            pd.read_parquet(
                data_path / f"{phase}_events.parquet"
            )
            for phase in ["phase1", "phase2"]
        ],
        ignore_index=True,
    )

    manifest = pd.read_parquet(
        ROOT / "data/splits/cicapt-iiot"
        / "event_split_manifest.parquet"
    )

    events = events.merge(
        manifest[["phase", "event_id", "split"]],
        on=["phase", "event_id"],
        validate="one_to_one",
    )

    train = events[events["split"] == "train"]

    assert len(train) == 99665
    assert train["original_label"].sum() == 0
    assert train["contextual_label"].sum() == 0

    frequencies = train["text"].value_counts()

    denominator = (
        len(train) + len(frequencies) + 1
    )

    partitions = {}

    for name in [
        "validation",
        "benign_test",
        "attack_test",
    ]:
        frame = events[
            events["split"] == name
        ].copy()

        counts = (
            frame["text"]
            .map(frequencies)
            .fillna(0)
            .to_numpy(dtype=np.float64)
        )

        frame["anomaly_score"] = -np.log(
            (counts + 1) / denominator
        )

        partitions[name] = frame

    validation_scores = partitions[
        "validation"
    ]["anomaly_score"].to_numpy()

    threshold = float(
        np.percentile(validation_scores, 99)
    )

    output_dir = OUTPUT / "operation_frequency"

    output_dir.mkdir(parents=True, exist_ok=True)

    frequencies.rename("frequency").to_csv(
        output_dir / "training_frequencies.csv"
    )

    for name, frame in partitions.items():
        frame["prediction"] = (
            frame["anomaly_score"] > threshold
        ).astype(int)

        frame.to_parquet(
            output_dir / f"{name}_predictions.parquet",
            index=False,
        )

    return {
        "validation_scores": validation_scores,
        "benign": partitions["benign_test"],
        "attack": partitions["attack_test"],
        "threshold": threshold,
    }


def load_experiment(slug):
    result_dir = ROOT / "results" / slug

    with open(
        result_dir / "training_summary.json"
    ) as file:
        training_summary = json.load(file)

    assert training_summary["total_optimizer_updates"] == 39000
    assert training_summary["train_samples"] == 99665
    assert training_summary["seed"] == 42

    return {
        "validation_scores": np.load(
            result_dir / "validation_errors.npy",
            allow_pickle=False,
        ),
        "benign": pd.read_parquet(
            result_dir / "evaluation"
            / "benign_test_predictions.parquet"
        ),
        "attack": pd.read_parquet(
            result_dir / "evaluation"
            / "attack_test_predictions.parquet"
        ),
        "threshold": training_summary["threshold"],
    }


def verify_same_events(experiments):
    columns = [
        "phase",
        "event_id",
        "original_label",
        "contextual_label",
    ]

    for partition in ["benign", "attack"]:
        reference = None

        for name, experiment in experiments.items():
            frame = (
                experiment[partition][columns]
                .sort_values(["phase", "event_id"])
                .reset_index(drop=True)
            )

            assert not frame.duplicated(
                ["phase", "event_id"]
            ).any()

            if reference is None:
                reference = frame
            else:
                pd.testing.assert_frame_equal(
                    reference,
                    frame,
                )

        print(f"Identical evaluation events: {partition}")


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)

    experiments = {
        name: load_experiment(slug)
        for name, slug in CONFIGS.items()
    }

    experiments["B5-Frequency"] = (
        operation_frequency_baseline()
    )

    verify_same_events(experiments)

    comparison = []
    sensitivity = []
    budgets = []

    plt.figure(figsize=(10, 7))

    for name, experiment in experiments.items():
        print(f"\nEvaluating {name}")

        attack = experiment["attack"]
        benign = experiment["benign"]

        validation_scores = np.asarray(
            experiment["validation_scores"],
            dtype=np.float64,
        )

        scores = attack["anomaly_score"].to_numpy(
            dtype=np.float64
        )

        labels = attack["original_label"].to_numpy()

        contextual_labels = (
            attack["contextual_label"].to_numpy()
        )

        benign_scores = benign["anomaly_score"].to_numpy(
            dtype=np.float64
        )

        threshold = experiment["threshold"]

        original = calculate_metrics(
            labels, scores, threshold
        )

        contextual = calculate_metrics(
            contextual_labels, scores, threshold
        )

        benign_metrics = calculate_metrics(
            benign["original_label"].to_numpy(),
            benign_scores,
            threshold,
        )

        comparison.append({
            "experiment": name,
            "threshold": threshold,
            "roc_auc": original["roc_auc"],
            "average_precision": original["average_precision"],
            "pr_auc": original["pr_auc"],
            "precision": original["precision"],
            "recall": original["recall"],
            "f1": original["f1"],
            "true_positives": original["true_positives"],
            "false_positives": original["false_positives"],
            "attack_fpr": original["false_positive_rate"],
            "benign_fpr": benign_metrics["false_positive_rate"],
            "validation_fpr": float(
                (validation_scores > threshold).mean()
            ),
            "contextual_recall": contextual["recall"],
            "contextual_ap": contextual["average_precision"],
        })

        for percentile in PERCENTILES:
            cutoff = float(
                np.percentile(
                    validation_scores,
                    percentile,
                )
            )

            metrics = calculate_metrics(
                labels, scores, cutoff
            )

            context_metrics = calculate_metrics(
                contextual_labels, scores, cutoff
            )

            sensitivity.append({
                "experiment": name,
                "percentile": percentile,
                "threshold": cutoff,
                "original_tp": metrics["true_positives"],
                "original_fp": metrics["false_positives"],
                "original_precision": metrics["precision"],
                "original_recall": metrics["recall"],
                "original_f1": metrics["f1"],
                "attack_fpr": metrics["false_positive_rate"],
                "contextual_recall": context_metrics["recall"],
                "validation_fpr": float(
                    (validation_scores > cutoff).mean()
                ),
                "benign_fpr": float(
                    (benign_scores > cutoff).mean()
                ),
            })

        for budget in ALERT_BUDGETS:
            budgets.append({
                "experiment": name,
                **alert_budget_metrics(
                    labels, scores, budget
                ),
            })

        precision, recall, _ = precision_recall_curve(
            labels, scores
        )

        plt.step(
            recall,
            precision,
            where="post",
            label=(
                f"{name} "
                f"(AP={original['average_precision']:.4f})"
            ),
        )

    plt.axhline(
        70 / 100892,
        linestyle="--",
        label="Positive prevalence",
    )

    plt.xlabel("Recall")
    plt.ylabel("Precision")
    plt.title("Provenance Context Ablation")
    plt.legend()
    plt.grid(alpha=0.25)
    plt.tight_layout()

    plt.savefig(
        OUTPUT / "precision_recall_comparison.png",
        dpi=200,
    )

    plt.close()

    comparison_df = pd.DataFrame(comparison)
    sensitivity_df = pd.DataFrame(sensitivity)
    budget_df = pd.DataFrame(budgets)

    comparison_df.to_csv(
        OUTPUT / "ablation_comparison.csv",
        index=False,
    )

    sensitivity_df.to_csv(
        OUTPUT / "threshold_comparison.csv",
        index=False,
    )

    budget_df.to_csv(
        OUTPUT / "alert_budget_comparison.csv",
        index=False,
    )

    print("\nPRIMARY ABLATION RESULTS")

    print(
        comparison_df.sort_values(
            "average_precision",
            ascending=False,
        ).to_string(index=False)
    )

    print("\nTHRESHOLD SENSITIVITY")

    print(
        sensitivity_df[
            [
                "experiment",
                "percentile",
                "original_tp",
                "original_fp",
                "original_precision",
                "original_recall",
                "contextual_recall",
                "benign_fpr",
            ]
        ].to_string(index=False)
    )

    print("\nALERT BUDGET COMPARISON")

    print(budget_df.to_string(index=False))

    plt.figure(figsize=(9, 6))

    plt.bar(
        comparison_df["experiment"],
        comparison_df["average_precision"],
    )

    plt.ylabel("Average Precision")
    plt.title("Detection Ranking by Representation")
    plt.grid(axis="y", alpha=0.25)
    plt.tight_layout()

    plt.savefig(
        OUTPUT / "average_precision_comparison.png",
        dpi=200,
    )

    plt.close()

    plt.figure(figsize=(10, 6))

    for name, group in budget_df.groupby(
        "experiment", sort=False
    ):
        plt.plot(
            group["alert_budget"],
            group["expected_recall"],
            marker="o",
            label=name,
        )

    plt.xscale("log")
    plt.xlabel("Alert budget")
    plt.ylabel("Expected recall")
    plt.title("Detection Under Limited Analyst Capacity")
    plt.legend()
    plt.grid(alpha=0.25)
    plt.tight_layout()

    plt.savefig(
        OUTPUT / "alert_budget_comparison.png",
        dpi=200,
    )

    plt.close()

    print("\nABLATION COMPARISON COMPLETED")
    print(f"Results saved to: {OUTPUT}")


if __name__ == "__main__":
    main()
