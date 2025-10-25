from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_session
from app.crud import create_feedback
from app.services.auth_service import get_current_user
from app.models import User

router = APIRouter(prefix="/feedback", tags=["feedback"])

class FeedbackCreate(BaseModel):
    type: str
    message: str
    email: Optional[str] = None

@router.post("")
def create_feedback_endpoint(
    feedback_data: FeedbackCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    feedback = create_feedback(
        session, 
        feedback_data.type, 
        feedback_data.message, 
        feedback_data.email,
        current_user.id
    )
    return {"ok": True}
