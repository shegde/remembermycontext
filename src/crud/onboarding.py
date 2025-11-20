from sqlmodel import Session, select
from uuid import UUID

from ..models import User
from ..logging_config import logger


def complete_onboarding(session: Session, user_id: UUID) -> User:
    statement = select(User).where(User.id == user_id)
    user = session.exec(statement).first()
    
    if not user:
        raise ValueError("User not found")
    
    try:
        user.onboarding_completed = True
        session.add(user)
        session.commit()
        session.refresh(user)
        logger.info(f"Onboarding completed for user: {user.email}")
        return user
    except Exception as e:
        session.rollback()
        logger.error(f"Failed to complete onboarding for user {user_id}: {str(e)}")
        raise


def get_onboarding_status(session: Session, user_id: UUID) -> bool:
    statement = select(User).where(User.id == user_id)
    user = session.exec(statement).first()
    
    if not user:
        return False
    
    return user.onboarding_completed

