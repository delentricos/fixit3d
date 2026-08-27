from pydantic import BaseModel


class MountPoint(BaseModel):
    id: str
    type: str
    position: dict
    orientation: dict
    dimensions: dict
    parameters: dict = {}


class PluginConnection(BaseModel):
    type: str
    direction: str  # "provides" or "requires"

    # How the connected part behaves when the host part changes.
    # fixed: dimensions do not change.
    # linked: dimensions follow the host part.
    # constrained: dimensions may change within declared limits.
    behavior: str = "fixed"

    # Compatibility and parameter mapping rules.
    dimensions: dict = {}

    # Parameter links used by linked connections.
    # Example:
    # {"host.width": "width", "host.depth": "depth"}
    links: dict = {}

    # Capability used to update the connected part when the host changes.
    # Example: "update_for_part"
    update_capability: str | None = None


class PluginInterface(BaseModel):
    connections: list[PluginConnection] = []
