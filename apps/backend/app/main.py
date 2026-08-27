
import math

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from plugins.registry import plugin_registry
from plugins.models import PluginMetadata
from plugins.validator import plugin_validator
from plugins.loader import plugin_loader
from plugins.connection_manager import (
    ConnectionConflictError,
    connection_manager,
)


app = FastAPI(
    title="FixIt3D API",
    version="0.0.1",
)


class PartPosition(BaseModel):
    x: float
    y: float
    z: float


class PartPositionUpdate(BaseModel):
    id: str
    position: PartPosition | None = None
    rotation: PartPosition | None = None
    scale: PartPosition | None = None


class PartPositionsRequest(BaseModel):
    updates: list[PartPositionUpdate] = Field(default_factory=list)


# Discover plugin handlers when the backend starts
plugin_loader.discover_handlers()


@app.get("/")
def root():
    return {
        "project": "FixIt3D",
        "status": "Backend running",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
    }


@app.get("/version")
def version():
    return {
        "version": "0.0.1",
    }


@app.get("/plugins")
def plugins():
    return plugin_registry.list_plugins()


@app.get("/plugins/{plugin_id}/compatible")
def compatible_plugins(plugin_id: str):
    plugin = plugin_registry.get_plugin(plugin_id)

    if plugin is None:
        raise HTTPException(
            status_code=404,
            detail="Plugin not found",
        )

    compatible = []

    for connection in plugin.connections:
        compatible.extend(
            plugin_registry.find_compatible_plugins(
                connection.type,
                connection.direction,
            )
        )

    return {
        "plugin": plugin_id,
        "compatible_plugins": compatible,
    }


@app.post("/plugins")
def install_plugin(plugin: PluginMetadata):
    valid, message = plugin_validator.validate(plugin)

    if not valid:
        raise HTTPException(
            status_code=400,
            detail=message,
        )

    return plugin_registry.install_plugin(plugin)


@app.post("/plugins/{plugin_id}/enable")
def enable_plugin(plugin_id: str):
    plugin = plugin_registry.enable_plugin(plugin_id)

    if plugin is None:
        return {
            "error": "Plugin not found",
        }

    return plugin


@app.post("/plugins/{plugin_id}/disable")
def disable_plugin(plugin_id: str):
    plugin = plugin_registry.disable_plugin(plugin_id)

    if plugin is None:
        return {
            "error": "Plugin not found",
        }

    return plugin


@app.delete("/plugins/{plugin_id}")
def remove_plugin(plugin_id: str):
    plugin = plugin_registry.remove_plugin(plugin_id)

    if plugin is None:
        return {
            "error": "Plugin not found",
        }

    return plugin


@app.get("/plugins/debug/handlers")
def debug_handlers():
    from plugins.handlers.registry import handler_registry

    return {
        plugin_id: list(capabilities.keys())
        for plugin_id, capabilities in handler_registry.handlers.items()
    }

@app.post("/plugins/{plugin_id}/execute")
def execute_plugin(plugin_id: str, request: dict):
    capability = request.get("capability")
    payload = request.get("payload", {})

    if not capability:
        raise HTTPException(
            status_code=400,
            detail="Capability is required",
        )

    from plugins.runtime import PluginRuntime

    runtime = PluginRuntime(plugin_registry)
    try:
        return runtime.execute(
            plugin_id,
            capability,
            payload,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

@app.post("/parts/generate")
def generate_part(request: dict):
    """
    Generate a new part from a plugin.

    Request body:
    {
        "plugin_id": "box" | "lid" | "angle_bracket",
        "parameters": { ... }  # plugin-specific parameters
    }

    Returns: Generated Part object
    """
    plugin_id = request.get("plugin_id")
    parameters = request.get("parameters", {})

    # Validate plugin_id
    if not plugin_id:
        raise HTTPException(
            status_code=400,
            detail="plugin_id is required",
        )

    # Check if plugin exists
    plugin = plugin_registry.get_plugin(plugin_id)
    if plugin is None:
        raise HTTPException(
            status_code=404,
            detail=f"Plugin '{plugin_id}' not found",
        )

    # Check if plugin is active
    if plugin.status != "active":
        raise HTTPException(
            status_code=400,
            detail=f"Plugin '{plugin_id}' is not active",
        )

    # Determine generation capability
    # Try "generate" first (for Box, Angle Bracket)
    # Then try "generate_for_part" (for Lid)
    from plugins.handlers.registry import handler_registry

    generation_capability = None
    if handler_registry.get_handler(plugin_id, "generate"):
        generation_capability = "generate"
    elif handler_registry.get_handler(plugin_id, "generate_for_part"):
        generation_capability = "generate_for_part"
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Plugin '{plugin_id}' does not support part generation",
        )

    # Execute plugin through PluginRuntime
    from plugins.runtime import PluginRuntime

    runtime = PluginRuntime(plugin_registry)

    try:
        generated_part = runtime.execute(
            plugin_id,
            generation_capability,
            parameters,
        )
        # Convert PartState to dict for JSON response
        return generated_part.model_dump()
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Part generation failed: {str(e)}",
        )


@app.get("/parts/{part_id}/compatible-hosts")
def compatible_hosts(part_id: str):
    try:
        matches = connection_manager.find_compatible_hosts(part_id)
    except ValueError as error:
        if str(error) == "Part not found":
            raise HTTPException(status_code=404, detail=str(error))
        raise HTTPException(status_code=400, detail=str(error))

    return {
        "part_id": part_id,
        "hosts": [
            {
                "part": match["part"].model_dump(),
                "connection_type": match["connection_type"],
                "mount_id": match["mount_id"],
            }
            for match in matches
        ],
    }


@app.post("/parts/{part_id}/attach")
def attach_part(part_id: str, request: dict):
    host_id = request.get("host_id")
    mount_id = request.get("mount_id")
    connection_type = request.get("connection_type")

    if not host_id:
        raise HTTPException(
            status_code=400,
            detail="host_id is required",
        )

    try:
        part = connection_manager.attach_part(
            part_id,
            host_id,
            mount_id,
            connection_type,
        )
    except ConnectionConflictError as error:
        raise HTTPException(status_code=409, detail=str(error))
    except ValueError as error:
        message = str(error)
        status_code = 404 if message in {
            "Part not found",
            "Host part not found",
        } else 400
        raise HTTPException(status_code=status_code, detail=message)
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Part attachment failed: {str(error)}",
        )

    return part.model_dump()


@app.delete("/parts/{part_id}/attachment")
def detach_part(part_id: str):
    try:
        part = connection_manager.detach_part(part_id)
    except ValueError as error:
        message = str(error)
        status_code = 404 if message == "Part not found" else 400
        raise HTTPException(status_code=status_code, detail=message)

    return part.model_dump()


@app.delete("/parts/{part_id}")
def delete_part(part_id: str):
    from plugins.part_store import part_store

    part = part_store.get(part_id)
    if part is None:
        raise HTTPException(status_code=404, detail="Part not found")

    part_store.delete(part_id)
    return {
        "id": part_id,
        "deleted": True,
    }


@app.post("/parts/positions")
def update_part_positions(request: PartPositionsRequest):
    from plugins.part_store import part_store

    updated_parts = []
    seen_ids = set()

    for update in request.updates:
        if update.id in seen_ids:
            continue

        part = part_store.get(update.id)
        if part is None:
            raise HTTPException(status_code=404, detail="Part not found")

        if (
            update.position is None
            and update.rotation is None
            and update.scale is None
        ):
            raise HTTPException(
                status_code=400,
                detail="Position, rotation, or scale is required",
            )

        if update.position is not None:
            part.position = update.position.model_dump()
        if update.rotation is not None:
            part.rotation = update.rotation.model_dump()
        if update.scale is not None:
            scale_values = update.scale.model_dump().values()
            if any(
                not math.isfinite(value) or value <= 0
                for value in scale_values
            ):
                raise HTTPException(
                    status_code=400,
                    detail="Scale values must be greater than zero",
                )
            part.scale = update.scale.model_dump()
        part_store.save(part)
        updated_parts.append(part)
        seen_ids.add(update.id)

    return [part.model_dump() for part in updated_parts]

@app.get("/parts/debug")
def debug_parts():
    from plugins.part_store import part_store

    return {
        "parts": [
            part.model_dump()
            for part in part_store.list_parts()
        ]
    }