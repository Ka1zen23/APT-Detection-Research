"""Bounded, local-only view of saved E5 embeddings. Never fits detection models."""

from functools import lru_cache

import numpy as np
import pandas as pd
from sklearn.decomposition import PCA

from app import config

VARIANTS = {
    "E5-A": "e5a-operation-only",
    "E5-B": "e5b-operation-entities",
    "E5-C": "v2-minilm-standard",
}
SEED = 42
FIT_LIMIT = 4096
NEGATIVE_LIMIT = 240
POSITIVE_LIMIT = 80
FIELDS = ["embedding_index", "phase", "event_id", "original_label", "contextual_label", "split"]
KEY = ["phase", "event_id"]


def _load(variant: str, split: str):
    folder = config.ROOT / "data" / "embeddings" / "cicapt-iiot" / VARIANTS[variant]
    vectors = np.load(folder / f"{split}_embeddings.npy", mmap_mode="r", allow_pickle=False)
    metadata = pd.read_parquet(folder / f"{split}_metadata.parquet", columns=FIELDS)
    indices = metadata["embedding_index"].to_numpy()
    if (
        vectors.shape != (len(metadata), 384)
        or not np.issubdtype(indices.dtype, np.integer)
        or not np.array_equal(np.sort(indices), np.arange(len(metadata)))
        or not metadata["split"].eq(split).all()
        or metadata[KEY].isna().any().any()
        or metadata.duplicated(KEY).any()
        or not metadata[FIELDS[3:5]].isin([0, 1]).all().all()
    ):
        raise ValueError("Embedding metadata does not match the saved vectors")
    return vectors, metadata


def _sample(rows: pd.DataFrame, limit: int, rng: np.random.Generator) -> pd.DataFrame:
    if len(rows) <= limit:
        return rows
    return rows.iloc[np.sort(rng.choice(len(rows), size=limit, replace=False))]


@lru_cache(maxsize=1)
def _basis():
    vectors, metadata = _load("E5-C", "train")
    if metadata["original_label"].ne(0).any():
        raise ValueError("Expected an original-negative training partition")
    indices = _sample(metadata, FIT_LIMIT, np.random.default_rng(SEED))["embedding_index"]
    return PCA(n_components=2, svd_solver="randomized", random_state=SEED).fit(vectors[indices])


@lru_cache(maxsize=4)
def projection(split: str) -> dict:
    basis = _basis()
    reference, metadata = _load("E5-C", split)
    rng = np.random.default_rng(SEED)
    sample = pd.concat([
        _sample(metadata[metadata.original_label == 0], NEGATIVE_LIMIT, rng),
        _sample(metadata[metadata.original_label == 1], POSITIVE_LIMIT, rng),
    ]).set_index(KEY)
    if sample.empty:
        raise ValueError("No saved embeddings available for this partition")

    coordinates = {}
    for variant in VARIANTS:
        vectors, other = (reference, metadata) if variant == "E5-C" else _load(variant, split)
        aligned = other.set_index(KEY).reindex(sample.index)
        if not np.array_equal(aligned[FIELDS[3:5]].to_numpy(), sample[FIELDS[3:5]].to_numpy()):
            raise ValueError("E5 variants do not agree on sampled event identities and labels")
        coordinates[variant] = basis.transform(vectors[aligned.embedding_index.to_numpy()]).round(6).tolist()

    points = [
        {
            "phase": str(phase),
            "event_id": str(event_id),
            "original_label": int(row.original_label),
            "contextual_label": int(row.contextual_label),
            "coordinates": {variant: values[i] for variant, values in coordinates.items()},
        }
        for i, ((phase, event_id), row) in enumerate(sample.iterrows())
    ]
    return {
        "partition": split,
        "seed": SEED,
        "fit_count": int(basis.n_samples_),
        "variance_ratio": basis.explained_variance_ratio_.tolist(),
        "source_count": len(metadata),
        "source_positive_count": int(metadata.original_label.sum()),
        "points": points,
    }
