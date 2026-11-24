
from pathlib import Path
import argparse
import json

import numpy as np
import pandas as pd
import torch

import embed_dataset as embedding
import train as training
import evaluate as evaluation


ROOT = Path(__file__).resolve().parents[1]

PROCESSED = ROOT / "data/processed/cicapt-iiot-ablation"
EMBEDDINGS = ROOT / "data/embeddings/cicapt-iiot"

MAX_EPOCHS = 100
SEED = 42

CONFIGS = {
    "E5-A": {
        "slug": "e5a-operation-only",
        "representation": "operation_only",
        "embedding_dir": "e5a-operation-only",
    },
    "E5-B": {
        "slug": "e5b-operation-entities",
        "representation": "operation_entities",
        "embedding_dir": "e5b-operation-entities",
    },
    "E5-C": {
        "slug": "e5c-full-provenance",
        "representation": "full_provenance",
        "embedding_dir": "v2-minilm-standard",
    },
}


def get_paths(experiment):
    config = CONFIGS[experiment]

    return {
        "processed": PROCESSED / config["representation"],
        "embeddings": EMBEDDINGS / config["embedding_dir"],
        "models": ROOT / "models" / config["slug"],
        "results": ROOT / "results" / config["slug"],
    }


def update_json(path, updates):
    with open(path) as file:
        data = json.load(file)

    data.update(updates)

    with open(path, "w") as file:
        json.dump(data, file, indent=4)


def verify_embeddings(experiment):
    paths = get_paths(experiment)

    summary_path = (
        paths["embeddings"] / "embedding_summary.json"
    )

    with open(summary_path) as file:
        summary = json.load(file)

    assert summary["model"] == embedding.MODEL_NAME
    assert summary["model_max_tokens"] == 256
    assert summary["normalize_embeddings"] is True
    assert summary["embedding_strategy"] == "standard_truncation"

    events = pd.concat(
        [
            pd.read_parquet(
                paths["processed"] / f"{phase}_events.parquet"
            )
            for phase in ["phase1", "phase2"]
        ],
        ignore_index=True,
    )

    manifest = pd.read_parquet(embedding.SPLITS)

    events = events.merge(
        manifest[["phase", "event_id", "split"]],
        on=["phase", "event_id"],
        validate="one_to_one",
    )

    assert len(events) == 243271

    events["timestamp"] = pd.to_numeric(
        events["timestamp"],
        errors="raise",
    )

    expected_counts = {
        "train": 99665,
        "validation": 21357,
        "benign_test": 21357,
        "attack_test": 100892,
    }

    for name, expected_count in expected_counts.items():
        metadata = pd.read_parquet(
            paths["embeddings"] / f"{name}_metadata.parquet"
        )

        vectors = np.load(
            paths["embeddings"] / f"{name}_embeddings.npy",
            mmap_mode="r",
            allow_pickle=False,
        )

        expected = (
            events[events["split"] == name]
            .sort_values(["timestamp", "event_id"])
            .reset_index(drop=True)
        )

        assert len(metadata) == expected_count
        assert vectors.shape == (expected_count, 384)
        assert vectors.dtype == np.float32
        assert np.isfinite(vectors).all()

        assert np.array_equal(
            metadata["embedding_index"].to_numpy(),
            np.arange(expected_count),
        )

        for column in [
            "phase",
            "event_id",
            "timestamp",
            "split",
            "original_label",
            "contextual_label",
        ]:
            np.testing.assert_array_equal(
                metadata[column].to_numpy(),
                expected[column].to_numpy(),
            )

        if name in ["train", "validation"]:
            assert metadata["original_label"].sum() == 0
            assert metadata["contextual_label"].sum() == 0

        print(f"Verified {name}: {expected_count:,} events")


def run_embedding(experiment):
    config = CONFIGS[experiment]
    paths = get_paths(experiment)

    if experiment == "E5-C":
        print("Reusing existing full provenance embeddings.")

        # Confirm that the ablation text is still identical
        # to the original V2 representation.
        for phase in ["phase1", "phase2"]:
            filename = f"{phase}_events.parquet"

            original = pd.read_parquet(
                ROOT / "data/processed/cicapt-iiot-v2"
                / filename
            )

            current = pd.read_parquet(
                paths["processed"] / filename
            )

            pd.testing.assert_frame_equal(
                original[["phase", "event_id", "text"]],
                current[["phase", "event_id", "text"]],
            )

        verify_embeddings(experiment)
        return

    embedding.DATA = paths["processed"]
    embedding.OUTPUT = paths["embeddings"]

    embedding.main()

    update_json(
        paths["embeddings"] / "embedding_summary.json",
        {
            "experiment": experiment,
            "representation": config["representation"],
        },
    )

    verify_embeddings(experiment)


def run_training(experiment):
    config = CONFIGS[experiment]
    paths = get_paths(experiment)

    verify_embeddings(experiment)

    training.DATA = paths["embeddings"]
    training.MODEL_DIR = paths["models"]
    training.RESULTS = paths["results"]

    training.SEED = SEED
    training.MAX_EPOCHS = MAX_EPOCHS

    # Patience exceeds the entire training budget,
    # effectively disabling early stopping.
    training.PATIENCE = MAX_EPOCHS + 1

    training.main()

    checkpoint_path = (
        paths["models"] / "autoencoder.pt"
    )

    checkpoint = torch.load(
        checkpoint_path,
        map_location="cpu",
        weights_only=True,
    )

    summary_path = (
        paths["results"] / "training_summary.json"
    )

    with open(summary_path) as file:
        summary = json.load(file)

    assert summary["epochs_completed"] == MAX_EPOCHS
    assert summary["train_samples"] == 99665

    updates_per_epoch = (
        summary["train_samples"]
        + summary["batch_size"] - 1
    ) // summary["batch_size"]

    updates = {
        "experiment": experiment,
        "representation": config["representation"],
        "training_strategy": "frequency_preserving",
        "early_stopping": False,
        "optimizer_updates_per_epoch": updates_per_epoch,
        "total_optimizer_updates": (
            updates_per_epoch * MAX_EPOCHS
        ),
        "checkpoint_optimizer_updates": (
            updates_per_epoch * checkpoint["best_epoch"]
        ),
    }

    checkpoint.update(updates)

    torch.save(checkpoint, checkpoint_path)

    update_json(summary_path, updates)

    print("\nCONTROLLED TRAINING VERIFICATION")

    print(
        "Total optimizer updates:",
        updates["total_optimizer_updates"],
    )

    print(
        "Selected checkpoint updates:",
        updates["checkpoint_optimizer_updates"],
    )


def run_evaluation(experiment):
    paths = get_paths(experiment)

    evaluation.DATA = paths["embeddings"]
    evaluation.PROCESSED = paths["processed"]

    evaluation.MODEL_PATH = (
        paths["models"] / "autoencoder.pt"
    )

    evaluation.OUTPUT = (
        paths["results"] / "evaluation"
    )

    evaluation.main()


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--experiment",
        required=True,
        choices=list(CONFIGS),
    )

    parser.add_argument(
        "--stage",
        required=True,
        choices=["embed", "train", "evaluate", "all"],
    )

    args = parser.parse_args()

    print("=" * 70)
    print("PROVENANCE CONTEXT ABLATION")
    print("Experiment:", args.experiment)
    print("Stage:", args.stage)
    print("=" * 70)

    if args.stage in ["embed", "all"]:
        run_embedding(args.experiment)

    if args.stage in ["train", "all"]:
        run_training(args.experiment)

    if args.stage in ["evaluate", "all"]:
        run_evaluation(args.experiment)

    print("\nABLATION STAGE COMPLETED")


if __name__ == "__main__":
    main()
