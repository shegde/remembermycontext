from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from ..database import get_session
from ..crud import complete_onboarding, get_onboarding_status
from ..services import get_current_user
from ..models import User
from ..schemas import OnboardingStatusResponse, OnboardingCompleteResponse
from ..config import settings
from ..logging_config import logger

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


@router.post("/complete", response_model=OnboardingCompleteResponse, status_code=status.HTTP_200_OK)
def complete_onboarding_endpoint(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    if not settings.ENABLE_ONBOARDING:
        return {"ok": True}
    
    complete_onboarding(session, current_user.id)
    logger.info(f"Onboarding completed for user: {current_user.email}")
    return {"ok": True}


@router.get("/status", response_model=OnboardingStatusResponse, status_code=status.HTTP_200_OK)
def get_status(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    if not settings.ENABLE_ONBOARDING:
        return {"completed": True}
    
    completed = get_onboarding_status(session, current_user.id)
    return {"completed": completed}

