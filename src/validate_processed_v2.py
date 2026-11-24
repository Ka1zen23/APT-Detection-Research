
from pathlib import Path

import numpy as np
import pandas as pd
from tqdm import tqdm
from transformers import AutoTokenizer


ROOT = Path(__file__).resolve().parents[1]

DATA = ROOT / "data/processed/cicapt-iiot-v2"

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

MAX_TOKENS = 256
BATCH_SIZE = 512

FILES = [
    "phase1_nodes.parquet",
    "phase2_nodes.parquet",
    "phase1_events.parquet",
    "phase2_events.parquet",
]


def inspect_tokens(texts, tokenizer):
    lengths = []

    for start in tqdm(
        range(0, len(texts), BATCH_SIZE),
        desc="Counting tokens"
    ):
        batch = texts[start:start + BATCH_SIZE]

        encoded = tokenizer(
            batch,
            add_special_tokens=True,
            truncation=False,
            padding=False,
            return_attention_mask=False,
            return_token_type_ids=False,
            verbose=False,
        )

        lengths.extend(
            len(ids)
            for ids in encoded["input_ids"]
        )

    return np.asarray(lengths)


def inspect_conflicts(df, label_column):
    label_counts = (
        df.groupby("text")[label_column]
        .nunique()
    )

    conflicts = label_counts[label_counts > 1]

    affected = df[
        df["text"].isin(conflicts.index)
    ]

    print(f"\nLABEL CONFLICTS: {label_column}")

    print(
        "Conflicting unique descriptions:",
        f"{len(conflicts):,}"
    )

    print(
        "Affected records:",
        f"{len(affected):,}"
    )

    print(
        "Affected positive records:",
        f"{affected[label_column].sum():,}"
    )


def inspect_file(filename, tokenizer):
    print("\n" + "=" * 70)
    print(filename)
    print("=" * 70)

    df = pd.read_parquet(DATA / filename)

    print(f"Records: {len(df):,}")

    missing = df["text"].isna().sum()

    empty = (
        df["text"]
        .fillna("")
        .str.strip()
        .eq("")
        .sum()
    )

    unique = df["text"].nunique()

    duplicates = df["text"].duplicated().sum()

    print("\nTEXT QUALITY")
    print(f"Missing descriptions: {missing:,}")
    print(f"Empty descriptions: {empty:,}")
    print(f"Unique descriptions: {unique:,}")
    print(f"Duplicate descriptions: {duplicates:,}")

    print(
        "Duplicate percentage:",
        f"{duplicates / len(df):.2%}"
    )

    texts = df["text"].fillna("").tolist()

    lengths = inspect_tokens(texts, tokenizer)

    df["token_count"] = lengths

    over_limit = lengths > MAX_TOKENS

    print("\nTOKEN LENGTH STATISTICS")

    print(f"Minimum: {lengths.min():,}")
    print(f"Mean: {lengths.mean():.2f}")
    print(f"Median: {np.median(lengths):.2f}")
    print(f"95th percentile: {np.percentile(lengths, 95):.2f}")
    print(f"99th percentile: {np.percentile(lengths, 99):.2f}")
    print(f"Maximum: {lengths.max():,}")

    print(
        f"Records exceeding {MAX_TOKENS} tokens:",
        f"{over_limit.sum():,}"
    )

    print(
        "Truncation percentage:",
        f"{over_limit.mean():.2%}"
    )

    label_columns = [
        col for col in [
            "label",
            "original_label",
            "contextual_label",
        ]
        if col in df.columns
    ]

    for col in label_columns:
        inspect_conflicts(df, col)

        positive = df[col] == 1

        print(
            "Positive records exceeding token limit:",
            f"{(positive & over_limit).sum():,}"
        )

    print("\nTIMESTAMP AVAILABILITY")

    for col in [
        "timestamp",
        "seen_time",
        "start_time",
    ]:
        if col in df.columns:
            valid = pd.to_numeric(
                df[col],
                errors="coerce"
            ).notna().sum()

            print(
                f"{col}: {valid:,} / {len(df):,}"
                f" ({valid / len(df):.2%})"
            )

    print("\nLONGEST DESCRIPTION")

    longest = df.loc[
        df["token_count"].idxmax()
    ]

    print(
        f"Token count: {longest['token_count']:,}"
    )

    print(longest["text"][:1500])

    return df


def inspect_overlap(phase1, phase2, name):
    print("\n" + "=" * 70)
    print(f"CROSS-PHASE OVERLAP: {name}")
    print("=" * 70)

    known_texts = set(phase1["text"])

    overlap = phase2["text"].isin(known_texts)

    print(
        "Phase 2 descriptions also in Phase 1:",
        f"{overlap.sum():,}"
    )

    print(
        "Overlap percentage:",
        f"{overlap.mean():.2%}"
    )

    for col in [
        "label",
        "original_label",
        "contextual_label",
    ]:
        if col in phase2.columns:
            positive = phase2[col] == 1

            print(
                f"Positive records ({col}):",
                f"{positive.sum():,}"
            )

            print(
                "Positive records matching Phase 1 text:",
                f"{(positive & overlap).sum():,}"
            )


def main():
    print("Processed Dataset Validation")
    print(f"Tokenizer: {MODEL_NAME}")
    print(f"Target token limit: {MAX_TOKENS}")

    tokenizer = AutoTokenizer.from_pretrained(
        MODEL_NAME
    )

    datasets = {}

    for filename in FILES:
        datasets[filename] = inspect_file(
            filename,
            tokenizer
        )

    inspect_overlap(
        datasets["phase1_nodes.parquet"],
        datasets["phase2_nodes.parquet"],
        "Nodes"
    )

    inspect_overlap(
        datasets["phase1_events.parquet"],
        datasets["phase2_events.parquet"],
        "Events"
    )

    print("\nValidation completed.")


if __name__ == "__main__":
    main()
