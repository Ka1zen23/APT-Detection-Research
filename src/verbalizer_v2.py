
from verbalizer_v1 import clean


def describe_node(node):
    node_type = clean(node.get("type"))

    if node_type == "Process":
        fields = [
            ("name", "name"),
            ("exe", "executable"),
            ("uid", "UID"),
            ("euid", "EUID"),
            ("command line", "command"),
        ]

    elif node_type == "Artifact":
        fields = [
            ("subtype", "type"),
            ("path", "path"),
            ("permissions", "permissions"),
            ("protocol", "protocol"),
            ("remote address", "remote address"),
            ("remote port", "remote port"),
            ("local address", "local address"),
            ("local port", "local port"),
        ]

    else:
        fields = []

    parts = [node_type or "Entity"]

    for field, prefix in fields:
        value = clean(node.get(field))

        if value:
            if field in ["uid", "euid", "permissions"]:
                if value.endswith(".0"):
                    value = value[:-2]

            parts.append(f"{prefix}: {value}")

    return "; ".join(parts)


def describe_event(edges, node_lookup):
    aliases = {}
    entities = []
    relationships = []

    def get_alias(node_id):
        if node_id not in aliases:
            node = node_lookup[node_id]

            prefix = (
                "P" if node["type"] == "Process"
                else "A"
            )

            number = sum(
                alias.startswith(prefix)
                for alias in aliases.values()
            ) + 1

            alias = f"{prefix}{number}"
            aliases[node_id] = alias

            entities.append(
                f"{alias}: {describe_node(node)}"
            )

        return aliases[node_id]

    relation_names = {
        "Used": "used",
        "WasGeneratedBy": "was generated or modified by",
        "WasDerivedFrom": "was derived from",
        "WasTriggeredBy": "was triggered by",
    }

    for edge in edges:
        source = get_alias(edge["from"])
        target = get_alias(edge["to"])

        relation = relation_names.get(
            edge["type"],
            "related to"
        )

        operation = clean(edge.get("operation"))

        description = (
            f"{source} {relation} {target}"
        )

        if operation:
            description += f"; operation: {operation}"

        relationships.append(description)

    relationships = list(
        dict.fromkeys(relationships)
    )

    return (
        "Relationships: "
        + ". ".join(relationships)
        + ". Entities: "
        + ". ".join(entities)
        + "."
    )
