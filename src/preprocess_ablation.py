
from pathlib import Path
import json

import pandas as pd
from tqdm import tqdm

from verbalizer_ablation import describe_all_variants


ROOT = Path(__file__).resolve().parents[1]

RAW = (
    ROOT / "data/raw/cicapt-iiot/Provenance_Logs"
)

REFERENCE = (
    ROOT / "data/processed/cicapt-iiot-v2"
)

OUTPUT = (
    ROOT / "data/processed/cicapt-iiot-ablation"
)

NODE_TYPES = [
    "Process",
    "Artifact",
]

EDGE_TYPES = [
    "Used",
    "WasGeneratedBy",
    "WasDerivedFrom",
    "WasTriggeredBy",
]

VARIANTS = [
    "operation_only",
    "operation_entities",
    "full_provenance",
]


def preprocess_phase(filename, phase):
    print("\n" + "=" * 70)
    print(f"PROCESSING {phase.upper()}")
    print("=" * 70)

    df = pd.read_csv(
        RAW / filename,
        dtype=str,
    )

    nodes = df[
        df["type"].isin(NODE_TYPES)
    ].copy()

    edges = df[
        df["type"].isin(EDGE_TYPES)
    ].copy()

    assert nodes["id"].is_unique

    node_lookup = (
        nodes.set_index("id")
        .to_dict(orient="index")
    )

    reference = pd.read_parquet(
        REFERENCE / f"{phase}_events.parquet"
    )

    assert reference["event_id"].is_unique

    print(f"Nodes: {len(nodes):,}")
    print(f"Edges: {len(edges):,}")
    print(f"Reference events: {len(reference):,}")

    event_records = []

    grouped = edges.groupby(
        "event id",
        sort=False,
    )

    for event_id, group in tqdm(
        grouped,
        total=grouped.ngroups,
        desc="Generating ablation representations",
    ):
        records = group.to_dict("records")

        descriptions = describe_all_variants(
            records,
            node_lookup,
        )

        event_records.append({
            "phase": phase,
            "event_id": event_id,
            **descriptions,
        })

    generated = pd.DataFrame(event_records)

    assert len(generated) == len(reference)

    assert not generated.duplicated(
        ["phase", "event_id"]
    ).any()

    # Retain the existing event metadata and labels.
    combined = reference.merge(
        generated,
        on=["phase", "event_id"],
        how="left",
        validate="one_to_one",
        sort=False,
    )

    assert len(combined) == len(reference)

    for variant in VARIANTS:
        assert combined[variant].notna().all()

        assert (
            combined[variant].str.strip().str.len() > 0
        ).all()

    # Critical integrity check:
    # Regenerated full provenance text must be
    # identical to the existing V2 representation.
    identical = (
        combined["text"]
        == combined["full_provenance"]
    )

    print("\nFULL PROVENANCE INTEGRITY CHECK")

    print(
        f"Matching descriptions: "
        f"{identical.sum():,}/{len(combined):,}"
    )

    if not identical.all():
        mismatches = combined.loc[
            ~identical,
            [
                "phase",
                "event_id",
                "text",
                "full_provenance",
            ],
        ]

        mismatch_path = (
            OUTPUT / f"{phase}_mismatches.csv"
        )

        mismatches.to_csv(
            mismatch_path,
            index=False,
        )

        raise RuntimeError(
            "Full provenance representation differs "
            f"from V2. Inspect {mismatch_path}"
        )

    summary = {}

    for variant in VARIANTS:
        output_dir = OUTPUT / variant

        output_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

        result = combined[
            reference.columns
        ].copy()

        result["text"] = combined[variant]

        # Verify that no metadata or labels changed.
        pd.testing.assert_frame_equal(
            reference.drop(columns=["text"])
            .reset_index(drop=True),

            result.drop(columns=["text"])
            .reset_index(drop=True),
        )

        output_path = (
            output_dir / f"{phase}_events.parquet"
        )

        result.to_parquet(
            output_path,
            index=False,
        )

        unique_count = result["text"].nunique()

        word_counts = (
            result["text"]
            .str.split()
            .str.len()
        )

        summary[variant] = {
            "events": len(result),
            "unique_descriptions": unique_count,
            "duplicate_records": (
                len(result) - unique_count
            ),
            "mean_words": float(
                word_counts.mean()
            ),
            "maximum_words": int(
                word_counts.max()
            ),
            "original_positives": int(
                result["original_label"].sum()
            ),
            "contextual_positives": int(
                result["contextual_label"].sum()
            ),
        }

        print("\n" + "-" * 60)
        print(variant.upper())
        print("-" * 60)

        print(
            f"Events: {len(result):,}"
        )

        print(
            f"Unique descriptions: "
            f"{unique_count:,}"
        )

        print(
            f"Mean words: "
            f"{word_counts.mean():.2f}"
        )

        print(
            f"Original positives: "
            f"{result['original_label'].sum():,}"
        )

        print(
            f"Contextual positives: "
            f"{result['contextual_label'].sum():,}"
        )

        print(f"Saved: {output_path}")

        print("\nSample descriptions:")

        for text in result["text"].head(3):
            print(f"- {text}")

    return summary


def main():
    OUTPUT.mkdir(
        parents=True,
        exist_ok=True,
    )

    summary = {
        "phase1": preprocess_phase(
            "Phase1_Provenance.csv",
            "phase1",
        ),

        "phase2": preprocess_phase(
            "Phase2_Provenance.csv",
            "phase2",
        ),
    }

    with open(
        OUTPUT / "preprocessing_summary.json",
        "w",
    ) as file:
        json.dump(
            summary,
            file,
            indent=4,
        )

    print("\n" + "=" * 70)
    print("ABLATION PREPROCESSING COMPLETED")
    print("=" * 70)

    print(f"Results saved to: {OUTPUT}")

    print(
        "Original V2 datasets remain unchanged."
    )


if __name__ == "__main__":
    main()
