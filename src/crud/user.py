from sqlmodel import Session, select
from typing import Optional

from ..models import User
from ..services.auth import get_password_hash, verify_password
from ..logging_config import logger


def create_user(session: Session, email: str, password: str) -> User:
    password_hash = get_password_hash(password)
    user = User(email=email, password_hash=password_hash)
    session.add(user)
    session.commit()
    session.refresh(user)
    logger.info(f"User created: {email}")
    return user


def get_user_by_email(session: Session, email: str) -> Optional[User]:
    statement = select(User).where(User.email == email)
    return session.exec(statement).first()


def authenticate_user(session: Session, email: str, password: str) -> Optional[User]:
    user = get_user_by_email(session, email)
    if not user:
        logger.warning(f"Authentication failed: User not found - {email}")
        return None
    if not verify_password(password, user.password_hash):
        logger.warning(f"Authentication failed: Invalid password - {email}")
        return None
    logger.info(f"User authenticated: {email}")
    return user

