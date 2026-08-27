from .registry import PluginRegistry
from .handlers.registry import handler_registry


class PluginRuntime:

    def __init__(self, registry: PluginRegistry):
        self.registry = registry

    def check_connection(
        self,
        provider_part,
        required_dimensions: dict,
    ):
        provided_dimensions = {
            "width": provider_part.parameters.get("width"),
            "depth": provider_part.parameters.get("depth"),
        }

        for key in ("width", "depth"):
            required = required_dimensions.get(key)
            provided = provided_dimensions.get(key)

            if required is None or provided is None:
                continue

            if float(required) != float(provided):
                return False

        return True

    def execute(
        self,
        plugin_id: str,
        capability: str,
        payload: dict,
    ):
        plugin = self.registry.get_plugin(plugin_id)

        if plugin is None:
            raise ValueError("Plugin not found")

        if plugin.status != "active":
            raise ValueError("Plugin is not active")

        handler = handler_registry.get_handler(
            plugin_id,
            capability,
        )

        if handler is None:
            raise ValueError(
                f"Handler not found for capability: {capability}"
            )

        return handler(payload)