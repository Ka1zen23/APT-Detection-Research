
from pathlib import Path

import pandas as pd

ROOT = (
    Path(__file__).resolve().parents[1]
    / "data/raw/cicapt-iiot"
    / "Provenance_Logs"
)

NODE_TYPES = ["Process", "Artifact"]

EDGE_TYPES = [
    "Used",
    "WasGeneratedBy",
    "WasDerivedFrom",
    "WasTriggeredBy",
]


def inspect_graph(path):
    print("\n" + "=" * 70)
    print(path.name)
    print("=" * 70)

    df = pd.read_csv(path, dtype=str)

    nodes = df[df["type"].isin(NODE_TYPES)].copy()
    edges = df[df["type"].isin(EDGE_TYPES)].copy()

    node_ids = set(nodes["id"].dropna())

    print("\nGRAPH STRUCTURE")
    print(f"Total records: {len(df):,}")
    print(f"Nodes: {len(nodes):,}")
    print(f"Edges: {len(edges):,}")
    print(f"Unique node IDs: {len(node_ids):,}")

    print(
        "Duplicate node IDs:",
        nodes["id"].dropna().duplicated().sum()
    )

    print(
        "Nodes without ID:",
        nodes["id"].isna().sum()
    )

    missing_from = ~edges["from"].isin(node_ids)
    missing_to = ~edges["to"].isin(node_ids)

    print("\nEDGE INTEGRITY")

    print(
        "Unresolved source nodes:",
        missing_from.sum()
    )

    print(
        "Unresolved destination nodes:",
        missing_to.sum()
    )

    print(
        "Fully resolved edges:",
        (~missing_from & ~missing_to).sum()
    )

    print("\nLABEL DISTRIBUTION BY RECORD TYPE")

    print(
        pd.crosstab(
            df["type"],
            df["label"]
        ).to_string()
    )

    print("\nMALICIOUS RECORDS BY TACTIC")

    malicious = df[df["label"] == "1"]

    if not malicious.empty:
        print(
            pd.crosstab(
                malicious["type"],
                malicious["subLabel"]
            ).to_string()
        )
    else:
        print("No malicious records.")

    print("\nEVENT ID ANALYSIS")

    event_counts = (
        edges["event id"]
        .dropna()
        .value_counts()
    )

    print(f"Unique event IDs: {len(event_counts):,}")

    print(
        "Event IDs with multiple edges:",
        (event_counts > 1).sum()
    )

    print("\nEdges per event ID:")
    print(event_counts.describe().to_string())

    print("\nEVENT TIMESTAMP RANGE")

    timestamps = pd.to_numeric(
        edges["time"],
        errors="coerce"
    )

    print(
        "Earliest:",
        pd.to_datetime(
            timestamps.min(),
            unit="s",
            utc=True
        )
    )

    print(
        "Latest:",
        pd.to_datetime(
            timestamps.max(),
            unit="s",
            utc=True
        )
    )

    print("\nMALICIOUS RECORD SAMPLES")

    columns = [
        "type", "id", "from", "to",
        "exe", "name", "operation",
        "path", "event id", "time",
        "label", "subLabel"
    ]

    print(
        malicious[columns]
        .head(10)
        .to_string(index=False)
    )


def main():
    for filename in [
        "Phase1_Provenance.csv",
        "Phase2_Provenance.csv"
    ]:
        inspect_graph(ROOT / filename)

    print("\nGraph inspection completed.")


if __name__ == "__main__":
    main()
