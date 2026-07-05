from fastapi import APIRouter, Depends, File as FastAPIFile, HTTPException, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.access_log import AccessLog
from app.models.file import File
from app.models.user import User
from app.routes.dependencies import get_current_user
from app.schemas.file import FileRead
from app.services import cloudinary_service
from app.services.file_service import (
    build_cloudinary_public_id,
    get_cloudinary_resource_type,
    validate_and_read_upload,
)
from app.services.malware_scanner import malware_scanner

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


@router.post("", response_model=FileRead, status_code=201)
async def upload_file(
    request: Request,
    upload: UploadFile = FastAPIFile(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> File:
    file_bytes, extension, stored_filename = await validate_and_read_upload(upload)

    scan_result = malware_scanner.scan_bytes(file_bytes)
    if not scan_result.is_clean:
        raise HTTPException(status_code=400, detail=scan_result.message)

    public_id = build_cloudinary_public_id(current_user.id, stored_filename)
    resource_type = get_cloudinary_resource_type(extension)
    upload_result = cloudinary_service.upload_file(file_bytes, public_id, resource_type)

    file_record = File(
        owner_id=current_user.id,
        original_filename=upload.filename or "uploaded-file",
        stored_filename=stored_filename,
        extension=extension,
        content_type=upload.content_type,
        size_bytes=len(file_bytes),
        cloudinary_public_id=upload_result["public_id"],
        cloudinary_resource_type=upload_result["resource_type"],
    )
    db.add(file_record)
    db.flush()
    write_access_log(db, "upload", request, user_id=current_user.id, file_id=file_record.id)
    db.commit()
    db.refresh(file_record)
    return file_record


@router.get("", response_model=list[FileRead])
def list_my_files(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[File]:
    return list(db.scalars(select(File).where(File.owner_id == current_user.id)).all())


@router.get("/{file_id}", response_model=FileRead)
def get_file_details(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> File:
    file_record = db.get(File, file_id)
    if not file_record or file_record.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="File not found.")
    return file_record


@router.delete("/{file_id}", status_code=204)
def delete_file(
    file_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    file_record = db.get(File, file_id)
    if not file_record or file_record.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="File not found.")

    cloudinary_service.delete_file(
        file_record.cloudinary_public_id,
        file_record.cloudinary_resource_type,
    )
    write_access_log(db, "delete", request, user_id=current_user.id, file_id=file_record.id)
    db.delete(file_record)
    db.commit()
