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