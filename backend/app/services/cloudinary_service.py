from io import BytesIO

import cloudinary
import cloudinary.uploader
from cloudinary.utils import cloudinary_url

from app.core.config import settings

cloudinary.config(
    cloud_name=settings.cloudinary_cloud_name,
    api_key=settings.cloudinary_api_key,
    api_secret=settings.cloudinary_api_secret,
    secure=True,
)


def upload_file(file_bytes: bytes, public_id: str) -> dict:
    file_stream = BytesIO(file_bytes)
    return cloudinary.uploader.upload(
        file_stream,
        public_id=public_id,
        resource_type="auto",
        overwrite=False,
        type="authenticated",
    )


def delete_file(public_id: str, resource_type: str) -> None:
    cloudinary.uploader.destroy(
        public_id,
        resource_type=resource_type,
        type="authenticated",
        invalidate=True,
    )


def create_signed_download_url(public_id: str, resource_type: str, expires_at: int) -> str:
    url, _ = cloudinary_url(
        public_id,
        resource_type=resource_type,
        type="authenticated",
        sign_url=True,
        expires_at=expires_at,
        secure=True,
    )
    return url
