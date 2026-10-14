from pydantic import BaseModel, Field


class FileData(BaseModel):
    filename: str = Field(..., description="File name")
    content: bytes = Field(..., description="File content")
    content_type: str = Field(..., description="Content type")
    as_attachment: bool = Field(False, description="Serve as attachment")
