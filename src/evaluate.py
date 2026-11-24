
from pathlib import Path
import json
import time

import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import torch

from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    ConfusionMatrixDisplay,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    roc_curve,
    precision_recall_curve,
    auc,
)

from autoencoder import Autoencoder


ROOT = Path(__file__).resolve().parents[1]

DATA = (
    ROOT / "data/embeddings/cicapt-iiot"
    / "v2-minilm-standard"
)

PROCESSED = ROOT / "data/processed/cicapt-iiot-v2"

MODEL_PATH = (
    ROOT / "models/e2-v2-minilm-standard"
    / "autoencoder.pt"
)

OUTPUT = (
    ROOT / "results/e2-v2-minilm-standard"
    / "evaluation"
)

BATCH_SIZE = 1024


def load_partition(name):
    embeddings = np.load(
        DATA / f"{name}_embeddings.npy",
        allow_pickle=False
    )

    metadata = pd.read_parquet(
        DATA / f"{name}_metadata.parquet"
    )

    assert embeddings.shape == (len(metadata), 384)
    assert np.isfinite(embeddings).all()

    assert np.array_equal(
        metadata["embedding_index"].to_numpy(),
        np.arange(len(metadata))
    )

    assert (metadata["split"] == name).all()

    return embeddings, metadata


@torch.inference_mode()
def score_events(model, embeddings, device):
    model.eval()

    errors = []

    # Warm up GPU before timing.
    warmup = torch.from_numpy(
        embeddings[:BATCH_SIZE]
    ).to(device)

    model(warmup)

    torch.cuda.synchronize()

    started = time.perf_counter()

    for start in range(
        0, len(embeddings), BATCH_SIZE
    ):
        batch = torch.from_numpy(
            embeddings[start:start + BATCH_SIZE]
        ).to(device)

        reconstructed = model(batch)

        scores = (
            (batch - reconstructed)
            .pow(2)
            .mean(dim=1)
        )

        errors.append(scores.cpu().numpy())

    torch.cuda.synchronize()

    elapsed = time.perf_counter() - started

    scores = np.concatenate(errors)

    assert np.isfinite(scores).all()

    timing = {
        "events": len(scores),
        "elapsed_seconds": elapsed,
        "events_per_second": len(scores) / elapsed,
        "milliseconds_per_event": (
            elapsed / len(scores) * 1000
        ),
    }

    return scores, timing


def calculate_metrics(labels, scores, threshold):
    labels = np.asarray(labels, dtype=int)

    predictions = (
        scores > threshold
    ).astype(int)

    tn, fp, fn, tp = confusion_matrix(
        labels,
        predictions,
        labels=[0, 1]
    ).ravel()

    metrics = {
        "records": len(labels),
        "positives": int(labels.sum()),
        "alerts": int(predictions.sum()),
        "threshold": float(threshold),
        "true_negatives": int(tn),
        "false_positives": int(fp),
        "false_negatives": int(fn),
        "true_positives": int(tp),
        "accuracy": float(
            accuracy_score(labels, predictions)
        ),
        "precision": float(
            precision_score(
                labels,
                predictions,
                zero_division=0
            )
        ),
        "recall": float(
            recall_score(
                labels,
                predictions,
                zero_division=0
            )
        ) if tp + fn else None,
        "f1": float(
            f1_score(
                labels,
                predictions,
                zero_division=0
            )
        ) if tp + fn else None,
        "false_positive_rate": (
            float(fp / (fp + tn))
            if fp + tn else None
        ),
        "specificity": (
            float(tn / (tn + fp))
            if tn + fp else None
        ),
        "roc_auc": None,
        "average_precision": None,
        "pr_auc": None,
    }

    if len(np.unique(labels)) == 2:
        precision, recall, _ = (
            precision_recall_curve(labels, scores)
        )

        metrics["roc_auc"] = float(
            roc_auc_score(labels, scores)
        )

        metrics["average_precision"] = float(
            average_precision_score(labels, scores)
        )

        metrics["pr_auc"] = float(
            auc(recall, precision)
        )

    return metrics


def print_metrics(name, metrics):
    print("\n" + "=" * 70)
    print(name.upper())
    print("=" * 70)

    for key, value in metrics.items():
        if value is None:
            print(f"{key}: N/A")
        elif isinstance(value, float):
            print(f"{key}: {value:.10f}")
        else:
            print(f"{key}: {value:,}")


def save_evaluation_plots(
    labels, scores, threshold, name
):
    predictions = (
        scores > threshold
    ).astype(int)

    matrix = confusion_matrix(
        labels,
        predictions,
        labels=[0, 1]
    )

    fig, ax = plt.subplots(figsize=(7, 6))

    ConfusionMatrixDisplay(
        confusion_matrix=matrix,
        display_labels=["Normal", "Positive"]
    ).plot(
        ax=ax,
        cmap="Blues",
        values_format="d",
        colorbar=False
    )

    ax.set_title(f"Confusion Matrix - {name}")

    fig.tight_layout()

    fig.savefig(
        OUTPUT / f"{name}_confusion_matrix.png",
        dpi=200
    )

    plt.close(fig)

    if len(np.unique(labels)) != 2:
        return

    # ROC curve
    fpr, tpr, _ = roc_curve(labels, scores)

    roc_score = roc_auc_score(labels, scores)

    plt.figure(figsize=(8, 6))

    plt.plot(
        fpr,
        tpr,
        label=f"ROC-AUC = {roc_score:.4f}"
    )

    plt.plot(
        [0, 1],
        [0, 1],
        linestyle="--",
        label="Random baseline"
    )

    plt.xlabel("False positive rate")
    plt.ylabel("True positive rate")
    plt.title(f"ROC Curve - {name}")
    plt.legend()
    plt.grid(alpha=0.25)
    plt.tight_layout()

    plt.savefig(
        OUTPUT / f"{name}_roc_curve.png",
        dpi=200
    )

    plt.close()

    # Precision-recall curve
    precision, recall, _ = (
        precision_recall_curve(labels, scores)
    )

    ap = average_precision_score(labels, scores)

    plt.figure(figsize=(8, 6))

    plt.plot(
        recall,
        precision,
        label=f"Average Precision = {ap:.4f}"
    )

    plt.axhline(
        labels.mean(),
        linestyle="--",
        label="Positive prevalence"
    )

    plt.xlabel("Recall")
    plt.ylabel("Precision")
    plt.title(f"Precision-Recall Curve - {name}")
    plt.legend()
    plt.grid(alpha=0.25)
    plt.tight_layout()

    plt.savefig(
        OUTPUT / f"{name}_pr_curve.png",
        dpi=200
    )

    plt.close()

    # Reconstruction error distributions
    plt.figure(figsize=(10, 6))

    for label, description in [
        (0, "Negative annotations"),
        (1, "Positive annotations")
    ]:
        subset = scores[labels == label]

        plt.hist(
            subset,
            bins=80,
            density=True,
            alpha=0.55,
            label=description
        )

    plt.axvline(
        threshold,
        linestyle="--",
        label="Calibrated threshold"
    )

    plt.xlabel("Reconstruction error")
    plt.ylabel("Probability density")
    plt.title(f"Anomaly Score Distribution - {name}")
    plt.legend()
    plt.tight_layout()

    plt.savefig(
        OUTPUT / f"{name}_score_distribution.png",
        dpi=200
    )

    plt.close()


def evaluate_tactics(df, label_column, tactic_column):
    positives = df[
        df[label_column] == 1
    ].copy()

    tactics = positives.explode(tactic_column)

    tactics = tactics.dropna(
        subset=[tactic_column]
    )

    rows = []

    for tactic, group in tactics.groupby(
        tactic_column
    ):
        detected = int(
            group["prediction"].sum()
        )

        rows.append({
            "tactic": str(tactic),
            "positive_events": len(group),
            "detected_events": detected,
            "missed_events": len(group) - detected,
            "recall": detected / len(group),
        })

    return pd.DataFrame(
        rows,
        columns=[
            "tactic",
            "positive_events",
            "detected_events",
            "missed_events",
            "recall",
        ]
    )


def attach_descriptions(metadata):
    events = pd.concat(
        [
            pd.read_parquet(
                PROCESSED / "phase1_events.parquet",
                columns=["phase", "event_id", "text"]
            ),
            pd.read_parquet(
                PROCESSED / "phase2_events.parquet",
                columns=["phase", "event_id", "text"]
            ),
        ],
        ignore_index=True
    )

    result = metadata.merge(
        events,
        on=["phase", "event_id"],
        how="left",
        validate="one_to_one",
        sort=False
    )

    assert result["text"].notna().all()

    assert np.array_equal(
        result["embedding_index"].to_numpy(),
        metadata["embedding_index"].to_numpy()
    )

    return result


def evaluate_description_overlap(df, threshold):
    train_metadata = pd.read_parquet(
        DATA / "train_metadata.parquet"
    )

    train = attach_descriptions(train_metadata)

    known_texts = set(train["text"])

    df["seen_in_training"] = (
        df["text"].isin(known_texts)
    )

    results = {}

    for name, mask in [
        ("seen", df["seen_in_training"]),
        ("unseen", ~df["seen_in_training"]),
    ]:
        subset = df[mask]

        if subset.empty:
            continue

        metrics = calculate_metrics(
            subset["original_label"].to_numpy(),
            subset["anomaly_score"].to_numpy(),
            threshold
        )

        results[name] = metrics

        print_metrics(
            f"Attack test - {name} descriptions",
            metrics
        )

    return results


def main():
    OUTPUT.mkdir(
        parents=True,
        exist_ok=True
    )

    if not torch.cuda.is_available():
        raise RuntimeError("CUDA is unavailable.")

    device = torch.device("cuda")

    checkpoint = torch.load(
        MODEL_PATH,
        map_location="cpu",
        weights_only=True
    )

    model = Autoencoder(
        input_dim=checkpoint["input_dim"]
    ).to(device)

    model.load_state_dict(
        checkpoint["model_state_dict"]
    )

    model.eval()

    threshold = float(checkpoint["threshold"])

    print("CICAPT-IIoT MODEL EVALUATION")
    print("Experiment:", checkpoint["experiment"])
    print("Best epoch:", checkpoint["best_epoch"])
    print(f"Threshold: {threshold:.10f}")
    print("GPU:", torch.cuda.get_device_name(0))

    summary = {
        "experiment": checkpoint["experiment"],
        "best_epoch": checkpoint["best_epoch"],
        "threshold": threshold,
        "threshold_percentile": (
            checkpoint["threshold_percentile"]
        ),
    }

    # Evaluate both previously unused partitions.
    for name in ["benign_test", "attack_test"]:
        embeddings, metadata = load_partition(name)

        scores, timing = score_events(
            model,
            embeddings,
            device
        )

        metadata["anomaly_score"] = scores

        metadata["prediction"] = (
            scores > threshold
        ).astype(int)

        metadata["threshold_ratio"] = (
            scores / threshold
        )

        metadata = attach_descriptions(metadata)

        summary[name] = {
            "inference": timing
        }

        label_columns = ["original_label"]

        if name == "attack_test":
            label_columns.append("contextual_label")

        for label_column in label_columns:
            evaluation_name = (
                f"{name}_{label_column}"
            )

            labels = metadata[
                label_column
            ].to_numpy()

            metrics = calculate_metrics(
                labels,
                scores,
                threshold
            )

            summary[name][label_column] = metrics

            print_metrics(
                evaluation_name,
                metrics
            )

            save_evaluation_plots(
                labels,
                scores,
                threshold,
                evaluation_name
            )

        if name == "attack_test":
            summary[name]["description_overlap"] = (
                evaluate_description_overlap(
                    metadata,
                    threshold
                )
            )

            for label_col, tactic_col in [
                ("original_label", "original_tactics"),
                ("contextual_label", "contextual_tactics"),
            ]:
                tactics = evaluate_tactics(
                    metadata,
                    label_col,
                    tactic_col
                )

                print(
                    f"\nPER-TACTIC RESULTS: {label_col}"
                )

                print(tactics.to_string(index=False))

                tactics.to_csv(
                    OUTPUT / f"{label_col}_tactics.csv",
                    index=False
                )

                summary[name][f"{label_col}_tactics"] = (
                    tactics.to_dict("records")
                )

        metadata.to_parquet(
            OUTPUT / f"{name}_predictions.parquet",
            index=False
        )

        alerts = metadata[
            metadata["prediction"] == 1
        ].sort_values(
            "anomaly_score",
            ascending=False
        )

        alerts.to_csv(
            OUTPUT / f"{name}_alerts.csv",
            index=False
        )

        print("\nINFERENCE PERFORMANCE")

        for key, value in timing.items():
            print(f"{key}: {value:.6f}")

    with open(
        OUTPUT / "evaluation_summary.json",
        "w"
    ) as file:
        json.dump(summary, file, indent=4)

    print("\n" + "=" * 70)
    print("EVALUATION COMPLETED")
    print("=" * 70)
    print(f"Results saved to: {OUTPUT}")


if __name__ == "__main__":
    main()
