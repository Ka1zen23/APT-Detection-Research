
from pathlib import Path
import json
import time

import numpy as np
import pandas as pd
import torch

from sentence_transformers import SentenceTransformer


ROOT = Path(__file__).resolve().parents[1]

DATA = ROOT / "data/processed/cicapt-iiot-v2"

SPLITS = (
    ROOT / "data/splits/cicapt-iiot"
    / "event_split_manifest.parquet"
)

OUTPUT = (
    ROOT / "data/embeddings/cicapt-iiot"
    / "v2-minilm-standard"
)

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

BATCH_SIZE = 64
MAX_TOKENS = 256
NORMALIZE = True

PARTITIONS = [
    "train",
    "validation",
    "benign_test",
    "attack_test",
]


def load_dataset():
    phase1 = pd.read_parquet(
        DATA / "phase1_events.parquet"
    )

    phase2 = pd.read_parquet(
        DATA / "phase2_events.parquet"
    )

    events = pd.concat(
        [phase1, phase2],
        ignore_index=True
    )

    manifest = pd.read_parquet(SPLITS)

    dataset = events.merge(
        manifest[["phase", "event_id", "split"]],
        on=["phase", "event_id"],
        how="left",
        validate="one_to_one",
    )

    assert len(dataset) == len(manifest)
    assert dataset["split"].notna().all()
    assert dataset["text"].notna().all()

    assert set(dataset["split"]) == set(PARTITIONS)

    dataset["timestamp"] = pd.to_numeric(
        dataset["timestamp"],
        errors="raise"
    )

    return dataset


def embed_partition(df, name, model):
    print("\n" + "=" * 70)
    print(f"PARTITION: {name.upper()}")
    print("=" * 70)

    started = time.perf_counter()

    df = df.sort_values(
        ["timestamp", "event_id"]
    ).reset_index(drop=True)

    # Map repeated descriptions to unique texts.
    inverse_indices, unique_texts = pd.factorize(
        df["text"],
        sort=False
    )

    unique_texts = unique_texts.tolist()

    assert (inverse_indices >= 0).all()

    print(f"Total records: {len(df):,}")
    print(f"Unique descriptions: {len(unique_texts):,}")

    reduction = 1 - len(unique_texts) / len(df)

    print(f"Encoding reduction: {reduction:.2%}")

    # Encode each unique description once.
    unique_embeddings = model.encode(
        unique_texts,
        batch_size=BATCH_SIZE,
        show_progress_bar=True,
        convert_to_numpy=True,
        normalize_embeddings=NORMALIZE,
    ).astype(np.float32)

    # Restore one embedding per original event.
    embeddings = unique_embeddings[inverse_indices]

    assert embeddings.shape == (len(df), 384)
    assert np.isfinite(embeddings).all()

    norms = np.linalg.norm(
        embeddings,
        axis=1
    )

    assert np.allclose(
        norms,
        1.0,
        atol=1e-4
    )

    # Metadata row index matches embedding row index.
    metadata = df.drop(
        columns=["text"]
    ).copy()

    metadata.insert(
        0,
        "embedding_index",
        np.arange(len(metadata))
    )

    embedding_path = OUTPUT / f"{name}_embeddings.npy"
    metadata_path = OUTPUT / f"{name}_metadata.parquet"

    np.save(
        embedding_path,
        embeddings,
        allow_pickle=False
    )

    metadata.to_parquet(
        metadata_path,
        index=False
    )

    elapsed = time.perf_counter() - started

    size_mib = (
        embeddings.nbytes / (1024 ** 2)
    )

    print(f"\nEmbedding shape: {embeddings.shape}")
    print(f"Data type: {embeddings.dtype}")
    print(f"Mean vector norm: {norms.mean():.6f}")
    print(f"Storage: {size_mib:.2f} MiB")
    print(f"Elapsed time: {elapsed:.2f} seconds")

    print(
        f"Original positives: "
        f"{df['original_label'].sum():,}"
    )

    print(
        f"Contextual positives: "
        f"{df['contextual_label'].sum():,}"
    )

    print(f"Saved embeddings: {embedding_path}")
    print(f"Saved metadata: {metadata_path}")

    return {
        "records": len(df),
        "unique_descriptions": len(unique_texts),
        "embedding_shape": list(embeddings.shape),
        "dtype": str(embeddings.dtype),
        "size_mib": size_mib,
        "elapsed_seconds": elapsed,
        "encoding_reduction": reduction,
    }


def main():
    OUTPUT.mkdir(
        parents=True,
        exist_ok=True
    )

    if not torch.cuda.is_available():
        raise RuntimeError(
            "CUDA is unavailable. "
            "Check the PyTorch installation."
        )

    device = "cuda"

    print("CICAPT-IIoT Semantic Embedding Generation")
    print(f"Model: {MODEL_NAME}")
    print(f"Device: {device}")
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"PyTorch: {torch.__version__}")
    print(f"CUDA version: {torch.version.cuda}")
    print(f"Batch size: {BATCH_SIZE}")
    print(f"Maximum tokens: {MAX_TOKENS}")

    model = SentenceTransformer(
        MODEL_NAME,
        device=device
    )

    model.max_seq_length = MAX_TOKENS

    model.eval()
    model.requires_grad_(False)

    print(
        "Embedding dimensions:",
        model.get_embedding_dimension()
    )

    dataset = load_dataset()

    print(f"Total events loaded: {len(dataset):,}")

    summary = {
        "experiment": "E2",
        "representation": "v2",
        "model": MODEL_NAME,
        "model_max_tokens": MAX_TOKENS,
        "embedding_strategy": "standard_truncation",
        "normalize_embeddings": NORMALIZE,
        "batch_size": BATCH_SIZE,
        "device": device,
        "gpu": torch.cuda.get_device_name(0),
        "torch_version": str(torch.__version__),
        "partitions": {},
    }

    started = time.perf_counter()

    torch.cuda.reset_peak_memory_stats()

    for name in PARTITIONS:
        partition = dataset[
            dataset["split"] == name
        ].copy()

        summary["partitions"][name] = embed_partition(
            partition,
            name,
            model
        )

    elapsed = time.perf_counter() - started

    peak_memory = (
        torch.cuda.max_memory_allocated()
        / (1024 ** 2)
    )

    summary["total_elapsed_seconds"] = elapsed
    summary["peak_gpu_memory_mib"] = peak_memory

    with open(
        OUTPUT / "embedding_summary.json",
        "w"
    ) as file:
        json.dump(summary, file, indent=4)

    print("\n" + "=" * 70)
    print("EMBEDDING GENERATION COMPLETED")
    print("=" * 70)

    print(f"Total events: {len(dataset):,}")
    print(f"Total duration: {elapsed:.2f} seconds")
    print(f"Peak GPU memory: {peak_memory:.2f} MiB")
    print(f"Output directory: {OUTPUT}")


if __name__ == "__main__":
    main()
