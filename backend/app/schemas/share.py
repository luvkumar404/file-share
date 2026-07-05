from datetime import datetime, timezone

from pydantic import BaseModel, Field, field_validator


class ShareCreate(BaseModel):
    """Request body for creating a public share link."""

    expires_at: datetime
    password: str | None = Field(default=None, min_length=6, max_length=128)

    @field_validator("expires_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        """Treat timezone-free dates as UTC to avoid local-time surprises."""

        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value


class ShareRead(BaseModel):
    """Share-link details returned to the file owner."""

    id: int
    file_id: int
    token: str
    expires_at: datetime
    is_revoked: bool

    model_config = {"from_attributes": True}


class PublicDownloadRequest(BaseModel):
    """Optional password submitted by someone using a share link."""

    password: str | None = None


class PublicDownloadResponse(BaseModel):
    """Short-lived signed URL for downloading a shared file."""

    file_name: str
    download_url: str
