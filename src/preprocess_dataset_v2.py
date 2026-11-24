
from pathlib import Path

import pandas as pd
from tqdm import tqdm

from verbalizer_v2 import describe_node, describe_event


ROOT = Path(__file__).resolve().parents[1]

RAW = ROOT / "data/raw/cicapt-iiot/Provenance_Logs"
OUTPUT = ROOT / "data/processed/cicapt-iiot-v2"

NODE_TYPES = ["Process", "Artifact"]

EDGE_TYPES = [
    "Used",
    "WasGeneratedBy",
    "WasDerivedFrom",
    "WasTriggeredBy",
]


def preprocess_phase(filename, phase):
    print(f"\nProcessing {filename}")

    df = pd.read_csv(
        RAW / filename,
        dtype=str
    )

    nodes = df[
        df["type"].isin(NODE_TYPES)
    ].copy()

    edges = df[
        df["type"].isin(EDGE_TYPES)
    ].copy()

    node_lookup = (
        nodes.set_index("id")
        .to_dict(orient="index")
    )

    # ---------------------------------
    # Node-based dataset
    # ---------------------------------

    node_records = []

    for node in tqdm(
        nodes.to_dict("records"),
        desc="Verbalising nodes"
    ):
        node_records.append({
            "phase": phase,
            "node_id": node["id"],
            "node_type": node["type"],
            "pid": node["pid"],
            "seen_time": node["seen time"],
            "start_time": node["start time"],
            "text": describe_node(node),
            "label": int(node["label"]),
            "sub_label": node["subLabel"],
        })

    node_df = pd.DataFrame(node_records)

    node_output = OUTPUT / f"{phase}_nodes.parquet"

    node_df.to_parquet(
        node_output,
        index=False
    )

    # ---------------------------------
    # Event-based dataset
    # ---------------------------------

    event_records = []

    grouped = edges.groupby(
        "event id",
        sort=False
    )

    for event_id, group in tqdm(
        grouped,
        total=grouped.ngroups,
        desc="Verbalising events"
    ):
        records = group.to_dict("records")

        connected_ids = (
            set(group["from"])
            | set(group["to"])
        )

        connected_nodes = [
            node_lookup[node_id]
            for node_id in connected_ids
        ]

        # Original edge-level annotations
        original_label = int(
            (group["label"] == "1").any()
        )

        # Derived contextual indicator
        malicious_endpoint = any(
            node["label"] == "1"
            for node in connected_nodes
        )

        contextual_label = int(
            original_label or malicious_endpoint
        )

        original_tactics = sorted({
            edge["subLabel"]
            for edge in records
            if edge["label"] == "1"
            and pd.notna(edge["subLabel"])
            and edge["subLabel"] != "0"
        })

        contextual_tactics = sorted(
            set(original_tactics)
            | {
                node["subLabel"]
                for node in connected_nodes
                if node["label"] == "1"
                and pd.notna(node["subLabel"])
                and node["subLabel"] != "0"
            }
        )

        event_records.append({
            "phase": phase,
            "event_id": event_id,
            "timestamp": group["time"].iloc[0],
            "edge_count": len(group),
            "node_ids": sorted(connected_ids),
            "text": describe_event(
                records,
                node_lookup
            ),
            "original_label": original_label,
            "contextual_label": contextual_label,
            "original_tactics": original_tactics,
            "contextual_tactics": contextual_tactics,
        })

    event_df = pd.DataFrame(event_records)

    event_output = OUTPUT / f"{phase}_events.parquet"

    event_df.to_parquet(
        event_output,
        index=False
    )

    # ---------------------------------
    # Summary
    # ---------------------------------

    print("\nNODE DATASET")
    print(f"Records: {len(node_df):,}")
    print(f"Malicious: {node_df['label'].sum():,}")
    print(f"Saved: {node_output}")

    print("\nEVENT DATASET")
    print(f"Records: {len(event_df):,}")

    print(
        "Original malicious events:",
        event_df["original_label"].sum()
    )

    print(
        "Contextual events:",
        event_df["contextual_label"].sum()
    )

    print(f"Saved: {event_output}")

    print("\nSAMPLE NODE DESCRIPTIONS")

    for text in node_df["text"].head(3):
        print(f"- {text}")

    print("\nSAMPLE EVENT DESCRIPTIONS")

    for text in event_df["text"].head(3):
        print(f"- {text}")

    print("\nDESCRIPTION LENGTH STATISTICS")

    print(
        event_df["text"]
        .str.split()
        .str.len()
        .describe()
        .to_string()
    )


def main():
    OUTPUT.mkdir(
        parents=True,
        exist_ok=True
    )

    preprocess_phase(
        "Phase1_Provenance.csv",
        "phase1"
    )

    preprocess_phase(
        "Phase2_Provenance.csv",
        "phase2"
    )

    print("\nPreprocessing completed.")


if __name__ == "__main__":
    main()
