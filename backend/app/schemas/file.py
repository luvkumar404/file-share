from datetime import datetime

from pydantic import BaseModel


class FileRead(BaseModel):
    """File metadata shown to the owner."""

    id: int
    original_filename: str
    stored_filename: str
    extension: str
    content_type: str | None
    size_bytes: int
    created_at: datetime

    model_config = {"from_attributes": True}
