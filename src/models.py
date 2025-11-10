from sqlmodel import SQLModel, Field, Relationship, JSON, Column
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID, uuid4


class User(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    email: str = Field(unique=True, index=True)
    password_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    context_versions: List["ContextVersion"] = Relationship(back_populates="user")
    feedback: List["Feedback"] = Relationship(back_populates="user")
    analytics_events: List["AnalyticsEvent"] = Relationship(back_populates="user")


class ContextVersion(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="user.id")
    box_name: str
    version_number: int
    ciphertext: str
    iv: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    uses_count: int = 0
    last_used_at: Optional[datetime] = None
    
    user: User = Relationship(back_populates="context_versions")


class Feedback(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: Optional[UUID] = Field(default=None, foreign_key="user.id")
    type: str
    message: str
    email: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    user: Optional[User] = Relationship(back_populates="feedback")


class AnalyticsEvent(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: Optional[UUID] = Field(default=None, foreign_key="user.id")
    event_type: str
    event_metadata: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    user: Optional[User] = Relationship(back_populates="analytics_events")

