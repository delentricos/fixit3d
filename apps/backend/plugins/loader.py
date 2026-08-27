import importlib
import pkgutil

from .registry import plugin_registry


class PluginLoader:

    def load_handler(self, plugin_id: str):
        return importlib.import_module(
            f"{__package__}.handlers.{plugin_id}"
        )

    def discover_handlers(self):
        package = importlib.import_module(f"{__package__}.handlers")

        discovered = []

        for module_info in pkgutil.iter_modules(package.__path__):
            module_name = module_info.name

            if module_name.startswith("_") or module_name == "registry":
                continue

            module = importlib.import_module(
                f"{__package__}.handlers.{module_name}"
            )

            metadata = getattr(
                module,
                "plugin_metadata",
                None,
            )

            if metadata is not None:
                plugin_registry.register(metadata)

            discovered.append(module_name)

        return discovered


plugin_loader = PluginLoader()