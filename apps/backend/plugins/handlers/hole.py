from .registry import handler_registry
from ..models import PluginMetadata
from ..part_store import part_store


plugin_metadata = PluginMetadata(
    id="hole",
    name="Hole",
    version="1.0.0",
    category="mechanical",
    status="active",
    description="Parametric hole feature.",
    author="FixIt3D",
    capabilities=["apply"],
)


def _require_numeric(value, field_name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{field_name} must be a number")

    return float(value)


def _validate_vector(vector, field_name: str, keys: tuple[str, ...]):
    if not isinstance(vector, dict):
        raise ValueError(
            f"{field_name} must be an object with {', '.join(keys)}"
        )

    validated = {}

    for key in keys:
        if key not in vector:
            raise ValueError(f"{field_name}.{key} is required")

        validated[key] = _require_numeric(
            vector[key],
            f"{field_name}.{key}",
        )

    return validated


def _validate_reference_plane(reference_plane):
    if not isinstance(reference_plane, dict):
        raise ValueError("feature.reference_plane must be an object")

    required_keys = (
        "id",
        "part_id",
        "origin",
        "normal",
        "x_axis",
        "y_axis",
        "source_face",
    )

    for key in required_keys:
        if key not in reference_plane:
            raise ValueError(f"feature.reference_plane.{key} is required")

    if not isinstance(reference_plane["id"], str) or not reference_plane["id"]:
        raise ValueError("feature.reference_plane.id must be a non-empty string")

    if not isinstance(reference_plane["part_id"], str) or not reference_plane["part_id"]:
        raise ValueError(
            "feature.reference_plane.part_id must be a non-empty string"
        )

    if not isinstance(reference_plane["source_face"], str) or not reference_plane["source_face"]:
        raise ValueError(
            "feature.reference_plane.source_face must be a non-empty string"
        )

    origin = _validate_vector(
        reference_plane["origin"],
        "feature.reference_plane.origin",
        ("x", "y", "z"),
    )

    normal = _validate_vector(
        reference_plane["normal"],
        "feature.reference_plane.normal",
        ("x", "y", "z"),
    )

    x_axis = _validate_vector(
        reference_plane["x_axis"],
        "feature.reference_plane.x_axis",
        ("x", "y", "z"),
    )

    y_axis = _validate_vector(
        reference_plane["y_axis"],
        "feature.reference_plane.y_axis",
        ("x", "y", "z"),
    )

    return {
        "id": reference_plane["id"],
        "part_id": reference_plane["part_id"],
        "origin": origin,
        "normal": normal,
        "x_axis": x_axis,
        "y_axis": y_axis,
        "source_face": reference_plane["source_face"],
    }


def _normalize_feature(part_id: str, feature: dict) -> dict:
    if not isinstance(feature, dict):
        raise ValueError("feature is required")

    feature_id = feature.get("id")

    if not isinstance(feature_id, str) or not feature_id:
        raise ValueError("feature.id is required")

    feature_part_id = feature.get("partId")

    if not isinstance(feature_part_id, str) or not feature_part_id:
        raise ValueError("feature.partId is required")

    if feature_part_id != part_id:
        raise ValueError("feature.partId does not match part_id")

    diameter = _require_numeric(
        feature.get("diameter"),
        "feature.diameter",
    )

    if diameter <= 0:
        raise ValueError("feature.diameter must be greater than 0")

    through_all = feature.get("throughAll")

    if not isinstance(through_all, bool):
        raise ValueError("feature.throughAll must be a boolean")

    if through_all:
        depth = None
    else:
        depth = _require_numeric(
            feature.get("depth"),
            "feature.depth",
        )

        if depth <= 0:
            raise ValueError("feature.depth must be greater than 0")

    position = _validate_vector(
        feature.get("position"),
        "feature.position",
        ("x", "y", "z"),
    )

    normal = _validate_vector(
        feature.get("normal"),
        "feature.normal",
        ("x", "y", "z"),
    )

    center = _validate_vector(
        feature.get("center"),
        "feature.center",
        ("x", "y"),
    )

    reference_plane = _validate_reference_plane(
        feature.get("reference_plane")
    )

    return {
        "id": feature_id,
        "partId": feature_part_id,
        "diameter": diameter,
        "depth": depth,
        "throughAll": through_all,
        "position": position,
        "normal": normal,
        "reference_plane": reference_plane,
        "center": center,
    }


def apply(payload: dict):
    if not isinstance(payload, dict):
        raise ValueError("payload is required")

    part_id = payload.get("part_id")

    if not isinstance(part_id, str) or not part_id:
        raise ValueError("part_id is required")

    if "feature" not in payload:
        raise ValueError("feature is required")

    part = part_store.get(part_id)

    if part is None:
        raise ValueError("Part not found")

    normalized_feature = _normalize_feature(
        part_id,
        payload.get("feature"),
    )

    holes = list(part.features.get("holes", []))

    existing_index = next(
        (
            index
            for index, hole in enumerate(holes)
            if hole.get("id") == normalized_feature["id"]
        ),
        None,
    )

    if existing_index is not None:
        holes[existing_index] = normalized_feature
    else:
        holes.append(normalized_feature)

    part.features["holes"] = holes

    part_store.save(part)

    return part


handler_registry.register(
    "hole",
    {
        "apply": apply,
    },
)

