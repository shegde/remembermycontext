from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlmodel import Session, select

from ..database import get_session
from ..crud import create_user, authenticate_user
from ..services import create_access_token
from ..models import User
from ..schemas import UserRegister, UserLogin, TokenResponse
from ..constants import ErrorCode
from ..logging_config import logger
from ..middleware import limiter

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(request: Request, user_data: UserRegister, session: Session = Depends(get_session)):
    statement = select(User).where(User.email == user_data.email)
    existing_user = session.exec(statement).first()
    if existing_user:
        logger.warning(f"Registration attempt with existing email: {user_data.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Email already registered",
                "error_code": ErrorCode.EMAIL_ALREADY_EXISTS
            }
        )
    
    user = create_user(session, user_data.email, user_data.password)
    return {"ok": True, "user_id": str(user.id)}


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, user_data: UserLogin, session: Session = Depends(get_session)):
    user = authenticate_user(session, user_data.email, user_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "message": "Incorrect email or password",
                "error_code": ErrorCode.INVALID_CREDENTIALS
            }
        )
    
    access_token = create_access_token(data={"sub": str(user.id)})
    logger.info(f"User logged in: {user_data.email}")
    return {"access_token": access_token, "token_type": "bearer"}

