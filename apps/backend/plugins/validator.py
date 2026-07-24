from .models import PluginMetadata


class PluginValidator:

    def validate(self, plugin: PluginMetadata):

        if not plugin.id:
            return False, "Plugin id is required"

        if not plugin.name:
            return False, "Plugin name is required"

        if not plugin.version:
            return False, "Plugin version is required"

        if not plugin.capabilities:
            return False, "Plugin needs capabilities"

        return True, "Valid plugin"


plugin_validator = PluginValidator()