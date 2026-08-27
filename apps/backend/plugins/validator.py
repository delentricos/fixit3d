from .models import PluginMetadata
from .registry import PluginRegistry


class PluginValidator:

    def dimensions_match(self, required: dict, provided: dict):
        for key in ("width", "depth"):
            if key not in required or key not in provided:
                continue

            if required[key] != provided[key]:
                return False

        return True

    def validate_part_connection(
        self,
        required_dimensions: dict,
        provided_dimensions: dict,
    ):
        for key in ("width", "depth"):
            required = required_dimensions.get(key)
            provided = provided_dimensions.get(key)

            if required is None or provided is None:
                continue

            if float(required) != float(provided):
                return False

        return True

    def validate(self, plugin: PluginMetadata, registry: PluginRegistry | None = None):

        if not plugin.id:
            return False, "Plugin id is required"

        if not plugin.name:
            return False, "Plugin name is required"

        if not plugin.version:
            return False, "Plugin version is required"

        if not plugin.capabilities:
            return False, "Plugin needs capabilities"

        if registry is not None:
            for connection in plugin.connections:
                if connection.direction != "requires":
                    continue

                compatible = False

                for other in registry.list_plugins():
                    if other.id == plugin.id:
                        continue

                    for provided in other.connections:
                        if (
                            provided.type == connection.type
                            and provided.direction == "provides"
                            and self.dimensions_match(
                                connection.dimensions,
                                provided.dimensions,
                            )
                        ):
                            compatible = True
                            break

                    if compatible:
                        break

                if not compatible:
                    return False, (
                        f"No plugin provides required connection "
                        f"'{connection.type}'"
                    )

        return True, "Valid plugin"


plugin_validator = PluginValidator()
