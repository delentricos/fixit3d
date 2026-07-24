from pydantic import BaseModel


class PluginMetadata(BaseModel):
    id: str
    name: str
    version: str
    category: str
    status: str

    description: str
    author: str

    capabilities: list[str]