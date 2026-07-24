from .models import PluginMetadata


class PluginRegistry:
    def __init__(self):
        self.plugins: list[PluginMetadata] = []

    def register(self, plugin: PluginMetadata):
        self.plugins.append(plugin)

    def list_plugins(self):
        return self.plugins


plugin_registry = PluginRegistry()

plugin_registry.register(
    PluginMetadata(
        id="test_plugin",
        name="Test Plugin",
        version="1.0.0",
        category="test",
        status="active",
        description="A test plugin for FixIt3D development.",
        author="FixIt3D",
        capabilities=[
            "test_capability",
        ],
    )
)