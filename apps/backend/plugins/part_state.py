from pydantic import BaseModel, Field


class PartState(BaseModel):
    id: str
    plugin: str
    parameters: dict = Field(default_factory=dict)
    features: dict = Field(default_factory=dict)
    geometry: dict = Field(default_factory=dict)
    position: dict = Field(default_factory=dict)
    rotation: dict = Field(default_factory=dict)
    scale: dict = Field(default_factory=dict)