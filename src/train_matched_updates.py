
from pathlib import Path
import json

import torch

import train as base
import train_frequency_balanced as balanced


ROOT = Path(__file__).resolve().parents[1]

EXPERIMENT = "e2d-unique-matched"

# Match the approximate optimiser update budget
# of the original E2-A best checkpoint.
ORIGINAL_BEST_EPOCH = 65
ORIGINAL_BATCHES = 390
UNIQUE_BATCHES = 51

TARGET_UPDATES = (
    ORIGINAL_BEST_EPOCH * ORIGINAL_BATCHES
)

MATCHED_EPOCHS = round(
    TARGET_UPDATES / UNIQUE_BATCHES
)


def main():
    balanced.MODE = "unique"

    base.MODEL_DIR = (
        ROOT / "models" / EXPERIMENT
    )

    base.RESULTS = (
        ROOT / "results" / EXPERIMENT
    )

    base.MAX_EPOCHS = MATCHED_EPOCHS

    # Prevent early stopping from shortening
    # the matched-update training budget.
    base.PATIENCE = MATCHED_EPOCHS + 1

    base.load_partition = balanced.load_partition
    base.create_loader = balanced.create_loader

    print("=" * 70)
    print("E2-D UNIQUE MATCHED-UPDATE TRAINING")
    print("=" * 70)

    print(f"Target updates: {TARGET_UPDATES:,}")
    print(f"Maximum epochs: {MATCHED_EPOCHS}")
    print(
        "Expected updates:",
        f"{MATCHED_EPOCHS * UNIQUE_BATCHES:,}",
    )

    base.main()

    checkpoint_path = (
        base.MODEL_DIR / "autoencoder.pt"
    )

    checkpoint = torch.load(
        checkpoint_path,
        map_location="cpu",
        weights_only=True,
    )

    checkpoint["experiment"] = EXPERIMENT
    checkpoint["training_strategy"] = (
        "unique_matched_updates"
    )

    checkpoint["target_updates"] = TARGET_UPDATES

    torch.save(
        checkpoint,
        checkpoint_path,
    )

    summary_path = (
        base.RESULTS / "training_summary.json"
    )

    with open(summary_path) as file:
        summary = json.load(file)

    summary["experiment"] = EXPERIMENT

    summary["training_strategy"] = (
        "unique_matched_updates"
    )

    summary["target_updates"] = TARGET_UPDATES

    summary["batches_per_epoch"] = UNIQUE_BATCHES

    summary["completed_updates"] = (
        summary["epochs_completed"] * UNIQUE_BATCHES
    )

    summary["best_checkpoint_updates"] = (
        summary["best_epoch"] * UNIQUE_BATCHES
    )

    with open(summary_path, "w") as file:
        json.dump(summary, file, indent=4)

    print("\nMATCHED-UPDATE TRAINING COMPLETED")
    print(f"Model directory: {base.MODEL_DIR}")
    print(f"Results directory: {base.RESULTS}")


if __name__ == "__main__":
    main()
