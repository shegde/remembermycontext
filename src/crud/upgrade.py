from sqlmodel import Session, select
from typing import Optional
from uuid import UUID

from ..models import UpgradeInterest
from ..logging_config import logger


def create_upgrade_interest(session: Session, user_id: UUID, email: str, notes: Optional[str] = None) -> UpgradeInterest:
    statement = select(UpgradeInterest).where(UpgradeInterest.user_id == user_id)
    existing = session.exec(statement).first()
    
    if existing:
        existing.notes = notes
        existing.email = email
        session.add(existing)
        session.commit()
        logger.info(f"Upgrade interest updated for user: {email}")
        return existing
    
    upgrade_interest = UpgradeInterest(
        user_id=user_id,
        email=email,
        notes=notes
    )
    session.add(upgrade_interest)
    session.commit()
    session.refresh(upgrade_interest)
    logger.info(f"Upgrade interest created for user: {email}")
    return upgrade_interest


def get_upgrade_interest(session: Session, user_id: UUID) -> Optional[UpgradeInterest]:
    statement = select(UpgradeInterest).where(UpgradeInterest.user_id == user_id)
    return session.exec(statement).first()

