from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from typing import List

from ..database import get_session
from ..crud import (
    create_context_version,
    get_user_contexts_summary,
    get_context_versions,
    get_context_version,
    mark_version_used
)
from ..services import get_current_user, crypto_service
from ..models import User
from ..schemas import (
    ContextCreate,
    ContextVersionResponse,
    ContextBoxSummary,
    MarkUsedRequest,
    DecryptRequest
)
from ..constants import ContextBox, ErrorCode
from ..logging_config import logger

router = APIRouter(prefix="/contexts", tags=["contexts"])


@router.get("", response_model=List[ContextBoxSummary])
def get_contexts(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    return get_user_contexts_summary(session, current_user.id)


@router.post("/{box_name}/versions", response_model=ContextVersionResponse, status_code=status.HTTP_201_CREATED)
def create_version(
    box_name: ContextBox,
    context_data: ContextCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    version = create_context_version(session, current_user.id, box_name.value, context_data.text)
    return ContextVersionResponse(
        version_number=version.version_number,
        created_at=version.created_at
    )


@router.get("/{box_name}/versions")
def get_versions(
    box_name: ContextBox,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    versions = get_context_versions(session, current_user.id, box_name.value)
    return [
        {
            "version_number": v.version_number,
            "created_at": v.created_at,
            "uses_count": v.uses_count,
            "last_used_at": v.last_used_at
        }
        for v in versions
    ]


@router.get("/{box_name}/versions/{version_number}")
def get_version(
    box_name: ContextBox,
    version_number: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    if version_number < 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Version number must be non-negative",
                "error_code": ErrorCode.VALIDATION_ERROR
            }
        )
    version = get_context_version(session, current_user.id, box_name.value, version_number)
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "message": f"Version {version_number} not found for {box_name.value}",
                "error_code": ErrorCode.NOT_FOUND
            }
        )
    
    return {
        "ciphertext": version.ciphertext,
        "iv": version.iv
    }


@router.post("/{box_name}/versions/{version_number}/mark_used")
def mark_version_used_endpoint(
    box_name: ContextBox,
    version_number: int,
    request: MarkUsedRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    if version_number < 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Version number must be non-negative",
                "error_code": ErrorCode.VALIDATION_ERROR
            }
        )
    mark_version_used(session, current_user.id, box_name.value, version_number, request.site)
    return {"ok": True}


@router.post("/decrypt")
def decrypt_context(
    request: DecryptRequest,
    current_user: User = Depends(get_current_user)
):
    try:
        plaintext = crypto_service.decrypt(request.ciphertext)
        return {"plaintext": plaintext}
    except ValueError as e:
        logger.error(f"Decryption failed for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Failed to decrypt context",
                "error_code": ErrorCode.DECRYPTION_ERROR
            }
        )

