from fastapi import HTTPException, UploadFile, status

from app.core.config import settings
from app.utils.tokens import create_safe_filename, get_extension

ALLOWED_EXTENSIONS = {"pdf", "docx", "txt", "png", "jpg", "jpeg"}


async def validate_and_read_upload(upload: UploadFile) -> tuple[bytes, str, str]:
    original_filename = upload.filename or "uploaded-file"
    extension = get_extension(original_filename)
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File type is not allowed.",
        )

    file_bytes = await upload.read()
    if len(file_bytes) > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File is too large. Max size is {settings.max_file_size_mb} MB.",
        )

    stored_filename = create_safe_filename(extension)
    return file_bytes, extension, stored_filename


def build_cloudinary_public_id(user_id: int, stored_filename: str) -> str:
    return f"secure_file_sharing/users/{user_id}/{stored_filename}"
