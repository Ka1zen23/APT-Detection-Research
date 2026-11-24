
from pathlib import Path
import json

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]

DATA = ROOT / "data/processed/cicapt-iiot-v2"
OUTPUT = ROOT / "data/splits/cicapt-iiot"

TRAIN_RATIO = 0.70
VALIDATION_RATIO = 0.15


def load_events(phase):
    df = pd.read_parquet(
        DATA / f"{phase}_events.parquet"
    )

    df["timestamp"] = pd.to_numeric(
        df["timestamp"],
        errors="raise"
    )

    assert df["timestamp"].notna().all()
    assert df["event_id"].is_unique
    assert df["text"].notna().all()

    return df.sort_values(
        ["timestamp", "event_id"]
    ).reset_index(drop=True)


def inspect_partition(df, name):
    print("\n" + "=" * 60)
    print(name.upper())
    print("=" * 60)

    print(f"Records: {len(df):,}")
    print(
        f"Unique descriptions: "
        f"{df['text'].nunique():,}"
    )

    print(
        f"Original positives: "
        f"{df['original_label'].sum():,}"
    )

    print(
        f"Contextual positives: "
        f"{df['contextual_label'].sum():,}"
    )

    print(
        "Start:",
        pd.to_datetime(
            df["timestamp"].min(),
            unit="s",
            utc=True
        )
    )

    print(
        "End:",
        pd.to_datetime(
            df["timestamp"].max(),
            unit="s",
            utc=True
        )
    )


def inspect_overlap(train, other, name):
    train_texts = set(train["text"])

    overlap = other["text"].isin(train_texts)

    print(f"\nTRAINING VS {name.upper()}")

    print(
        f"Matching descriptions: "
        f"{overlap.sum():,}"
    )

    print(f"Overlap: {overlap.mean():.2%}")


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)

    phase1 = load_events("phase1")
    phase2 = load_events("phase2")

    assert (phase1["original_label"] == 0).all()
    assert (phase1["contextual_label"] == 0).all()

    assert (
        phase1["timestamp"].max()
        < phase2["timestamp"].min()
    )

    total = len(phase1)

    train_index = int(total * TRAIN_RATIO)

    validation_index = int(
        total * (TRAIN_RATIO + VALIDATION_RATIO)
    )

    train_boundary = phase1.loc[
        train_index, "timestamp"
    ]

    validation_boundary = phase1.loc[
        validation_index, "timestamp"
    ]

    # Keep events sharing a timestamp together.
    train = phase1[
        phase1["timestamp"] < train_boundary
    ].copy()

    validation = phase1[
        (phase1["timestamp"] >= train_boundary)
        & (
            phase1["timestamp"]
            < validation_boundary
        )
    ].copy()

    benign_test = phase1[
        phase1["timestamp"] >= validation_boundary
    ].copy()

    attack_test = phase2.copy()

    partitions = {
        "train": train,
        "validation": validation,
        "benign_test": benign_test,
        "attack_test": attack_test,
    }

    assert all(
        len(df) > 0
        for df in partitions.values()
    )

    assert (
        len(train)
        + len(validation)
        + len(benign_test)
        == len(phase1)
    )

    assert (
        train["timestamp"].max()
        < validation["timestamp"].min()
    )

    assert (
        validation["timestamp"].max()
        < benign_test["timestamp"].min()
    )

    manifest_parts = []
    summary = {}

    for name, df in partitions.items():
        inspect_partition(df, name)

        manifest = df[
            ["phase", "event_id", "timestamp"]
        ].copy()

        manifest["split"] = name

        manifest_parts.append(manifest)

        summary[name] = {
            "records": len(df),
            "unique_descriptions": int(
                df["text"].nunique()
            ),
            "start_timestamp": float(
                df["timestamp"].min()
            ),
            "end_timestamp": float(
                df["timestamp"].max()
            ),
        }

    manifest = pd.concat(
        manifest_parts,
        ignore_index=True
    )

    assert not manifest.duplicated(
        subset=["phase", "event_id"]
    ).any()

    assert len(manifest) == (
        len(phase1) + len(phase2)
    )

    manifest.to_parquet(
        OUTPUT / "event_split_manifest.parquet",
        index=False
    )

    with open(
        OUTPUT / "split_summary.json",
        "w"
    ) as file:
        json.dump(summary, file, indent=4)

    print("\nDESCRIPTION OVERLAP ANALYSIS")

    inspect_overlap(
        train, validation, "validation"
    )

    inspect_overlap(
        train, benign_test, "benign test"
    )

    inspect_overlap(
        train, attack_test, "attack test"
    )

    print("\nDataset splitting completed.")
    print(f"Total events: {len(manifest):,}")
    print(f"Output directory: {OUTPUT}")


if __name__ == "__main__":
    main()
