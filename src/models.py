from sqlmodel import SQLModel, Field, Relationship, JSON, Column
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from uuid import UUID, uuid4


class User(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    email: str = Field(unique=True, index=True)
    password_hash: str
    email_verified: bool = Field(default=False)
    verification_token: Optional[str] = Field(default=None, index=True)
    verification_token_expires_at: Optional[datetime] = None
    onboarding_completed: bool = Field(default=False)
    account_deletion_requested_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
    
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    uses_count: int = 0
    last_used_at: Optional[datetime] = None
    last_llm_used: Optional[str] = None
    
    user: User = Relationship(back_populates="context_versions")


class Feedback(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: Optional[UUID] = Field(default=None, foreign_key="user.id")
    type: str
    message: str
    email: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    user: Optional[User] = Relationship(back_populates="feedback")


class AnalyticsEvent(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: Optional[UUID] = Field(default=None, foreign_key="user.id")
    event_type: str = Field(index=True)
    event_metadata: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
    
    user: Optional[User] = Relationship(back_populates="analytics_events")


class PasswordResetToken(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    token: str = Field(unique=True, index=True)
    user_id: UUID = Field(foreign_key="user.id")
    expires_at: datetime
    used_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UpgradeInterest(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="user.id")
    email: str
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Admin(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    username: str = Field(unique=True, index=True)
    password_hash: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class InstallEvent(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: Optional[UUID] = Field(default=None, foreign_key="user.id")
    status: str  # 'started', 'completed', 'failed'
    event_metadata: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)


class OnboardingEvent(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="user.id")
    event_type: str  # 'started', 'step_1_completed', 'step_2_completed', 'step_3_completed', 'completed', 'skipped'
    step_number: Optional[int] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)

