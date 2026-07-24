from .models import PluginMetadata
from .storage import PluginStorage


class PluginRegistry:
    def __init__(self):
        self.storage = PluginStorage()
        self.plugins: list[PluginMetadata] = self.storage.get_plugins()

    def register(self, plugin: PluginMetadata):
        self.plugins.append(plugin)
        self.storage.save_plugin(plugin)

    def list_plugins(self):
        return self.plugins

    def get_plugin(self, plugin_id: str):
        for plugin in self.plugins:
            if plugin.id == plugin_id:
                return plugin

        return None

    def enable_plugin(self, plugin_id: str):
        plugin = self.get_plugin(plugin_id)

        if plugin:
            plugin.status = "active"
            self.storage.save_plugin(plugin)

        return plugin

    def disable_plugin(self, plugin_id: str):
        plugin = self.get_plugin(plugin_id)

        if plugin:
            plugin.status = "inactive"
            self.storage.save_plugin(plugin)

        return plugin

    def remove_plugin(self, plugin_id: str):
        plugin = self.get_plugin(plugin_id)

        if not plugin:
            return None

        self.plugins.remove(plugin)
        self.storage.delete_plugin(plugin_id)

        return plugin


plugin_registry = PluginRegistry()


if not plugin_registry.get_plugin("test_plugin"):
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