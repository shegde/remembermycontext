from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
from ..constants import ContextBox
from ..config import settings


class ContextCreate(BaseModel):
    text: str = Field(min_length=1, max_length=settings.MAX_CONTEXT_LENGTH)
    
    @field_validator("text")
    @classmethod
    def validate_text(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Text cannot be empty or whitespace only")
        return v


class ContextVersionResponse(BaseModel):
    version_number: int
    created_at: datetime


class ContextBoxSummary(BaseModel):
    box_name: str
    latest_version_number: int
    versions_count: int
    last_used_at: Optional[datetime]
    total_uses: int


class MarkUsedRequest(BaseModel):
    site: str = Field(min_length=1, max_length=255)
    llm_name: Optional[str] = Field(default=None, max_length=100)


class DecryptRequest(BaseModel):
    ciphertext: str = Field(min_length=1)

