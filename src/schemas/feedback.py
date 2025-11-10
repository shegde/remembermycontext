from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from ..constants import FeedbackType


class FeedbackCreate(BaseModel):
    type: FeedbackType
    message: str = Field(min_length=1, max_length=5000)
    email: Optional[EmailStr] = None

