from pydantic import BaseModel, Field


class Link(BaseModel):
    value: str = Field(..., description="Link value")
