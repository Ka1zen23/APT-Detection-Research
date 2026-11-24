
from pathlib import Path

import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from sklearn.metrics import (
    average_precision_score,
    roc_auc_score,
    precision_recall_curve,
    confusion_matrix,
)


ROOT = Path(__file__).resolve().parents[1]

OUTPUT = ROOT / "results/autoencoder_comparison"

EXPERIMENTS = {
    "E2-A": "e2-v2-minilm-standard",
    "E2-B": "e2b-unique",
    "E2-C": "e2c-weighted",
    "E2-D": "e2d-unique-matched",
}

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

ALERT_BUDGETS = [
    50,
    100,
    200,
    500,
    1000,
    2000,
    5000,
    10000,
]


def calculate_metrics(labels, scores, threshold):
    labels = np.asarray(labels, dtype=int)
    scores = np.asarray(scores, dtype=np.float64)

    predictions = (scores > threshold).astype(int)

    tn, fp, fn, tp = confusion_matrix(
        labels,
        predictions,
        labels=[0, 1],
    ).ravel()

    precision = tp / (tp + fp) if tp + fp else 0
    recall = tp / (tp + fn) if tp + fn else 0

    f1 = (
        2 * precision * recall / (precision + recall)
        if precision + recall
        else 0
    )

    return {
        "tp": int(tp),
        "fp": int(fp),
        "tn": int(tn),
        "fn": int(fn),
        "alerts": int(tp + fp),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "fpr": float(fp / (fp + tn)),
    }


def load_experiment(directory):
    path = ROOT / "results" / directory

    validation = np.load(
        path / "validation_errors.npy",
        allow_pickle=False,
    ).astype(np.float64)

    benign = pd.read_parquet(
        path / "evaluation"
        / "benign_test_predictions.parquet"
    )

    attack = pd.read_parquet(
        path / "evaluation"
        / "attack_test_predictions.parquet"
    )

    assert len(validation) == 21357
    assert len(benign) == 21357
    assert len(attack) == 100892

    assert attack["original_label"].sum() == 70
    assert attack["contextual_label"].sum() == 225

    assert benign["original_label"].sum() == 0

    assert np.isfinite(validation).all()

    for frame in [benign, attack]:
        assert np.isfinite(
            frame["anomaly_score"]
        ).all()

        assert not frame.duplicated(
            ["phase", "event_id"]
        ).any()

    return validation, benign, attack


def threshold_analysis(
    experiment,
    validation,
    benign,
    attack,
):
    rows = []

    scores = attack["anomaly_score"].to_numpy(
        dtype=np.float64
    )

    original = attack["original_label"].to_numpy()
    contextual = attack["contextual_label"].to_numpy()

    benign_scores = benign[
        "anomaly_score"
    ].to_numpy(dtype=np.float64)

    for percentile in PERCENTILES:
        threshold = float(
            np.percentile(validation, percentile)
        )

        original_metrics = calculate_metrics(
            original, scores, threshold
        )

        contextual_metrics = calculate_metrics(
            contextual, scores, threshold
        )

        row = {
            "experiment": experiment,
            "percentile": percentile,
            "threshold": threshold,
            "validation_fpr": float(
                (validation > threshold).mean()
            ),
            "benign_fp": int(
                (benign_scores > threshold).sum()
            ),
            "benign_fpr": float(
                (benign_scores > threshold).mean()
            ),
        }

        for key, value in original_metrics.items():
            row[f"original_{key}"] = value

        for key, value in contextual_metrics.items():
            row[f"contextual_{key}"] = value

        rows.append(row)

    return rows


def ranking_analysis(experiment, attack):
    # Tie-aware ranking:
    # If an alert budget cuts through events with
    # identical scores, calculate expected detections
    # and the minimum/maximum possible detections.

    grouped = (
        attack.groupby("anomaly_score", sort=True)
        .agg(
            count=("original_label", "size"),
            positives=("original_label", "sum"),
        )
        .sort_index(ascending=False)
        .reset_index()
    )

    grouped["cumulative_count"] = (
        grouped["count"].cumsum()
    )

    grouped["cumulative_positives"] = (
        grouped["positives"].cumsum()
    )

    total_positives = int(
        attack["original_label"].sum()
    )

    rows = []

    for k in ALERT_BUDGETS:
        boundary = int(
            np.searchsorted(
                grouped["cumulative_count"].to_numpy(),
                k,
                side="left",
            )
        )

        row = grouped.iloc[boundary]

        before_count = (
            int(row["cumulative_count"])
            - int(row["count"])
        )

        before_positives = (
            int(row["cumulative_positives"])
            - int(row["positives"])
        )

        remaining = k - before_count

        tied_count = int(row["count"])
        tied_positives = int(row["positives"])
        tied_negatives = tied_count - tied_positives

        expected_tp = (
            before_positives
            + remaining * tied_positives / tied_count
        )

        minimum_tp = (
            before_positives
            + max(0, remaining - tied_negatives)
        )

        maximum_tp = (
            before_positives
            + min(remaining, tied_positives)
        )

        rows.append({
            "experiment": experiment,
            "alert_budget": k,
            "expected_tp": expected_tp,
            "minimum_tp": minimum_tp,
            "maximum_tp": maximum_tp,
            "expected_precision": expected_tp / k,
            "expected_recall": (
                expected_tp / total_positives
            ),
            "minimum_recall": (
                minimum_tp / total_positives
            ),
            "maximum_recall": (
                maximum_tp / total_positives
            ),
        })

    return rows


def full_recall_diagnostic(experiment, attack):
    scores = attack["anomaly_score"].to_numpy(
        dtype=np.float64
    )

    original = attack["original_label"].to_numpy()
    contextual = attack["contextual_label"].to_numpy()

    min_positive = scores[original == 1].min()

    threshold = float(
        np.nextafter(min_positive, -np.inf)
    )

    metrics = calculate_metrics(
        original, scores, threshold
    )

    contextual_metrics = calculate_metrics(
        contextual, scores, threshold
    )

    return {
        "experiment": experiment,
        "threshold": threshold,
        **metrics,
        "contextual_recall": contextual_metrics["recall"],
        "exploratory_only": True,
    }


def save_plots(thresholds, rankings, curves):
    plt.figure(figsize=(10, 6))

    for experiment, (recall, precision, ap) in curves.items():
        plt.plot(
            recall,
            precision,
            label=f"{experiment} (AP={ap:.4f})",
        )

    plt.axhline(
        70 / 100892,
        linestyle="--",
        label="Positive prevalence",
    )

    plt.xlabel("Recall")
    plt.ylabel("Precision")
    plt.title("Original-label Precision-Recall Curves")
    plt.legend()
    plt.grid(alpha=0.25)
    plt.tight_layout()

    plt.savefig(
        OUTPUT / "precision_recall_comparison.png",
        dpi=200,
    )
    plt.close()

    plt.figure(figsize=(10, 6))

    for experiment, group in rankings.groupby(
        "experiment", sort=False
    ):
        plt.plot(
            group["alert_budget"],
            group["expected_recall"] * 100,
            marker="o",
            label=experiment,
        )

        plt.fill_between(
            group["alert_budget"],
            group["minimum_recall"] * 100,
            group["maximum_recall"] * 100,
            alpha=0.12,
        )

    plt.xscale("log")
    plt.xlabel("Number of alerts investigated")
    plt.ylabel("Recall (%)")
    plt.title("Recall by Analyst Alert Budget")
    plt.legend()
    plt.grid(alpha=0.25)
    plt.tight_layout()

    plt.savefig(
        OUTPUT / "recall_at_k.png",
        dpi=200,
    )
    plt.close()

    plt.figure(figsize=(10, 6))

    for experiment, group in thresholds.groupby(
        "experiment", sort=False
    ):
        plt.plot(
            np.arange(len(group)),
            group["original_fp"],
            marker="o",
            label=experiment,
        )

    plt.xticks(
        np.arange(len(PERCENTILES)),
        [str(p) for p in PERCENTILES],
    )

    plt.xlabel("Benign validation percentile")
    plt.ylabel("False positives")
    plt.title("Threshold Sensitivity Comparison")
    plt.legend()
    plt.grid(alpha=0.25)
    plt.tight_layout()

    plt.savefig(
        OUTPUT / "threshold_comparison.png",
        dpi=200,
    )
    plt.close()


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)

    threshold_rows = []
    ranking_rows = []
    diagnostic_rows = []
    summary_rows = []
    curves = {}

    reference = None

    for experiment, directory in EXPERIMENTS.items():
        print(f"\nEvaluating {experiment}")

        validation, benign, attack = load_experiment(
            directory
        )

        # Verify identical evaluation events and labels.
        identity = attack[
            [
                "phase",
                "event_id",
                "original_label",
                "contextual_label",
            ]
        ].sort_values(
            ["phase", "event_id"]
        ).reset_index(drop=True)

        if reference is None:
            reference = identity
        else:
            pd.testing.assert_frame_equal(
                reference, identity
            )

        scores = attack["anomaly_score"].to_numpy()
        labels = attack["original_label"].to_numpy()

        ap = average_precision_score(labels, scores)
        roc_auc = roc_auc_score(labels, scores)

        precision, recall, _ = precision_recall_curve(
            labels, scores
        )

        curves[experiment] = (
            recall,
            precision,
            ap,
        )

        summary_rows.append({
            "experiment": experiment,
            "roc_auc": roc_auc,
            "average_precision": ap,
        })

        threshold_rows.extend(
            threshold_analysis(
                experiment,
                validation,
                benign,
                attack,
            )
        )

        ranking_rows.extend(
            ranking_analysis(experiment, attack)
        )

        diagnostic_rows.append(
            full_recall_diagnostic(
                experiment, attack
            )
        )

    thresholds = pd.DataFrame(threshold_rows)
    rankings = pd.DataFrame(ranking_rows)
    diagnostics = pd.DataFrame(diagnostic_rows)
    summary = pd.DataFrame(summary_rows)

    thresholds.to_csv(
        OUTPUT / "threshold_comparison.csv",
        index=False,
    )

    rankings.to_csv(
        OUTPUT / "alert_budget_comparison.csv",
        index=False,
    )

    diagnostics.to_csv(
        OUTPUT / "full_recall_diagnostic.csv",
        index=False,
    )

    summary.to_csv(
        OUTPUT / "ranking_summary.csv",
        index=False,
    )

    print("\nRANKING SUMMARY")
    print(summary.to_string(index=False))

    print("\nTHRESHOLD COMPARISON")

    print(
        thresholds[
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

    print(
        rankings[
            [
                "experiment",
                "alert_budget",
                "expected_tp",
                "minimum_tp",
                "maximum_tp",
                "expected_precision",
                "expected_recall",
            ]
        ].to_string(index=False)
    )

    print("\nRETROSPECTIVE FULL-RECALL DIAGNOSTIC")
    print(diagnostics.to_string(index=False))

    save_plots(
        thresholds,
        rankings,
        curves,
    )

    print("\nCOMPARISON COMPLETED")
    print(f"Results saved to: {OUTPUT}")
    print("Existing checkpoints remain unchanged.")


if __name__ == "__main__":
    main()
