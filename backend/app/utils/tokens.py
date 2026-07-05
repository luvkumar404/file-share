import secrets
import uuid
from pathlib import Path


def create_share_token() -> str:
    return secrets.token_urlsafe(32)


def create_safe_filename(extension: str) -> str:
    clean_extension = extension.lower().lstrip(".")
    return f"{uuid.uuid4().hex}.{clean_extension}"


def get_extension(filename: str) -> str:
    return Path(filename).suffix.lower().lstrip(".")
