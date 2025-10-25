from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.database import get_session
from app.crud import (
    create_context_version, 
    get_user_contexts_summary, 
    get_context_versions, 
    get_context_version,
    mark_version_used
)
from app.services.auth_service import get_current_user
from app.services.crypto_service import crypto_service
from app.models import User, ContextVersion

router = APIRouter(prefix="/contexts", tags=["contexts"])

class ContextCreate(BaseModel):
    text: str

class ContextVersionResponse(BaseModel):
    version_number: int
    created_at: datetime

class ContextBoxSummary(BaseModel):
    box_name: str
    latest_version_number: int
    versions_count: int
    last_used_at: Optional[datetime]
    total_uses: int

class MarkUsedRequest(BaseModel):
    site: str

class DecryptRequest(BaseModel):
    ciphertext: str

@router.get("", response_model=List[ContextBoxSummary])
def get_contexts(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    return get_user_contexts_summary(session, current_user.id)

@router.post("/{box_name}/versions", response_model=ContextVersionResponse)
def create_version(
    box_name: str, 
    context_data: ContextCreate, 
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    version = create_context_version(session, current_user.id, box_name, context_data.text)
    return ContextVersionResponse(
        version_number=version.version_number,
        created_at=version.created_at
    )

@router.get("/{box_name}/versions")
def get_versions(
    box_name: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    versions = get_context_versions(session, current_user.id, box_name)
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
    box_name: str,
    version_number: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    version = get_context_version(session, current_user.id, box_name, version_number)
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Version not found"
        )
    
    return {
        "ciphertext": version.ciphertext,
        "iv": version.iv
    }

@router.post("/{box_name}/versions/{version_number}/mark_used")
def mark_version_used_endpoint(
    box_name: str,
    version_number: int,
    request: MarkUsedRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    mark_version_used(session, current_user.id, box_name, version_number, request.site)
    return {"ok": True}

@router.post("/decrypt")
def decrypt_context(
    request: DecryptRequest,
    current_user: User = Depends(get_current_user)
):
    try:
        plaintext = crypto_service.decrypt(request.ciphertext)
        return {"plaintext": plaintext}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to decrypt"
        )
