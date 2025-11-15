from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class UpgradeInterestCreate(BaseModel):
    notes: Optional[str] = Field(default=None, max_length=500)


class UpgradeInterestResponse(BaseModel):
    ok: bool
    message: str

