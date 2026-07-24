from fastapi import FastAPI
from plugins.registry import plugin_registry

app = FastAPI(
    title="FixIt3D API",
    version="0.0.1"
)


@app.get("/")
def root():
    return {
        "project": "FixIt3D",
        "status": "Backend running"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


@app.get("/version")
def version():
    return {
        "version": "0.0.1"
    }
    
@app.get("/plugins")
def plugins():
    return plugin_registry.list_plugins()


@app.post("/plugins/{plugin_id}/enable")
def enable_plugin(plugin_id: str):
    plugin = plugin_registry.enable_plugin(plugin_id)

    if plugin is None:
        return {
            "error": "Plugin not found"
        }

    return plugin


@app.post("/plugins/{plugin_id}/disable")
def disable_plugin(plugin_id: str):
    plugin = plugin_registry.disable_plugin(plugin_id)

    if plugin is None:
        return {
            "error": "Plugin not found"
        }

    return plugin