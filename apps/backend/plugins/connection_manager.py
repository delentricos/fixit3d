from .part_store import part_store
from .runtime import PluginRuntime
from .registry import plugin_registry


class ConnectionConflictError(ValueError):
    pass


class ConnectionManager:

    def __init__(self, store, runtime):
        self.store = store
        self.runtime = runtime

    def get_connected_parts(self, host_part_id: str):
        connected = []

        for part in self.store.list_parts():
            attached_to = part.features.get("attached_to")

            if not attached_to:
                continue

            if attached_to.get("part_id") == host_part_id:
                connected.append(part)

        return connected

    def get_plugin_metadata(self, plugin_id: str):
        return self.runtime.registry.get_plugin(plugin_id)

    def _get_required_connections(self, part):
        plugin = self.get_plugin_metadata(part.plugin)

        if plugin is None:
            raise ValueError(f"Plugin '{part.plugin}' not found")

        return [
            connection
            for connection in plugin.connections
            if connection.direction == "requires"
        ]

    def _get_provider_mounts(self, host_part, connection_type):
        mounts = host_part.features.get("mount_points", [])
        provider_plugin = self.get_plugin_metadata(host_part.plugin)

        if provider_plugin is None:
            raise ValueError(f"Plugin '{host_part.plugin}' not found")

        provides_type = any(
            connection.direction == "provides"
            and connection.type == connection_type
            for connection in provider_plugin.connections
        )

        if not provides_type:
            return []

        return [
            mount
            for mount in mounts
            if mount.get("type") == connection_type
        ]

    def _dimensions_match(self, part, host_mount, connection):
        links = connection.links or {}

        for host_key, part_key in links.items():
            host_parameter = host_key.split(".")[-1]
            expected = host_mount.get("dimensions", {}).get(host_parameter)
            actual = part.parameters.get(part_key)

            if expected is None or actual is None:
                continue

            try:
                if float(expected) != float(actual):
                    return False
            except (TypeError, ValueError):
                if expected != actual:
                    return False

        return True

    def _would_create_cycle(self, part_id, host_part_id):
        visited = set()
        current_id = host_part_id

        while current_id:
            if current_id == part_id:
                return True

            if current_id in visited:
                return True

            visited.add(current_id)
            current = self.store.get(current_id)

            if current is None:
                return False

            attached_to = current.features.get("attached_to") or {}
            current_id = attached_to.get("part_id")

        return False

    def _validate_attachment(
        self,
        part,
        host_part,
        mount_id=None,
        connection_type=None,
    ):
        if part.id == host_part.id:
            raise ValueError("A part cannot be attached to itself")

        if self._would_create_cycle(part.id, host_part.id):
            raise ValueError("Attachment would create a cycle")

        required_connections = self._get_required_connections(part)

        if connection_type is not None:
            required_connections = [
                connection
                for connection in required_connections
                if connection.type == connection_type
            ]

        if not required_connections:
            raise ValueError(
                f"Plugin '{part.plugin}' has no compatible required connection"
            )

        matches = []

        for connection in required_connections:
            mounts = self._get_provider_mounts(host_part, connection.type)

            for mount in mounts:
                if mount_id is not None and mount.get("id") != mount_id:
                    continue

                if not self._dimensions_match(part, mount, connection):
                    continue

                matches.append((connection, mount))

        if not matches:
            if mount_id is not None:
                raise ValueError(
                    f"Mount '{mount_id}' is incompatible with part '{part.id}'"
                )

            raise ValueError(
                f"Part '{part.id}' is incompatible with host '{host_part.id}'"
            )

        return matches[0]

    def find_compatible_hosts(self, part_id: str):
        part = self.store.get(part_id)

        if part is None:
            raise ValueError("Part not found")

        hosts = []

        for host in self.store.list_parts():
            if host.id == part.id:
                continue

            try:
                connection, mount = self._validate_attachment(
                    part,
                    host,
                )
            except ValueError:
                continue

            hosts.append(
                {
                    "part": host,
                    "connection_type": connection.type,
                    "mount_id": mount.get("id"),
                }
            )

        return hosts

    def attach_part(
        self,
        part_id: str,
        host_id: str,
        mount_id=None,
        connection_type=None,
    ):
        part = self.store.get(part_id)

        if part is None:
            raise ValueError("Part not found")

        host_part = self.store.get(host_id)

        if host_part is None:
            raise ValueError("Host part not found")

        if part.features.get("attached_to"):
            raise ConnectionConflictError(
                f"Part '{part_id}' is already connected"
            )

        connection, mount = self._validate_attachment(
            part,
            host_part,
            mount_id,
            connection_type,
        )

        previous_part = part.model_copy(deep=True)
        part.features["attached_to"] = {
            "part_id": host_part.id,
            "mount_id": mount.get("id"),
        }
        self.store.save(part)

        try:
            if connection.behavior == "linked":
                if not connection.update_capability:
                    raise ValueError(
                        f"Plugin '{part.plugin}' does not define an update capability"
                    )

                part = self.runtime.execute(
                    part.plugin,
                    connection.update_capability,
                    {
                        "id": part.id,
                        "host_id": host_part.id,
                    },
                )
        except Exception:
            self.store.save(previous_part)
            raise

        return part

    def detach_part(self, part_id: str):
        part = self.store.get(part_id)

        if part is None:
            raise ValueError("Part not found")

        if not part.features.get("attached_to"):
            raise ValueError(f"Part '{part_id}' is not connected")

        part.features.pop("attached_to", None)
        part.parameters.pop("host_id", None)
        part.parameters.pop("mount_id", None)
        self.store.save(part)

        return part

    def update_linked_part(
        self,
        host_part,
        connected_part,
        connection,
    ):
        if connection.behavior != "linked":
            return connected_part

        if not connection.update_capability:
            raise ValueError(
                f"Plugin '{connected_part.plugin}' "
                "does not define an update capability"
            )

        return self.runtime.execute(
            connected_part.plugin,
            connection.update_capability,
            {
                "id": connected_part.id,
                "host_id": host_part.id,
            },
        )

    def update_connected_parts(self, host_part):
        connected_parts = self.get_connected_parts(host_part.id)
        updated_parts = []

        for connected_part in connected_parts:
            plugin = self.get_plugin_metadata(
                connected_part.plugin
            )

            if plugin is None:
                continue

            for connection in plugin.connections:
                if connection.direction != "requires":
                    continue

                if connection.behavior != "linked":
                    continue

                updated = self.update_linked_part(
                    host_part,
                    connected_part,
                    connection,
                )

                updated_parts.append(updated)

        return updated_parts


_runtime = PluginRuntime(plugin_registry)

connection_manager = ConnectionManager(
    part_store,
    _runtime,
)
