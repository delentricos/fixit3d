from .registry import handler_registry
from ..models import PluginMetadata
from ..interfaces import PluginConnection
from ..part_state import PartState
from ..part_store import part_store


plugin_metadata = PluginMetadata(
    id="box",
    name="Box",
    version="1.0.0",
    category="mechanical",
    status="active",
    description="Parametric box generator.",
    author="FixIt3D",
    capabilities=["generate", "set_dimensions"],
    connections=[
        PluginConnection(
            type="lid_mount",
            direction="provides",
            behavior="linked",
            dimensions={
                "source": "mount",
                "width": "width",
                "depth": "depth",
            },
        )
    ],
)


def build_holes(width, depth, hole_diameter, hole_spacing):
    return [
        {
            "id": "hole_1",
            "type": "through",
            "diameter": hole_diameter,
            "position": {
                "x": (width - hole_spacing) / 2,
                "y": depth / 2,
            },
        },
        {
            "id": "hole_2",
            "type": "through",
            "diameter": hole_diameter,
            "position": {
                "x": (width + hole_spacing) / 2,
                "y": depth / 2,
            },
        },
    ]


def build_mounts(width, depth, height):
    return [
        {
            "id": "lid_mount",
            "type": "lid_mount",
            "position": {
                "x": width / 2,
                "y": depth / 2,
                "z": height,
            },
            "orientation": {
                "x": 0,
                "y": 0,
                "z": 1,
            },
            "dimensions": {
                "width": width,
                "depth": depth,
            },
            "parameters": {
                "host": "box",
            },
        }
    ]


def generate(payload: dict):
    width = payload.get("width", 200)
    depth = payload.get("depth", 150)
    height = payload.get("height", 100)
    thickness = payload.get("thickness", 5)
    hole_diameter = payload.get("hole_diameter", 8)
    hole_spacing = payload.get("hole_spacing", 50)

    part_id = payload.get("id")

    if not part_id:
        part_id = part_store.generate_id()

    holes = build_holes(
        width,
        depth,
        hole_diameter,
        hole_spacing,
    )

    mounts = build_mounts(
        width,
        depth,
        height,
    )

    part = PartState(
        id=part_id,
        plugin="box",
        parameters={
            "width": width,
            "depth": depth,
            "height": height,
            "thickness": thickness,
            "hole_diameter": hole_diameter,
            "hole_spacing": hole_spacing,
        },
        geometry={
            "type": "box",
        },
        features={
            "holes": holes,
            "mount_points": mounts,
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

    width = payload.get("width", part.parameters["width"])
    depth = payload.get("depth", part.parameters["depth"])
    height = payload.get("height", part.parameters["height"])
    thickness = payload.get("thickness", part.parameters["thickness"])

    # Validate dimensions are positive numbers
    try:
        width_num = float(width)
        depth_num = float(depth)
        height_num = float(height)
    except (ValueError, TypeError):
        raise ValueError("All dimensions must be valid numbers")

    if width_num <= 0 or depth_num <= 0 or height_num <= 0:
        raise ValueError("All dimensions must be positive numbers")

    hole_diameter = part.parameters.get("hole_diameter", 8)
    hole_spacing = part.parameters.get("hole_spacing", 50)

    part.parameters.update(
        {
            "width": width_num,
            "depth": depth_num,
            "height": height_num,
            "thickness": thickness,
        }
    )

    part.features["holes"] = build_holes(
        width_num,
        depth_num,
        hole_diameter,
        hole_spacing,
    )

    part.features["mount_points"] = build_mounts(
        width_num,
        depth_num,
        height_num,
    )

    part_store.save(part)

    # Propagate linked parameter changes to connected plugins.
    from ..connection_manager import connection_manager

    connection_manager.update_connected_parts(part)

    return part


handler_registry.register(
    "box",
    {
        "generate": generate,
        "set_dimensions": set_dimensions,
    },
)

