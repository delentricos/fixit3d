from .registry import handler_registry
from ..models import PluginMetadata


plugin_metadata = PluginMetadata(
    id="test_plugin",
    name="Test Plugin",
    version="1.0.0",
    category="test",
    status="active",
    description="A test plugin for FixIt3D development.",
    author="FixIt3D",
    capabilities=["test_capability"],
)


def handle_test_capability(payload: dict):
    return {
        "message": "Test plugin executed successfully",
        "received": payload,
    }


handler_registry.register(
    "test_plugin",
    {
        "test_capability": handle_test_capability,
    },
)