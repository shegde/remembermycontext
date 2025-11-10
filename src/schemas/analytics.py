from pydantic import BaseModel, Field
from typing import Dict, Any
from datetime import datetime


class AnalyticsEventCreate(BaseModel):
    event_type: str = Field(min_length=1, max_length=100)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AnalyticsEventResponse(BaseModel):
    id: str
    event_type: str
    event_metadata: Dict[str, Any]
    created_at: datetime

