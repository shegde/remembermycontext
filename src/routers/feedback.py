from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from ..database import get_session
from ..crud import create_feedback
from ..services import get_current_user
from ..models import User
from ..schemas import FeedbackCreate

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("", status_code=status.HTTP_201_CREATED)
def create_feedback_endpoint(
    feedback_data: FeedbackCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    feedback = create_feedback(
        session,
        feedback_data.type.value,
        feedback_data.message,
        feedback_data.email,
        current_user.id
    )
    return {"ok": True, "feedback_id": str(feedback.id)}

