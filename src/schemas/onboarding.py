from pydantic import BaseModel


class OnboardingStatusResponse(BaseModel):
    completed: bool


class OnboardingCompleteResponse(BaseModel):
    ok: bool

