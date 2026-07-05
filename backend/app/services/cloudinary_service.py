from io import BytesIO
from pathlib import PurePosixPath

import cloudinary
import cloudinary.uploader
from cloudinary.utils import private_download_url

from app.core.config import settings

cloudinary.config(
    cloud_name=settings.cloudinary_cloud_name,
    api_key=settings.cloudinary_api_key,
    api_secret=settings.cloudinary_api_secret,
    secure=True,
)


def upload_file(file_bytes: bytes, public_id: str, resource_type: str) -> dict:
    file_stream = BytesIO(file_bytes)
    return cloudinary.uploader.upload(
        file_stream,
        public_id=public_id,
        resource_type=resource_type,
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


def create_signed_download_url(
    public_id: str,
    resource_type: str,
    extension: str,
    expires_at: int,
) -> str:
    clean_public_id = remove_extension_from_public_id(public_id, extension)
    return private_download_url(
        clean_public_id,
        extension.lower(),
        resource_type=resource_type,
        type="authenticated",
        expires_at=expires_at,
        attachment=True,
    )


def remove_extension_from_public_id(public_id: str, extension: str) -> str:
    suffix = f".{extension.lower()}"
    path = PurePosixPath(public_id)
    if path.name.lower().endswith(suffix):
        return str(path.with_name(path.name[: -len(suffix)]))
    return public_id
