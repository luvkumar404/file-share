from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import hash_password, verify_password
from app.models.access_log import AccessLog
from app.models.file import File
from app.models.share import ShareLink
from app.models.user import User
from app.routes.dependencies import get_current_user
from app.schemas.share import PublicDownloadRequest, PublicDownloadResponse, ShareCreate, ShareRead
from app.services.cloudinary_service import create_signed_download_url
from app.utils.tokens import create_share_token

router = APIRouter()


def client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def write_access_log(
    db: Session,
    action: str,
    request: Request,
    user_id: int | None = None,
    file_id: int | None = None,
) -> None:
    db.add(
        AccessLog(
            user_id=user_id,
            file_id=file_id,
            action=action,
            ip_address=client_ip(request),
        )
    )


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@router.post("/files/{file_id}", response_model=ShareRead, status_code=status.HTTP_201_CREATED)
def create_share_link(
    file_id: int,
    payload: ShareCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ShareLink:
    file_record = db.get(File, file_id)
    if not file_record or file_record.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="File not found.")

    if payload.expires_at <= utc_now():
        raise HTTPException(status_code=400, detail="Expiry time must be in the future.")

    share_link = ShareLink(
        file_id=file_record.id,
        token=create_share_token(),
        password_hash=hash_password(payload.password) if payload.password else None,
        expires_at=payload.expires_at,
    )
    db.add(share_link)
    db.flush()
    write_access_log(
        db,
        "share_create",
        request,
        user_id=current_user.id,
        file_id=file_record.id,
    )
    db.commit()
    db.refresh(share_link)
    return share_link


@router.post("/{token}/download", response_model=PublicDownloadResponse)
def download_shared_file(
    token: str,
    payload: PublicDownloadRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> PublicDownloadResponse:
    share_link = db.scalar(select(ShareLink).where(ShareLink.token == token))
    if not share_link or share_link.is_revoked or share_link.expires_at <= utc_now():
        raise HTTPException(status_code=404, detail="Share link is invalid or expired.")

    if share_link.password_hash:
        if not payload.password or not verify_password(payload.password, share_link.password_hash):
            raise HTTPException(status_code=401, detail="Invalid share password.")

    file_record = db.get(File, share_link.file_id)
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found.")

    download_url = create_signed_download_url(
        file_record.cloudinary_public_id,
        file_record.cloudinary_resource_type,
        int(share_link.expires_at.timestamp()),
    )
    write_access_log(db, "download", request, file_id=file_record.id)
    db.commit()
    return PublicDownloadResponse(
        file_name=file_record.original_filename,
        download_url=download_url,
    )


@router.post("/{share_id}/revoke", response_model=ShareRead)
def revoke_share_link(
    share_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ShareLink:
    share_link = db.get(ShareLink, share_id)
    if not share_link:
        raise HTTPException(status_code=404, detail="Share link not found.")

    file_record = db.get(File, share_link.file_id)
    if not file_record or file_record.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Share link not found.")

    share_link.is_revoked = True
    db.commit()
    db.refresh(share_link)
    return share_link
