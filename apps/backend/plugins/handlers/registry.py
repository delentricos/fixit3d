from typing import Callable


class HandlerRegistry:

    def __init__(self):
        self.handlers: dict[str, dict[str, Callable]] = {}

    def register(
        self,
        plugin_id: str,
        capabilities: dict[str, Callable],
    ):
        self.handlers[plugin_id] = capabilities

    def get_handler(
        self,
        plugin_id: str,
        capability: str,
    ):
        plugin_handlers = self.handlers.get(plugin_id)

        if plugin_handlers is None:
            return None

        return plugin_handlers.get(capability)


handler_registry = HandlerRegistry()