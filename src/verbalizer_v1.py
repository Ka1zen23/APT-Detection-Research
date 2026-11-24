
import pandas as pd


def clean(value):
    """Convert missing values into empty strings."""
    if value is None or pd.isna(value):
        return ""

    return str(value).strip()


def describe_node(node):
    """Convert a provenance node into text."""

    node_type = clean(node.get("type"))

    if node_type == "Process":
        parts = ["Process"]

        fields = {
            "name": "named",
            "exe": "using executable",
            "command line": "with command line",
            "uid": "running under user ID",
            "euid": "with effective user ID",
        }

    elif node_type == "Artifact":
        parts = ["Artifact"]

        fields = {
            "subtype": "of type",
            "path": "at path",
            "permissions": "with permissions",
            "protocol": "using protocol",
            "remote address": "with remote address",
            "remote port": "on remote port",
            "local address": "with local address",
            "local port": "on local port",
        }

    else:
        parts = ["Unknown entity"]
        fields = {}

    for field, phrase in fields.items():
        value = clean(node.get(field))

        if value:
            parts.append(f"{phrase} {value}")

    return " ".join(parts)


def describe_edge(edge, node_lookup):
    """Describe an edge using its connected nodes."""

    source = node_lookup[edge["from"]]
    target = node_lookup[edge["to"]]

    source_text = describe_node(source)
    target_text = describe_node(target)

    relation = clean(edge.get("type"))
    operation = clean(edge.get("operation"))

    relationships = {
        "Used": "used",
        "WasGeneratedBy": "was generated or modified by",
        "WasDerivedFrom": "was derived from",
        "WasTriggeredBy": "was triggered by",
    }

    relationship = relationships.get(
        relation,
        "was related to"
    )

    text = (
        f"{source_text} {relationship} "
        f"{target_text}"
    )

    if operation:
        text += f" through operation {operation}"

    return text + "."


def describe_event(edges, node_lookup):
    """Combine related edges into one description."""

    descriptions = [
        describe_edge(edge, node_lookup)
        for edge in edges
    ]

    # Remove identical descriptions while preserving order
    descriptions = list(dict.fromkeys(descriptions))

    return " ".join(descriptions)
