
from verbalizer_v1 import clean
from verbalizer_v2 import describe_node, describe_event


def get_relationship_records(edges):
    """
    Remove duplicate relationship records consistently
    with the existing V2 verbaliser.

    Preserve distinct relationships and their operations.
    """

    unique_edges = []
    seen = set()

    for edge in edges:
        key = (
            edge["from"],
            edge["to"],
            edge["type"],
            clean(edge.get("operation")),
        )

        if key not in seen:
            seen.add(key)
            unique_edges.append(edge)

    return unique_edges


def describe_operation_only(edges):
    """
    E5-A: System operations without entity attributes
    or explicit provenance relationships.
    """

    operations = []

    for edge in get_relationship_records(edges):
        operation = clean(edge.get("operation"))

        if operation:
            operations.append(operation)

    if not operations:
        return "Operations: unknown."

    return (
        "Operations: "
        + "; ".join(sorted(operations))
        + "."
    )


def describe_operation_entities(edges, node_lookup):
    """
    E5-B: Operations and entity attributes without
    explicit provenance relationships.
    """

    operation_text = describe_operation_only(edges)

    connected_ids = set()

    for edge in edges:
        connected_ids.add(edge["from"])
        connected_ids.add(edge["to"])

    descriptions = []

    for node_id in connected_ids:
        node = node_lookup[node_id]

        descriptions.append(
            describe_node(node)
        )

    # Deterministic ordering without exposing
    # arbitrary provenance node identifiers.
    descriptions.sort()

    if not descriptions:
        return operation_text

    return (
        operation_text
        + " Entities: "
        + ". ".join(descriptions)
        + "."
    )


def describe_full_provenance(edges, node_lookup):
    """
    E5-C: Existing V2 provenance representation.
    """

    return describe_event(edges, node_lookup)


def describe_all_variants(edges, node_lookup):
    return {
        "operation_only": describe_operation_only(
            edges
        ),

        "operation_entities": describe_operation_entities(
            edges,
            node_lookup,
        ),

        "full_provenance": describe_full_provenance(
            edges,
            node_lookup,
        ),
    }

