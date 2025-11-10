from sqlmodel import Session, select
from typing import Optional, List
from uuid import UUID

from ..models import AnalyticsEvent


def create_analytics_event(
    session: Session,
    user_id: Optional[UUID],
    event_type: str,
    metadata: dict
) -> AnalyticsEvent:
    event = AnalyticsEvent(
        user_id=user_id,
        event_type=event_type,
        event_metadata=metadata
    )
    session.add(event)
    session.commit()
    session.refresh(event)
    return event


def get_analytics_events(
    session: Session,
    user_id: Optional[UUID] = None,
    limit: int = 100
) -> List[AnalyticsEvent]:
    statement = select(AnalyticsEvent)
    if user_id:
        statement = statement.where(AnalyticsEvent.user_id == user_id)
    statement = statement.order_by(AnalyticsEvent.created_at.desc()).limit(limit)
    return list(session.exec(statement).all())

