from .models import PluginMetadata
from .storage import PluginStorage


class PluginRegistry:
    def __init__(self):
        self.storage = PluginStorage()
        self.plugins: list[PluginMetadata] = self.storage.get_plugins()

    def register(self, plugin: PluginMetadata):
        existing = self.get_plugin(plugin.id)

        if existing:
            index = self.plugins.index(existing)
            self.plugins[index] = plugin
        else:
            self.plugins.append(plugin)

        self.storage.save_plugin(plugin)

    def install_plugin(self, plugin: PluginMetadata):
        self.register(plugin)
        return plugin

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


    def find_compatible_plugins(self, mount_type: str, direction: str):
        matches = []

        wanted = "requires" if direction == "provides" else "provides"

        for plugin in self.plugins:
            for connection in plugin.connections:
                if (
                    connection.type == mount_type
                    and connection.direction == wanted
                ):
                    matches.append(plugin)

        return matches


plugin_registry = PluginRegistry()
