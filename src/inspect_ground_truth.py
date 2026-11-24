
from pathlib import Path

import pandas as pd

ROOT = (
    Path(__file__).resolve().parents[1]
    / "data/raw/cicapt-iiot"
)

PHASE2 = ROOT / "Provenance_Logs/Phase2_Provenance.csv"
ATTACK_INFO = ROOT / "Supplementary Material/attack_info.csv"


def main():
    df = pd.read_csv(PHASE2, dtype=str)

    nodes = df[
        df["type"].isin(["Process", "Artifact"])
    ].copy()

    edges = df[
        df["type"].isin([
            "Used",
            "WasGeneratedBy",
            "WasDerivedFrom",
            "WasTriggeredBy",
        ])
    ].copy()

    malicious_nodes = nodes[nodes["label"] == "1"]

    malicious_ids = set(malicious_nodes["id"])

    # Preserve original ground truth
    edges["original_label"] = edges["label"]

    # Investigate malicious endpoints
    edges["malicious_from"] = (
        edges["from"].isin(malicious_ids)
    )

    edges["malicious_to"] = (
        edges["to"].isin(malicious_ids)
    )

    edges["malicious_endpoint"] = (
        edges["malicious_from"]
        | edges["malicious_to"]
    )

    edges["both_endpoints_malicious"] = (
        edges["malicious_from"]
        & edges["malicious_to"]
    )

    edges["original_malicious"] = (
        edges["original_label"] == "1"
    )

    # Contextual indicator, NOT verified ground truth
    edges["contextual_indicator"] = (
        edges["original_malicious"]
        | edges["malicious_endpoint"]
    )

    print("=" * 70)
    print("GROUND TRUTH AND CONTEXTUAL LABEL INSPECTION")
    print("=" * 70)

    print("\nNODE ANALYSIS")
    print(f"Total nodes: {len(nodes):,}")
    print(f"Malicious nodes: {len(malicious_nodes):,}")

    print("\nEDGE ANALYSIS")
    print(f"Total edges: {len(edges):,}")

    for col in [
        "original_malicious",
        "malicious_from",
        "malicious_to",
        "malicious_endpoint",
        "both_endpoints_malicious",
        "contextual_indicator",
    ]:
        count = edges[col].sum()

        print(
            f"{col:30} "
            f"{count:10,} "
            f"({count / len(edges):.4%})"
        )

    print("\nORIGINAL VS CONTEXTUAL INDICATORS")

    print(
        pd.crosstab(
            edges["original_label"],
            edges["malicious_endpoint"],
            margins=True
        ).to_string()
    )

    print("\nCONTEXTUAL INDICATORS BY EDGE TYPE")

    print(
        pd.crosstab(
            edges["type"],
            edges["contextual_indicator"]
        ).to_string()
    )

    print("\nCONTEXTUAL INDICATORS BY OPERATION")

    print(
        pd.crosstab(
            edges["operation"],
            edges["contextual_indicator"]
        ).to_string()
    )

    print("\nEVENT-LEVEL ANALYSIS")

    events = edges.groupby("event id").agg(
        edge_count=("type", "size"),
        original_malicious=("original_malicious", "any"),
        contextual_indicator=("contextual_indicator", "any"),
    )

    print(f"Total event IDs: {len(events):,}")

    print(
        "Events with explicitly malicious edges:",
        events["original_malicious"].sum()
    )

    print(
        "Events with contextual indicators:",
        events["contextual_indicator"].sum()
    )

    print("\nEVENT ID TIMESTAMP CONSISTENCY")

    times_per_event = (
        edges.groupby("event id")["time"]
        .nunique()
    )

    print(
        "Event IDs with multiple timestamps:",
        (times_per_event > 1).sum()
    )

    print("\nATTACK INFORMATION ANALYSIS")

    attacks = pd.read_csv(ATTACK_INFO, dtype=str)

    print(f"Documented attack steps: {len(attacks)}")

    print("\nAttack steps by tactic:")

    print(
        attacks["Tactic Name"]
        .value_counts()
        .to_string()
    )

    print("\nAttack steps by technique:")

    print(
        attacks["Technique Name"]
        .value_counts()
        .to_string()
    )

    print("\nPID ASSOCIATION")

    attack_pids = set(
        pd.to_numeric(
            attacks["PID"],
            errors="coerce"
        ).dropna()
    )

    processes = nodes[
        nodes["type"] == "Process"
    ].copy()

    processes["numeric_pid"] = pd.to_numeric(
        processes["pid"],
        errors="coerce"
    )

    processes["attack_pid_match"] = (
        processes["numeric_pid"].isin(attack_pids)
    )

    print(f"Unique attack PIDs: {len(attack_pids)}")

    print(
        pd.crosstab(
            processes["label"],
            processes["attack_pid_match"],
            margins=True
        ).to_string()
    )

    print("\nInspection completed.")


if __name__ == "__main__":
    main()
