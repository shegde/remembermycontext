from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from pydantic import BaseModel, EmailStr
from app.database import get_session
from app.crud import create_user, authenticate_user
from app.services.auth_service import create_access_token, get_current_user
from app.models import User

router = APIRouter(prefix="/auth", tags=["auth"])

class UserRegister(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

@router.post("/register")
def register(user_data: UserRegister, session: Session = Depends(get_session)):
    statement = select(User).where(User.email == user_data.email)
    existing_user = session.exec(statement).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    user = create_user(session, user_data.email, user_data.password)
    return {"ok": True}

@router.post("/login", response_model=TokenResponse)
def login(user_data: UserLogin, session: Session = Depends(get_session)):
    user = authenticate_user(session, user_data.email, user_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}
