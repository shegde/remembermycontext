from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from typing import List

from ..database import get_session
from ..services import create_analytics_event, get_current_user
from ..models import User, AnalyticsEvent
from ..schemas import AnalyticsEventCreate, AnalyticsEventResponse

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("", response_model=List[AnalyticsEventResponse])
def get_analytics_events_endpoint(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    limit: int = 50
):
    statement = select(AnalyticsEvent).where(
        AnalyticsEvent.user_id == current_user.id
    ).order_by(AnalyticsEvent.created_at.desc()).limit(limit)
    
    events = session.exec(statement).all()
    
    return [
        AnalyticsEventResponse(
            id=str(event.id),
            event_type=event.event_type,
            event_metadata=event.event_metadata,
            created_at=event.created_at
        )
        for event in events
    ]


@router.post("", status_code=201)
def create_analytics_event_endpoint(
    event_data: AnalyticsEventCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    event = create_analytics_event(
        session,
        current_user.id,
        event_data.event_type,
        event_data.metadata
    )
    return {"ok": True, "event_id": str(event.id)}

