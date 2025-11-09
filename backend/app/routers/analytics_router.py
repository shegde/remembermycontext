from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime
from app.database import get_session
from app.services.analytics_service import create_analytics_event
from app.services.auth_service import get_current_user
from app.models import User, AnalyticsEvent

router = APIRouter(prefix="/analytics", tags=["analytics"])

class AnalyticsEventCreate(BaseModel):
    event_type: str
    metadata: Dict[str, Any]

class AnalyticsEventResponse(BaseModel):
    id: str
    event_type: str
    event_metadata: Dict[str, Any]
    created_at: datetime

@router.get("", response_model=List[AnalyticsEventResponse])
def get_analytics_events(
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

@router.post("")
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
    return {"ok": True}
