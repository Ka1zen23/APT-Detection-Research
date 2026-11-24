
from pathlib import Path
import json

import numpy as np
import pandas as pd

from transformers import AutoTokenizer
from tqdm import tqdm


ROOT = Path(__file__).resolve().parents[1]

DATA = (
    ROOT / "data/processed/cicapt-iiot-ablation"
)

SPLITS = (
    ROOT / "data/splits/cicapt-iiot"
    / "event_split_manifest.parquet"
)

OUTPUT = ROOT / "results/eda/ablation"

MODEL = "sentence-transformers/all-MiniLM-L6-v2"

MAX_TOKENS = 256
BATCH_SIZE = 512

VARIANTS = [
    "operation_only",
    "operation_entities",
    "full_provenance",
]


def token_statistics(texts, tokenizer):
    lengths = []

    for start in tqdm(
        range(0, len(texts), BATCH_SIZE),
        desc="Counting tokens",
        leave=False,
    ):
        batch = texts[
            start:start + BATCH_SIZE
        ]

        encoded = tokenizer(
            batch,
            add_special_tokens=True,
            truncation=False,
            padding=False,
            verbose=False,
        )

        lengths.extend(
            len(ids)
            for ids in encoded["input_ids"]
        )

    return np.asarray(lengths)


def inspect_conflicts(frame, label_column):
    grouped = frame.groupby("text")[
        label_column
    ].agg(["min", "max"])

    conflicting_texts = grouped.index[
        grouped["min"] != grouped["max"]
    ]

    conflicting = frame[
        frame["text"].isin(conflicting_texts)
    ]

    positives = int(
        frame[label_column].sum()
    )

    conflicting_positives = int(
        conflicting[label_column].sum()
    )

    return {
        "conflicting_descriptions": len(
            conflicting_texts
        ),

        "conflicting_records": len(
            conflicting
        ),

        "conflicting_positives": (
            conflicting_positives
        ),

        "positive_conflict_rate": (
            conflicting_positives / positives
            if positives else 0.0
        ),
    }


def inspect_variant(variant, tokenizer, manifest):
    print("\n" + "=" * 70)
    print(variant.upper())
    print("=" * 70)

    frames = []

    for phase in ["phase1", "phase2"]:
        frame = pd.read_parquet(
            DATA / variant
            / f"{phase}_events.parquet"
        )

        frames.append(frame)

    data = pd.concat(
        frames,
        ignore_index=True,
    )

    data = data.merge(
        manifest[
            ["phase", "event_id", "split"]
        ],
        on=["phase", "event_id"],
        how="left",
        validate="one_to_one",
    )

    assert data["split"].notna().all()

    assert len(data) == 243271

    assert data["original_label"].sum() == 70
    assert data["contextual_label"].sum() == 225

    assert data["text"].notna().all()

    # Count tokens once per unique description.
    codes, unique_texts = pd.factorize(
        data["text"],
        sort=False,
    )

    unique_lengths = token_statistics(
        unique_texts.tolist(),
        tokenizer,
    )

    data["token_count"] = unique_lengths[codes]

    train = data[
        data["split"] == "train"
    ]

    attack = data[
        data["split"] == "attack_test"
    ]

    known_texts = set(train["text"])

    results = []

    for split in [
        "train",
        "validation",
        "benign_test",
        "attack_test",
    ]:
        frame = data[
            data["split"] == split
        ]

        original_positive = frame[
            frame["original_label"] == 1
        ]

        contextual_positive = frame[
            frame["contextual_label"] == 1
        ]

        overlap = frame["text"].isin(
            known_texts
        )

        row = {
            "variant": variant,
            "split": split,

            "events": len(frame),

            "unique_descriptions": (
                frame["text"].nunique()
            ),

            "mean_tokens": float(
                frame["token_count"].mean()
            ),

            "p95_tokens": float(
                frame["token_count"].quantile(0.95)
            ),

            "maximum_tokens": int(
                frame["token_count"].max()
            ),

            "over_token_limit": int(
                (
                    frame["token_count"]
                    > MAX_TOKENS
                ).sum()
            ),

            "original_positives": len(
                original_positive
            ),

            "original_positives_truncated": int(
                (
                    original_positive["token_count"]
                    > MAX_TOKENS
                ).sum()
            ),

            "contextual_positives": len(
                contextual_positive
            ),

            "contextual_positives_truncated": int(
                (
                    contextual_positive["token_count"]
                    > MAX_TOKENS
                ).sum()
            ),

            "seen_in_training": int(
                overlap.sum()
            ),

            "original_positives_seen": int(
                original_positive["text"]
                .isin(known_texts)
                .sum()
            ),

            "contextual_positives_seen": int(
                contextual_positive["text"]
                .isin(known_texts)
                .sum()
            ),
        }

        results.append(row)

    original_conflicts = inspect_conflicts(
        attack,
        "original_label",
    )

    contextual_conflicts = inspect_conflicts(
        attack,
        "contextual_label",
    )

    print("\nPARTITION STATISTICS")

    print(
        pd.DataFrame(results)[
            [
                "split",
                "events",
                "unique_descriptions",
                "mean_tokens",
                "over_token_limit",
                "original_positives_truncated",
                "original_positives_seen",
            ]
        ].to_string(index=False)
    )

    print("\nORIGINAL LABEL CONFLICTS")
    print(
        json.dumps(
            original_conflicts,
            indent=4,
        )
    )

    print("\nCONTEXTUAL LABEL CONFLICTS")
    print(
        json.dumps(
            contextual_conflicts,
            indent=4,
        )
    )

    return results, {
        "original": original_conflicts,
        "contextual": contextual_conflicts,
    }


def main():
    OUTPUT.mkdir(
        parents=True,
        exist_ok=True,
    )

    tokenizer = AutoTokenizer.from_pretrained(
        MODEL
    )

    manifest = pd.read_parquet(SPLITS)

    assert not manifest.duplicated(
        ["phase", "event_id"]
    ).any()

    all_results = []
    all_conflicts = {}

    for variant in VARIANTS:
        results, conflicts = inspect_variant(
            variant,
            tokenizer,
            manifest,
        )

        all_results.extend(results)

        all_conflicts[variant] = conflicts

    summary = pd.DataFrame(all_results)

    summary.to_csv(
        OUTPUT / "representation_statistics.csv",
        index=False,
    )

    with open(
        OUTPUT / "representation_conflicts.json",
        "w",
    ) as file:
        json.dump(
            all_conflicts,
            file,
            indent=4,
        )

    print("\n" + "=" * 70)
    print("ABLATION VALIDATION COMPLETED")
    print("=" * 70)

    print(f"Results saved to: {OUTPUT}")


if __name__ == "__main__":
    main()
