from .registry import handler_registry
from ..models import PluginMetadata
from ..interfaces import PluginConnection
from ..part_state import PartState
from ..part_store import part_store


plugin_metadata = PluginMetadata(
    id="lid",
    name="Lid",
    version="1.0.0",
    category="mechanical",
    status="active",
    description="Parametric lid generator.",
    author="FixIt3D",
    capabilities=["generate_for_part", "update_for_part"],
    connections=[
        PluginConnection(
            type="lid_mount",
            direction="requires",
            behavior="linked",
            dimensions={
                "width": "host.width",
                "depth": "host.depth",
            },
            links={
                "host.width": "width",
                "host.depth": "depth",
            },
            update_capability="update_for_part",
        )
    ],
)


def find_lid_mount(part):
    mount_points = part.features.get("mount_points", [])

    for mount in mount_points:
        if mount.get("type") == "lid_mount":
            return mount

    return None


def generate_for_part(payload: dict):
    host_id = payload.get("host_id")

    if not host_id:
        raise ValueError("host_id is required")

    host = part_store.get(host_id)

    if host is None:
        raise ValueError("Host part not found")

    mount = find_lid_mount(host)

    if mount is None:
        raise ValueError("Host part has no lid_mount")

    mount_width = mount["dimensions"]["width"]
    mount_depth = mount["dimensions"]["depth"]

    width = payload.get("width", mount_width)
    depth = payload.get("depth", mount_depth)

    if float(width) != float(mount_width):
        raise ValueError(
            f"Lid width {width} is incompatible with mount width {mount_width}"
        )

    if float(depth) != float(mount_depth):
        raise ValueError(
            f"Lid depth {depth} is incompatible with mount depth {mount_depth}"
        )

    thickness = payload.get("thickness", 5)

    position = mount["position"]
    orientation = mount["orientation"]

    lid_id = payload.get("id")

    if not lid_id:
        lid_id = part_store.generate_id()

    part = PartState(
        id=lid_id,
        plugin="lid",
        parameters={
            "width": width,
            "depth": depth,
            "thickness": thickness,
            "host_id": host_id,
            "mount_id": mount["id"],
        },
        geometry={
            "type": "lid",
        },
        features={
            "attached_to": {
                "part_id": host_id,
                "mount_id": mount["id"],
            },
            "mount_position": position,
            "mount_orientation": orientation,
        },
    )

    part_store.save(part)

    return part


def update_for_part(payload: dict):
    part_id = payload.get("id")
    host_id = payload.get("host_id")

    if not part_id:
        raise ValueError("Lid part id is required")

    if not host_id:
        raise ValueError("Host id is required")

    lid = part_store.get(part_id)

    if lid is None:
        raise ValueError("Lid part not found")

    host = part_store.get(host_id)

    if host is None:
        raise ValueError("Host part not found")

    mount_points = host.features.get("mount_points", [])

    mount = next(
        (
            item
            for item in mount_points
            if item.get("id") == "lid_mount"
        ),
        None,
    )

    if mount is None:
        raise ValueError("Lid mount not found")

    lid.parameters.update(
        {
            "width": mount["dimensions"]["width"],
            "depth": mount["dimensions"]["depth"],
            "host_id": host_id,
            "mount_id": mount["id"],
        }
    )

    lid.features["attached_to"] = {
        "part_id": host_id,
        "mount_id": mount["id"],
    }

    lid.features["mount_position"] = mount["position"]
    lid.features["mount_orientation"] = mount["orientation"]

    part_store.save(lid)

    return lid

handler_registry.register(
    "lid",
    {
        "generate_for_part": generate_for_part,
        "update_for_part": update_for_part,
    },
)
