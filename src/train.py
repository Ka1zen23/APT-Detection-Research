
from pathlib import Path
import json
import random
import time

import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import torch

from torch import nn
from torch.utils.data import DataLoader, TensorDataset

from autoencoder import Autoencoder


ROOT = Path(__file__).resolve().parents[1]

DATA = (
    ROOT / "data/embeddings/cicapt-iiot"
    / "v2-minilm-standard"
)

MODEL_DIR = ROOT / "models/e2-v2-minilm-standard"
RESULTS = ROOT / "results/e2-v2-minilm-standard"

SEED = 42
INPUT_DIM = 384
BATCH_SIZE = 256
LEARNING_RATE = 0.001
MAX_EPOCHS = 100
PATIENCE = 10
MIN_DELTA = 1e-7
THRESHOLD_PERCENTILE = 99


def set_seed():
    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)
    torch.cuda.manual_seed_all(SEED)

    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


def load_partition(name):
    embeddings = np.load(
        DATA / f"{name}_embeddings.npy",
        allow_pickle=False
    )

    metadata = pd.read_parquet(
        DATA / f"{name}_metadata.parquet"
    )

    assert len(embeddings) == len(metadata)
    assert embeddings.shape[1] == INPUT_DIM
    assert embeddings.dtype == np.float32
    assert np.isfinite(embeddings).all()

    assert np.array_equal(
        metadata["embedding_index"].to_numpy(),
        np.arange(len(metadata))
    )

    assert (metadata["split"] == name).all()

    # Ensure only benign data is used for training
    # and threshold calibration.
    assert (metadata["original_label"] == 0).all()
    assert (metadata["contextual_label"] == 0).all()

    return torch.from_numpy(embeddings)


def create_loader(tensor, shuffle=False):
    return DataLoader(
        TensorDataset(tensor),
        batch_size=BATCH_SIZE,
        shuffle=shuffle,
        num_workers=0,
        pin_memory=True,
        generator=torch.Generator().manual_seed(SEED)
    )


def train_epoch(model, loader, optimizer, device):
    model.train()

    total_loss = 0.0
    total_samples = 0

    for (batch,) in loader:
        batch = batch.to(
            device,
            non_blocking=True
        )

        optimizer.zero_grad(set_to_none=True)

        reconstructed = model(batch)

        loss = nn.functional.mse_loss(
            reconstructed,
            batch
        )

        loss.backward()
        optimizer.step()

        total_loss += loss.item() * len(batch)
        total_samples += len(batch)

    return total_loss / total_samples


@torch.inference_mode()
def reconstruction_errors(model, loader, device):
    model.eval()

    errors = []

    for (batch,) in loader:
        batch = batch.to(
            device,
            non_blocking=True
        )

        reconstructed = model(batch)

        batch_errors = (
            (batch - reconstructed)
            .pow(2)
            .mean(dim=1)
        )

        errors.append(
            batch_errors.cpu().numpy()
        )

    return np.concatenate(errors)


def save_plots(history, validation_errors, threshold):
    history_df = pd.DataFrame(history)

    history_df.to_csv(
        RESULTS / "training_history.csv",
        index=False
    )

    plt.figure(figsize=(10, 6))

    plt.plot(
        history_df["epoch"],
        history_df["train_loss"],
        label="Training loss"
    )

    plt.plot(
        history_df["epoch"],
        history_df["validation_loss"],
        label="Validation loss"
    )

    plt.xlabel("Epoch")
    plt.ylabel("Mean squared error")
    plt.title("Autoencoder Training and Validation Loss")
    plt.legend()
    plt.grid(alpha=0.25)
    plt.tight_layout()

    plt.savefig(
        RESULTS / "training_loss.png",
        dpi=200
    )

    plt.close()

    plt.figure(figsize=(10, 6))

    plt.hist(
        validation_errors,
        bins=100,
        alpha=0.8,
        label="Benign validation errors"
    )

    plt.axvline(
        threshold,
        linestyle="--",
        label="99th percentile threshold"
    )

    plt.xlabel("Reconstruction error")
    plt.ylabel("Number of events")
    plt.title("Benign Validation Error Distribution")
    plt.legend()
    plt.tight_layout()

    plt.savefig(
        RESULTS / "validation_errors.png",
        dpi=200
    )

    plt.close()


def main():
    set_seed()

    MODEL_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    RESULTS.mkdir(
        parents=True,
        exist_ok=True
    )

    if not torch.cuda.is_available():
        raise RuntimeError("CUDA is unavailable.")

    device = torch.device("cuda")

    print("=" * 70)
    print("CICAPT-IIoT AUTOENCODER TRAINING")
    print("=" * 70)

    print("Experiment: E2")
    print(f"Device: {device}")
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"Seed: {SEED}")

    # Do not load either test partition.
    train_tensor = load_partition("train")
    validation_tensor = load_partition("validation")

    print(f"Training samples: {len(train_tensor):,}")
    print(
        f"Validation samples: "
        f"{len(validation_tensor):,}"
    )

    train_loader = create_loader(
        train_tensor,
        shuffle=True
    )

    validation_loader = create_loader(
        validation_tensor,
        shuffle=False
    )

    model = Autoencoder(
        input_dim=INPUT_DIM
    ).to(device)

    parameter_count = sum(
        p.numel()
        for p in model.parameters()
        if p.requires_grad
    )

    print(f"Trainable parameters: {parameter_count:,}")
    print(f"Batch size: {BATCH_SIZE}")
    print(f"Learning rate: {LEARNING_RATE}")
    print(f"Maximum epochs: {MAX_EPOCHS}")
    print(f"Early stopping patience: {PATIENCE}")

    optimizer = torch.optim.Adam(
        model.parameters(),
        lr=LEARNING_RATE
    )

    best_loss = float("inf")
    best_epoch = 0
    best_state = None

    patience_reference = float("inf")
    patience_counter = 0

    history = []

    torch.cuda.reset_peak_memory_stats()

    started = time.perf_counter()

    print("\nTRAINING STARTED\n")

    for epoch in range(1, MAX_EPOCHS + 1):
        train_loss = train_epoch(
            model,
            train_loader,
            optimizer,
            device
        )

        validation_errors = reconstruction_errors(
            model,
            validation_loader,
            device
        )

        validation_loss = float(
            validation_errors.mean()
        )

        if not np.isfinite(train_loss):
            raise RuntimeError("Non-finite training loss.")

        if not np.isfinite(validation_loss):
            raise RuntimeError("Non-finite validation loss.")

        history.append({
            "epoch": epoch,
            "train_loss": train_loss,
            "validation_loss": validation_loss,
        })

        improved = validation_loss < best_loss

        # Preserve the actual lowest validation loss.
        if improved:
            best_loss = validation_loss
            best_epoch = epoch

            best_state = {
                key: value.detach().cpu().clone()
                for key, value in model.state_dict().items()
            }

        # Use MIN_DELTA only for early stopping.
        if validation_loss < patience_reference - MIN_DELTA:
            patience_reference = validation_loss
            patience_counter = 0
        else:
            patience_counter += 1

        marker = " *" if improved else ""

        print(
            f"Epoch {epoch:03d}/{MAX_EPOCHS} | "
            f"Train: {train_loss:.8f} | "
            f"Validation: {validation_loss:.8f}"
            f"{marker}"
        )

        if patience_counter >= PATIENCE:
            print(
                f"\nEarly stopping at epoch {epoch}"
            )
            break

    # Restore the best-performing model.
    model.load_state_dict(best_state)

    validation_errors = reconstruction_errors(
        model,
        validation_loader,
        device
    )

    threshold = float(
        np.percentile(
            validation_errors,
            THRESHOLD_PERCENTILE
        )
    )

    validation_alerts = (
        validation_errors > threshold
    )

    validation_fpr = float(
        validation_alerts.mean()
    )

    elapsed = time.perf_counter() - started

    peak_memory = (
        torch.cuda.max_memory_allocated()
        / (1024 ** 2)
    )

    checkpoint = {
        "model_state_dict": best_state,
        "input_dim": INPUT_DIM,
        "threshold": threshold,
        "threshold_percentile": THRESHOLD_PERCENTILE,
        "best_epoch": best_epoch,
        "best_validation_loss": best_loss,
        "experiment": "E2",
        "embedding_model": (
            "sentence-transformers/all-MiniLM-L6-v2"
        ),
        "representation": "v2",
        "embedding_strategy": "standard_truncation",
        "normalize_embeddings": True,
        "seed": SEED,
    }

    checkpoint_path = MODEL_DIR / "autoencoder.pt"

    torch.save(
        checkpoint,
        checkpoint_path
    )

    np.save(
        RESULTS / "validation_errors.npy",
        validation_errors,
        allow_pickle=False
    )

    save_plots(
        history,
        validation_errors,
        threshold
    )

    summary = {
        "experiment": "E2",
        "seed": SEED,
        "gpu": torch.cuda.get_device_name(0),
        "torch_version": str(torch.__version__),
        "train_samples": len(train_tensor),
        "validation_samples": len(validation_tensor),
        "trainable_parameters": parameter_count,
        "batch_size": BATCH_SIZE,
        "learning_rate": LEARNING_RATE,
        "max_epochs": MAX_EPOCHS,
        "patience": PATIENCE,
        "min_delta": MIN_DELTA,
        "epochs_completed": len(history),
        "best_epoch": best_epoch,
        "best_validation_loss": best_loss,
        "threshold_percentile": THRESHOLD_PERCENTILE,
        "threshold": threshold,
        "validation_alerts": int(validation_alerts.sum()),
        "validation_false_positive_rate": validation_fpr,
        "elapsed_seconds": elapsed,
        "peak_gpu_memory_mib": peak_memory,
        "validation_error_statistics": {
            "min": float(validation_errors.min()),
            "mean": float(validation_errors.mean()),
            "median": float(np.median(validation_errors)),
            "p95": float(np.percentile(validation_errors, 95)),
            "p99": float(np.percentile(validation_errors, 99)),
            "max": float(validation_errors.max()),
        },
    }

    with open(
        RESULTS / "training_summary.json",
        "w"
    ) as file:
        json.dump(summary, file, indent=4)

    print("\n" + "=" * 70)
    print("TRAINING COMPLETED")
    print("=" * 70)

    print(f"Epochs completed: {len(history)}")
    print(f"Best epoch: {best_epoch}")
    print(f"Best validation loss: {best_loss:.8f}")
    print(f"Anomaly threshold: {threshold:.10f}")

    print(
        f"Validation alerts: "
        f"{validation_alerts.sum():,}"
    )

    print(
        f"Validation false positive rate: "
        f"{validation_fpr:.4%}"
    )

    print(f"Training duration: {elapsed:.2f} seconds")
    print(f"Peak GPU memory: {peak_memory:.2f} MiB")
    print(f"Saved model: {checkpoint_path}")
    print(f"Results directory: {RESULTS}")


if __name__ == "__main__":
    main()
