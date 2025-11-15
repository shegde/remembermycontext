from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from ..database import get_session
from ..crud import create_upgrade_interest, get_upgrade_interest
from ..services import get_current_user
from ..models import User
from ..schemas import UpgradeInterestCreate, UpgradeInterestResponse
from ..logging_config import logger

router = APIRouter(prefix="/upgrade", tags=["upgrade"])


@router.post("/express-interest", response_model=UpgradeInterestResponse, status_code=status.HTTP_201_CREATED)
def express_interest(
    interest_data: UpgradeInterestCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    create_upgrade_interest(
        session,
        current_user.id,
        current_user.email,
        interest_data.notes
    )
    logger.info(f"Upgrade interest expressed by user: {current_user.email}")
    return {
        "ok": True,
        "message": "Thank you for your interest! We'll notify you when Pro features are available."
    }


@router.get("/check-interest", status_code=status.HTTP_200_OK)
def check_interest(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    interest = get_upgrade_interest(session, current_user.id)
    if interest:
        return {
            "interested": True,
            "created_at": interest.created_at,
            "notes": interest.notes
        }
    return {"interested": False}

