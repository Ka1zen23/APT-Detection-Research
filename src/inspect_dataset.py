
from pathlib import Path
from collections import Counter

import pandas as pd

ROOT = (
    Path(__file__).resolve().parents[1]
    / "data/raw/cicapt-iiot"
)

CHUNK_SIZE = 100_000

FILES = [
    ROOT / "Provenance_Logs/Phase1_Provenance.csv",
    ROOT / "Provenance_Logs/Phase2_Provenance.csv",
    ROOT / "Supplementary Material/attack_info.csv",
]


def inspect_csv(path):
    print("\n" + "=" * 80)
    print(f"FILE: {path.name}")
    print("=" * 80)

    if not path.exists():
        print("ERROR: File not found")
        return

    size_mb = path.stat().st_size / (1024 ** 2)
    print(f"File size: {size_mb:,.2f} MiB")

    # Read a small sample first
    sample = pd.read_csv(
        path,
        nrows=10,
        dtype=str
    )

    print(f"\nNumber of columns: {len(sample.columns)}")

    print("\nColumns:")
    for i, column in enumerate(sample.columns, 1):
        print(f"  {i:2}. {column}")

    print("\nFirst 5 records:")
    print(sample.head(5).to_string(index=False))

    # Inspect important categorical features
    categorical_columns = [
        "type",
        "operation",
        "subtype",
        "label",
        "subLabel",
        "protocol",
    ]

    categorical_columns = [
        col for col in categorical_columns
        if col in sample.columns
    ]

    counters = {
        col: Counter()
        for col in categorical_columns
    }

    missing_values = Counter()
    total_rows = 0

    print("\nScanning complete dataset...")

    # Process in chunks to avoid excessive RAM usage
    for chunk in pd.read_csv(
        path,
        chunksize=CHUNK_SIZE,
        dtype=str
    ):
        total_rows += len(chunk)

        missing_values.update(
            chunk.isna().sum().to_dict()
        )

        for col in categorical_columns:
            counters[col].update(
                chunk[col]
                .fillna("<MISSING>")
                .value_counts()
                .to_dict()
            )

        print(
            f"\rProcessed {total_rows:,} rows",
            end="",
            flush=True
        )

    print(f"\n\nTotal rows: {total_rows:,}")

    print("\nMissing values:")

    for col in sample.columns:
        count = missing_values[col]
        percentage = (
            count / total_rows * 100
            if total_rows else 0
        )

        print(
            f"  {col:20} "
            f"{count:12,} ({percentage:6.2f}%)"
        )

    for col, counter in counters.items():
        print(f"\nDistribution of '{col}':")

        for value, count in counter.most_common(20):
            percentage = (
                count / total_rows * 100
                if total_rows else 0
            )

            print(
                f"  {str(value):35} "
                f"{count:12,} ({percentage:6.2f}%)"
            )


def main():
    print("CICAPT-IIoT Dataset Inspection")
    print(f"Dataset directory: {ROOT}")

    for path in FILES:
        inspect_csv(path)

    print("\nDataset inspection completed.")


if __name__ == "__main__":
    main()
