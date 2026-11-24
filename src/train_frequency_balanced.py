
from pathlib import Path
import argparse

import numpy as np
import pandas as pd
import torch

from torch.utils.data import (
    DataLoader,
    TensorDataset,
    WeightedRandomSampler,
)

import train as base


ROOT = Path(__file__).resolve().parents[1]

PROCESSED = (
    ROOT / "data/processed/cicapt-iiot-v2"
)

ORIGINAL_LOAD = base.load_partition
ORIGINAL_LOADER = base.create_loader

MODE = None
TRAIN_WEIGHTS = None


def load_training_descriptions():
    metadata = pd.read_parquet(
        base.DATA / "train_metadata.parquet"
    )

    events = pd.read_parquet(
        PROCESSED / "phase1_events.parquet",
        columns=["phase", "event_id", "text"],
    )

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

    assert (metadata["original_label"] == 0).all()
    assert (metadata["contextual_label"] == 0).all()

    return metadata


def load_partition(name):
    global TRAIN_WEIGHTS

    tensor = ORIGINAL_LOAD(name)

    # Validation remains unchanged.
    if name != "train":
        return tensor

    metadata = load_training_descriptions()

    assert len(metadata) == len(tensor)

    frequencies = metadata["text"].map(
        metadata["text"].value_counts()
    ).to_numpy()

    print("\nTRAINING FREQUENCY ANALYSIS")
    print(f"Original samples: {len(tensor):,}")
    print(
        "Unique descriptions:",
        f"{metadata['text'].nunique():,}",
    )
    print(
        "Most frequent description:",
        f"{frequencies.max():,} occurrences",
    )

    if MODE == "unique":
        indices = np.flatnonzero(
            ~metadata["text"].duplicated().to_numpy()
        )

        tensor = tensor[
            torch.from_numpy(indices)
        ]

        print(
            f"Unique training samples: {len(tensor):,}"
        )

    elif MODE == "weighted":
        # Square-root inverse frequency weighting.
        #
        # Common descriptions remain more frequent,
        # but their dominance is reduced.
        weights = 1.0 / np.sqrt(
            frequencies.astype(np.float64)
        )

        TRAIN_WEIGHTS = torch.from_numpy(weights)

        print("Weighted training enabled.")
        print("Weight formula: 1 / sqrt(frequency)")
        print(f"Samples per epoch: {len(tensor):,}")

    return tensor


def create_loader(tensor, shuffle=False):
    if MODE == "weighted" and shuffle:
        assert TRAIN_WEIGHTS is not None
        assert len(TRAIN_WEIGHTS) == len(tensor)

        sampler = WeightedRandomSampler(
            weights=TRAIN_WEIGHTS,
            num_samples=len(tensor),
            replacement=True,
            generator=torch.Generator().manual_seed(
                base.SEED
            ),
        )

        return DataLoader(
            TensorDataset(tensor),
            batch_size=base.BATCH_SIZE,
            sampler=sampler,
            num_workers=0,
            pin_memory=True,
        )

    return ORIGINAL_LOADER(
        tensor,
        shuffle=shuffle,
    )


def main():
    global MODE

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--mode",
        choices=["unique", "weighted"],
        required=True,
    )

    args = parser.parse_args()

    MODE = args.mode

    experiment = {
        "unique": "e2b-unique",
        "weighted": "e2c-weighted",
    }[MODE]

    base.MODEL_DIR = (
        ROOT / "models" / experiment
    )

    base.RESULTS = (
        ROOT / "results" / experiment
    )

    base.load_partition = load_partition
    base.create_loader = create_loader

    print(f"Frequency experiment: {experiment}")
    print(f"Training strategy: {MODE}")

    base.main()

    # Update experiment metadata without changing
    # the trained weights or calibrated threshold.
    import json

    checkpoint_path = (
        base.MODEL_DIR / "autoencoder.pt"
    )

    checkpoint = torch.load(
        checkpoint_path,
        map_location="cpu",
        weights_only=True,
    )

    checkpoint["experiment"] = experiment
    checkpoint["training_strategy"] = MODE

    torch.save(
        checkpoint,
        checkpoint_path,
    )

    summary_path = (
        base.RESULTS / "training_summary.json"
    )

    with open(summary_path) as file:
        summary = json.load(file)

    summary["experiment"] = experiment
    summary["training_strategy"] = MODE

    if MODE == "weighted":
        summary["weight_formula"] = (
            "1 / sqrt(description_frequency)"
        )

    with open(summary_path, "w") as file:
        json.dump(summary, file, indent=4)

    print("\nFrequency experiment completed.")
    print(f"Model directory: {base.MODEL_DIR}")
    print(f"Results directory: {base.RESULTS}")


if __name__ == "__main__":
    main()
