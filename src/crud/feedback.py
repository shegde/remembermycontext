from sqlmodel import Session
from typing import Optional
from uuid import UUID

from ..models import Feedback
from ..logging_config import logger


def create_feedback(
    session: Session,
    feedback_type: str,
    message: str,
    email: Optional[str] = None,
    user_id: Optional[UUID] = None
) -> Feedback:
    feedback = Feedback(
        user_id=user_id,
        type=feedback_type,
        message=message,
        email=email
    )
    session.add(feedback)
    session.commit()
    session.refresh(feedback)
    logger.info(f"Feedback created: type={feedback_type}, user_id={user_id}")
    return feedback

