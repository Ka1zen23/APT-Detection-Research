
from pathlib import Path
import json

import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from sklearn.metrics import (
    confusion_matrix,
    precision_score,
    recall_score,
    f1_score,
)


ROOT = Path(__file__).resolve().parents[1]

RESULTS = ROOT / "results/e2-v2-minilm-standard"
EVALUATION = RESULTS / "evaluation"
OUTPUT = RESULTS / "threshold_analysis"

PERCENTILES = [
    95,
    97,
    98,
    99,
    99.5,
    99.9,
    99.95,
    99.99,
    100,
]


def calculate_metrics(labels, scores, threshold):
    predictions = (scores > threshold).astype(int)

    tn, fp, fn, tp = confusion_matrix(
        labels,
        predictions,
        labels=[0, 1],
    ).ravel()

    return {
        "alerts": int(predictions.sum()),
        "tp": int(tp),
        "fp": int(fp),
        "tn": int(tn),
        "fn": int(fn),
        "precision": float(
            precision_score(
                labels,
                predictions,
                zero_division=0,
            )
        ),
        "recall": float(
            recall_score(
                labels,
                predictions,
                zero_division=0,
            )
        ) if tp + fn else None,
        "f1": float(
            f1_score(
                labels,
                predictions,
                zero_division=0,
            )
        ) if tp + fn else None,
        "fpr": float(fp / (fp + tn))
        if fp + tn else None,
    }


def print_score_statistics(name, scores):
    print("\n" + name.upper())

    for percentile in [0, 25, 50, 75, 95, 99, 100]:
        value = np.percentile(scores, percentile)

        print(
            f"P{percentile}: {value:.10f}"
        )

    print(f"Mean: {scores.mean():.10f}")


def save_plots(results):
    x = np.arange(len(results))

    labels = [
        str(p) for p in results["percentile"]
    ]

    plt.figure(figsize=(10, 6))

    plt.plot(
        x,
        results["original_recall"] * 100,
        marker="o",
        label="Original recall",
    )

    plt.plot(
        x,
        results["contextual_recall"] * 100,
        marker="s",
        label="Contextual recall",
    )

    plt.plot(
        x,
        results["original_precision"] * 100,
        marker="^",
        label="Original precision",
    )

    plt.xticks(x, labels)
    plt.xlabel("Benign validation percentile")
    plt.ylabel("Percentage")
    plt.title("Threshold Sensitivity Analysis")
    plt.legend()
    plt.grid(alpha=0.25)
    plt.tight_layout()

    plt.savefig(
        OUTPUT / "precision_recall_vs_threshold.png",
        dpi=200,
    )

    plt.close()

    plt.figure(figsize=(10, 6))

    plt.plot(
        x,
        results["original_fp"],
        marker="o",
        label="Attack scenario false positives",
    )

    plt.plot(
        x,
        results["benign_fp"],
        marker="s",
        label="Benign test false positives",
    )

    plt.xticks(x, labels)
    plt.xlabel("Benign validation percentile")
    plt.ylabel("False positive events")
    plt.title("False Positives vs Threshold")
    plt.legend()
    plt.grid(alpha=0.25)
    plt.tight_layout()

    plt.savefig(
        OUTPUT / "false_positives_vs_threshold.png",
        dpi=200,
    )

    plt.close()


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)

    validation = np.load(
        RESULTS / "validation_errors.npy",
        allow_pickle=False,
    )

    benign = pd.read_parquet(
        EVALUATION / "benign_test_predictions.parquet"
    )

    attack = pd.read_parquet(
        EVALUATION / "attack_test_predictions.parquet"
    )

    with open(
        EVALUATION / "evaluation_summary.json"
    ) as file:
        evaluation_summary = json.load(file)

    baseline_threshold = float(
        evaluation_summary["threshold"]
    )

    benign_scores = benign[
        "anomaly_score"
    ].to_numpy()

    attack_scores = attack[
        "anomaly_score"
    ].to_numpy()

    original_labels = attack[
        "original_label"
    ].to_numpy()

    contextual_labels = attack[
        "contextual_label"
    ].to_numpy()

    assert len(validation) == 21357
    assert len(benign) == 21357
    assert len(attack) == 100892

    assert original_labels.sum() == 70
    assert contextual_labels.sum() == 225

    assert np.isfinite(validation).all()
    assert np.isfinite(benign_scores).all()
    assert np.isfinite(attack_scores).all()

    print("E2 EXPLORATORY THRESHOLD ANALYSIS")
    print(f"Baseline threshold: {baseline_threshold:.10f}")

    print_score_statistics(
        "Benign validation",
        validation,
    )

    print_score_statistics(
        "Benign test",
        benign_scores,
    )

    print_score_statistics(
        "Attack scenario negative annotations",
        attack_scores[original_labels == 0],
    )

    print_score_statistics(
        "Original malicious events",
        attack_scores[original_labels == 1],
    )

    print_score_statistics(
        "Contextual positive events",
        attack_scores[contextual_labels == 1],
    )

    rows = []

    for percentile in PERCENTILES:
        threshold = float(
            np.percentile(validation, percentile)
        )

        if percentile == 99:
            assert np.isclose(
                threshold,
                baseline_threshold,
                rtol=1e-6,
                atol=1e-12,
            )

            threshold = baseline_threshold

        row = {
            "percentile": percentile,
            "threshold": threshold,
            "validation_fpr": float(
                (validation > threshold).mean()
            ),
        }

        evaluations = [
            (
                "benign",
                benign["original_label"].to_numpy(),
                benign_scores,
            ),
            (
                "original",
                original_labels,
                attack_scores,
            ),
            (
                "contextual",
                contextual_labels,
                attack_scores,
            ),
        ]

        for prefix, labels, scores in evaluations:
            metrics = calculate_metrics(
                labels,
                scores,
                threshold,
            )

            for key, value in metrics.items():
                row[f"{prefix}_{key}"] = value

        rows.append(row)

    results = pd.DataFrame(rows)

    results.to_csv(
        OUTPUT / "threshold_comparison.csv",
        index=False,
    )

    print("\nORIGINAL LABEL RESULTS")

    columns = [
        "percentile",
        "threshold",
        "original_tp",
        "original_fp",
        "original_fn",
        "original_precision",
        "original_recall",
        "original_f1",
        "original_fpr",
    ]

    print(
        results[columns].to_string(
            index=False,
            float_format=lambda x: f"{x:.8f}",
        )
    )

    print("\nBENIGN TEST RESULTS")

    print(
        results[
            [
                "percentile",
                "validation_fpr",
                "benign_fp",
                "benign_fpr",
            ]
        ].to_string(index=False)
    )

    print("\nCONTEXTUAL LABEL RESULTS")

    print(
        results[
            [
                "percentile",
                "contextual_tp",
                "contextual_fp",
                "contextual_fn",
                "contextual_precision",
                "contextual_recall",
                "contextual_f1",
            ]
        ].to_string(index=False)
    )

    # Retrospective diagnostic only.
    # This uses attack labels and must not be treated
    # as an independently calibrated threshold.
    min_positive_score = float(
        attack_scores[original_labels == 1].min()
    )

    max_full_recall_threshold = float(
        np.nextafter(
            np.float64(min_positive_score),
            -np.inf,
        )
    )

    diagnostic = calculate_metrics(
        original_labels,
        attack_scores.astype(np.float64),
        max_full_recall_threshold,
    )

    print("\nRETROSPECTIVE FULL-RECALL DIAGNOSTIC")
    print(
        "Minimum original positive score:",
        f"{min_positive_score:.12f}",
    )

    print(
        "Threshold immediately below minimum:",
        f"{max_full_recall_threshold:.12f}",
    )

    print(json.dumps(diagnostic, indent=4))

    with open(
        OUTPUT / "retrospective_diagnostic.json",
        "w",
    ) as file:
        json.dump(
            {
                "exploratory_only": True,
                "threshold": max_full_recall_threshold,
                "metrics": diagnostic,
            },
            file,
            indent=4,
        )

    save_plots(results)

    print("\nAnalysis completed.")
    print(f"Output directory: {OUTPUT}")
    print("Original E2 checkpoint remains unchanged.")


if __name__ == "__main__":
    main()

