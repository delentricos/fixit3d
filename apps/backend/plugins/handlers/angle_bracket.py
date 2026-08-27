from .registry import handler_registry
from ..models import PluginMetadata
from ..part_state import PartState
from ..part_store import part_store


plugin_metadata = PluginMetadata(
    id="angle_bracket",
    name="Angle Bracket",
    version="1.0.0",
    category="engineering",
    status="active",
    description="Parametric angle bracket generator.",
    author="FixIt3D",
    capabilities=["generate", "set_dimensions"],
)


def build_holes(
    width: float,
    height: float,
    hole_diameter: float,
    hole_spacing: float,
):
    return [
        {
            "id": "hole_1",
            "type": "through",
            "diameter": hole_diameter,
            "position": {
                "x": (width - hole_spacing) / 2,
                "y": height / 2,
            },
        },
        {
            "id": "hole_2",
            "type": "through",
            "diameter": hole_diameter,
            "position": {
                "x": (width + hole_spacing) / 2,
                "y": height / 2,
            },
        },
    ]


def generate(payload: dict):
    width = payload.get("width", 100)
    height = payload.get("height", 80)
    thickness = payload.get("thickness", 5)
    angle = payload.get("angle", 90)

    hole_diameter = payload.get("hole_diameter", 5)
    hole_spacing = payload.get("hole_spacing", 40)

    holes = build_holes(
        width,
        height,
        hole_diameter,
        hole_spacing,
    )

    part_id = payload.get("id")

    if not part_id:
        part_id = "part_001"

    part = PartState(
        id=part_id,
        plugin="angle_bracket",
        parameters={
            "width": width,
            "height": height,
            "thickness": thickness,
            "angle": angle,
            "hole_diameter": hole_diameter,
            "hole_spacing": hole_spacing,
        },
        geometry={
            "type": "angle_bracket",
        },
        features={
            "holes": holes,
        },
    )

    part_store.save(part)

    return part


def set_dimensions(payload: dict):
    part_id = payload.get("id")

    if not part_id:
        raise ValueError("Part id is required")

    part = part_store.get(part_id)

    if part is None:
        raise ValueError("Part not found")

    width = payload.get(
        "width",
        part.parameters["width"],
    )

    height = payload.get(
        "height",
        part.parameters["height"],
    )

    thickness = payload.get(
        "thickness",
        part.parameters["thickness"],
    )

    angle = payload.get(
        "angle",
        part.parameters["angle"],
    )

    hole_diameter = part.parameters.get(
        "hole_diameter",
        5,
    )

    hole_spacing = part.parameters.get(
        "hole_spacing",
        40,
    )

    part.parameters.update(
        {
            "width": width,
            "height": height,
            "thickness": thickness,
            "angle": angle,
        }
    )

    part.features["holes"] = build_holes(
        width,
        height,
        hole_diameter,
        hole_spacing,
    )

    part_store.save(part)

    return part


handler_registry.register(
    "angle_bracket",
    {
        "generate": generate,
        "set_dimensions": set_dimensions,
    },
)
