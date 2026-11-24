
from pathlib import Path
import json
import time

import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from sklearn.decomposition import PCA
from sklearn.ensemble import IsolationForest
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import (
    confusion_matrix,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    average_precision_score,
    precision_recall_curve,
    auc,
)

ROOT = Path(__file__).resolve().parents[1]

DATA = (
    ROOT / "data/embeddings/cicapt-iiot"
    / "v2-minilm-standard"
)

PROCESSED = ROOT / "data/processed/cicapt-iiot-v2"

E2 = (
    ROOT / "results/e2-v2-minilm-standard"
    / "evaluation"
)

OUTPUT = ROOT / "results/baselines"

SEED = 42
PERCENTILE = 99

PARTITIONS = [
    "train",
    "validation",
    "benign_test",
    "attack_test",
]


def load_data():
    events = pd.concat(
        [
            pd.read_parquet(
                PROCESSED / "phase1_events.parquet",
                columns=["phase", "event_id", "text"],
            ),
            pd.read_parquet(
                PROCESSED / "phase2_events.parquet",
                columns=["phase", "event_id", "text"],
            ),
        ],
        ignore_index=True,
    )

    datasets = {}

    for name in PARTITIONS:
        embeddings = np.load(
            DATA / f"{name}_embeddings.npy",
            allow_pickle=False,
        )

        metadata = pd.read_parquet(
            DATA / f"{name}_metadata.parquet"
        )

        assert embeddings.shape == (
            len(metadata), 384
        )

        assert np.isfinite(embeddings).all()

        assert np.array_equal(
            metadata["embedding_index"].to_numpy(),
            np.arange(len(metadata)),
        )

        assert (metadata["split"] == name).all()

        if "text" not in metadata.columns:
            metadata = metadata.merge(
                events,
                on=["phase", "event_id"],
                how="left",
                validate="one_to_one",
                sort=False,
            )

        assert metadata["text"].notna().all()

        assert np.array_equal(
            metadata["embedding_index"].to_numpy(),
            np.arange(len(metadata)),
        )

        if name != "attack_test":
            assert metadata["original_label"].sum() == 0
            assert metadata["contextual_label"].sum() == 0

        datasets[name] = {
            "embeddings": embeddings,
            "metadata": metadata,
            "texts": metadata["text"].tolist(),
        }

        print(
            f"Loaded {name}: "
            f"{len(metadata):,} events"
        )

    return datasets


def calculate_metrics(labels, scores, threshold):
    labels = np.asarray(labels, dtype=int)
    scores = np.asarray(scores, dtype=np.float64)

    assert len(labels) == len(scores)
    assert np.isfinite(scores).all()

    predictions = (scores > threshold).astype(int)

    tn, fp, fn, tp = confusion_matrix(
        labels,
        predictions,
        labels=[0, 1],
    ).ravel()

    result = {
        "records": len(labels),
        "threshold": float(threshold),
        "tp": int(tp),
        "fp": int(fp),
        "tn": int(tn),
        "fn": int(fn),
        "alerts": int(predictions.sum()),
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
        "roc_auc": None,
        "average_precision": None,
        "pr_auc": None,
    }

    if len(np.unique(labels)) == 2:
        precision, recall, _ = precision_recall_curve(
            labels, scores
        )

        result["roc_auc"] = float(
            roc_auc_score(labels, scores)
        )

        result["average_precision"] = float(
            average_precision_score(labels, scores)
        )

        result["pr_auc"] = float(
            auc(recall, precision)
        )

    return result


def evaluate(
    name,
    datasets,
    scores,
    elapsed,
    threshold=None,
    calibration="validation_percentile_99",
):
    if threshold is None:
        threshold = float(
            np.percentile(
                scores["validation"],
                PERCENTILE,
            )
        )

    result = {
        "experiment": name,
        "threshold": threshold,
        "calibration": calibration,
        "elapsed_seconds": elapsed,
    }

    evaluations = [
        ("validation", "original_label"),
        ("benign_test", "original_label"),
        ("attack_test", "original_label"),
        ("attack_test", "contextual_label"),
    ]

    for partition, label in evaluations:
        key = f"{partition}_{label}"

        metadata = datasets[partition]["metadata"]

        result[key] = calculate_metrics(
            metadata[label].to_numpy(),
            scores[partition],
            threshold,
        )

    attack = result["attack_test_original_label"]

    print("\n" + "=" * 60)
    print(name)
    print("=" * 60)

    print(f"Threshold: {threshold:.10f}")
    print(f"True positives: {attack['tp']:,}")
    print(f"False positives: {attack['fp']:,}")
    print(f"False negatives: {attack['fn']:,}")
    print(f"Precision: {attack['precision']:.6f}")
    print(f"Recall: {attack['recall']:.6f}")
    print(f"F1: {attack['f1']:.6f}")
    print(f"ROC-AUC: {attack['roc_auc']:.6f}")
    print(f"AP: {attack['average_precision']:.6f}")
    print(f"Attack FPR: {attack['fpr']:.6f}")

    print(
        "Benign test FPR:",
        f"{result['benign_test_original_label']['fpr']:.6f}",
    )

    print(f"Elapsed: {elapsed:.2f}s")

    # Save individual event scores for later analysis.
    experiment_dir = OUTPUT / name
    experiment_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    for partition in [
        "validation",
        "benign_test",
        "attack_test",
    ]:
        metadata = datasets[partition][
            "metadata"
        ].copy()

        metadata["anomaly_score"] = scores[partition]

        metadata["prediction"] = (
            scores[partition] > threshold
        ).astype(int)

        metadata.to_parquet(
            experiment_dir / f"{partition}_predictions.parquet",
            index=False,
        )

    return result


def exact_novelty(datasets):
    started = time.perf_counter()

    known = set(datasets["train"]["texts"])

    scores = {}

    for partition in [
        "validation",
        "benign_test",
        "attack_test",
    ]:
        scores[partition] = np.array(
            [
                float(text not in known)
                for text in datasets[partition]["texts"]
            ],
            dtype=np.float64,
        )

    return evaluate(
        "B1_exact_novelty",
        datasets,
        scores,
        time.perf_counter() - started,
        threshold=0.5,
        calibration="binary_novelty_rule",
    )


def tfidf_isolation_forest(datasets):
    started = time.perf_counter()

    vectorizer = TfidfVectorizer(
        lowercase=True,
        ngram_range=(1, 2),
        max_features=20000,
        min_df=2,
        dtype=np.float32,
    )

    train = vectorizer.fit_transform(
        datasets["train"]["texts"]
    )

    model = IsolationForest(
        n_estimators=200,
        max_samples=256,
        contamination="auto",
        random_state=SEED,
        n_jobs=-1,
    )

    model.fit(train)

    scores = {}

    for partition in [
        "validation",
        "benign_test",
        "attack_test",
    ]:
        features = vectorizer.transform(
            datasets[partition]["texts"]
        )

        # Isolation Forest gives lower scores to
        # more anomalous samples. Reverse the sign.
        scores[partition] = -model.score_samples(
            features
        )

    return evaluate(
        "B2_tfidf_isolation_forest",
        datasets,
        scores,
        time.perf_counter() - started,
    )


def minilm_pca(datasets):
    started = time.perf_counter()

    model = PCA(
        n_components=32,
        svd_solver="randomized",
        random_state=SEED,
    )

    model.fit(
        datasets["train"]["embeddings"]
    )

    scores = {}

    for partition in [
        "validation",
        "benign_test",
        "attack_test",
    ]:
        embeddings = datasets[partition]["embeddings"]

        compressed = model.transform(embeddings)

        reconstructed = model.inverse_transform(
            compressed
        )

        scores[partition] = np.mean(
            (embeddings - reconstructed) ** 2,
            axis=1,
        )

    print(
        "PCA explained variance:",
        model.explained_variance_ratio_.sum(),
    )

    return evaluate(
        "B3_minilm_pca",
        datasets,
        scores,
        time.perf_counter() - started,
    )


def minilm_isolation_forest(datasets):
    started = time.perf_counter()

    model = IsolationForest(
        n_estimators=200,
        max_samples=256,
        contamination="auto",
        random_state=SEED,
        n_jobs=-1,
    )

    model.fit(
        datasets["train"]["embeddings"]
    )

    scores = {}

    for partition in [
        "validation",
        "benign_test",
        "attack_test",
    ]:
        scores[partition] = -model.score_samples(
            datasets[partition]["embeddings"]
        )

    return evaluate(
        "B4_minilm_isolation_forest",
        datasets,
        scores,
        time.perf_counter() - started,
    )


def load_e2():
    with open(
        E2 / "evaluation_summary.json"
    ) as file:
        summary = json.load(file)

    result = {
        "experiment": "E2_minilm_autoencoder",
        "threshold": summary["threshold"],
        "calibration": "validation_percentile_99",
        "elapsed_seconds": None,
    }

    for partition, label in [
        ("benign_test", "original_label"),
        ("attack_test", "original_label"),
        ("attack_test", "contextual_label"),
    ]:
        original = summary[partition][label]

        result[f"{partition}_{label}"] = {
            "tp": original["true_positives"],
            "fp": original["false_positives"],
            "tn": original["true_negatives"],
            "fn": original["false_negatives"],
            "precision": original["precision"],
            "recall": original["recall"],
            "f1": original["f1"],
            "fpr": original["false_positive_rate"],
            "roc_auc": original["roc_auc"],
            "average_precision": original[
                "average_precision"
            ],
            "pr_auc": original["pr_auc"],
        }

    with open(
        E2.parent / "training_summary.json"
    ) as file:
        training = json.load(file)

    result["validation_original_label"] = {
        "fpr": training[
            "validation_false_positive_rate"
        ],
    }

    return result


def create_comparison(results):
    rows = []

    for result in results:
        attack = result["attack_test_original_label"]
        contextual = result[
            "attack_test_contextual_label"
        ]

        benign = result["benign_test_original_label"]
        validation = result[
            "validation_original_label"
        ]

        rows.append({
            "experiment": result["experiment"],
            "calibration": result["calibration"],
            "threshold": result["threshold"],
            "tp": attack["tp"],
            "fp": attack["fp"],
            "fn": attack["fn"],
            "precision": attack["precision"],
            "recall": attack["recall"],
            "f1": attack["f1"],
            "roc_auc": attack["roc_auc"],
            "average_precision": attack[
                "average_precision"
            ],
            "pr_auc": attack["pr_auc"],
            "attack_fpr": attack["fpr"],
            "validation_fpr": validation["fpr"],
            "benign_fpr": benign["fpr"],
            "contextual_recall": contextual["recall"],
            "contextual_f1": contextual["f1"],
        })

    comparison = pd.DataFrame(rows)

    comparison.to_csv(
        OUTPUT / "baseline_comparison.csv",
        index=False,
    )

    print("\n" + "=" * 70)
    print("BASELINE COMPARISON")
    print("=" * 70)

    print(
        comparison[
            [
                "experiment",
                "tp",
                "fp",
                "precision",
                "recall",
                "f1",
                "roc_auc",
                "average_precision",
                "attack_fpr",
                "validation_fpr",
                "benign_fpr",
            ]
        ].to_string(index=False)
    )

    return comparison


def save_plots(comparison):
    names = comparison["experiment"]

    for metric, title in [
        ("roc_auc", "ROC-AUC Comparison"),
        ("average_precision", "Average Precision Comparison"),
        ("f1", "F1-score Comparison"),
        ("recall", "Recall Comparison"),
        ("attack_fpr", "Attack Scenario False Positive Rate"),
        ("benign_fpr", "Benign Test False Positive Rate"),
    ]:
        plt.figure(figsize=(11, 6))

        plt.barh(names, comparison[metric])

        plt.xlabel(metric.replace("_", " ").title())
        plt.title(title)
        plt.grid(axis="x", alpha=0.25)
        plt.tight_layout()

        plt.savefig(
            OUTPUT / f"{metric}_comparison.png",
            dpi=200,
        )

        plt.close()


def main():
    OUTPUT.mkdir(
        parents=True,
        exist_ok=True,
    )

    print("CICAPT-IIoT BASELINE EXPERIMENTS")
    print(f"Random seed: {SEED}")
    print(f"Validation percentile: {PERCENTILE}")

    datasets = load_data()

    results = [
        exact_novelty(datasets),
        tfidf_isolation_forest(datasets),
        minilm_pca(datasets),
        minilm_isolation_forest(datasets),
        load_e2(),
    ]

    comparison = create_comparison(results)

    save_plots(comparison)

    with open(
        OUTPUT / "baseline_summary.json",
        "w",
    ) as file:
        json.dump(results, file, indent=4)

    print("\nBASELINE EXPERIMENTS COMPLETED")
    print(f"Results saved to: {OUTPUT}")


if __name__ == "__main__":
    main()

