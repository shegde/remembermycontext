from sqlmodel import Session, select
from uuid import UUID

from ..models import User
from ..logging_config import logger


def complete_onboarding(session: Session, user_id: UUID) -> User:
    statement = select(User).where(User.id == user_id)
    user = session.exec(statement).first()
    
    if not user:
        raise ValueError("User not found")
    
    user.onboarding_completed = True
    session.add(user)
    session.commit()
    logger.info(f"Onboarding completed for user: {user.email}")
    return user


def get_onboarding_status(session: Session, user_id: UUID) -> bool:
    statement = select(User).where(User.id == user_id)
    user = session.exec(statement).first()
    
    if not user:
        return False
    
    return user.onboarding_completed

