from sqlmodel import Session, select
from typing import Optional
from uuid import UUID
from datetime import datetime, timezone, timedelta
import secrets

from ..models import User, PasswordResetToken
from ..services.auth import get_password_hash, verify_password
from ..services.email import email_service
from ..config import settings
from ..logging_config import logger


def create_user(session: Session, email: str, password: str) -> User:
    try:
        password_hash = get_password_hash(password)
        
        verification_token = secrets.token_urlsafe(32)
        verification_expires = datetime.now(timezone.utc) + timedelta(
            hours=settings.EMAIL_VERIFICATION_EXPIRY_HOURS
        )
        
        user = User(
            email=email,
            password_hash=password_hash,
            email_verified=not settings.EMAIL_VERIFICATION_REQUIRED,
            verification_token=verification_token if settings.EMAIL_VERIFICATION_REQUIRED else None,
            verification_token_expires_at=verification_expires if settings.EMAIL_VERIFICATION_REQUIRED else None
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        logger.info(f"User created: {email} (email_verified={user.email_verified})")
        
        if settings.EMAIL_VERIFICATION_REQUIRED and user.verification_token:
            email_service.send_verification_email(email, user.verification_token)
        
        return user
    except Exception as e:
        session.rollback()
        logger.error(f"Failed to create user: {str(e)}")
        raise


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
    if settings.EMAIL_VERIFICATION_REQUIRED and not user.email_verified:
        logger.warning(f"Authentication failed: Email not verified - {email}")
        return None
    logger.info(f"User authenticated: {email}")
    return user


def verify_email_token(session: Session, token: str) -> Optional[User]:
    statement = select(User).where(User.verification_token == token)
    user = session.exec(statement).first()
    
    if not user:
        return None
    
    if user.verification_token_expires_at and user.verification_token_expires_at < datetime.now(timezone.utc):
        logger.warning(f"Email verification failed: Token expired for {user.email}")
        return None
    
    user.email_verified = True
    user.verification_token = None
    user.verification_token_expires_at = None
    session.add(user)
    session.commit()
    logger.info(f"Email verified for user: {user.email}")
    return user


def create_password_reset_token(session: Session, user_id: UUID) -> PasswordResetToken:
    token_string = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.PASSWORD_RESET_EXPIRY_HOURS)
    
    reset_token = PasswordResetToken(
        token=token_string,
        user_id=user_id,
        expires_at=expires_at
    )
    session.add(reset_token)
    session.commit()
    session.refresh(reset_token)
    logger.info(f"Password reset token created for user: {user_id}")
    return reset_token


def verify_reset_token(session: Session, token: str) -> Optional[PasswordResetToken]:
    statement = select(PasswordResetToken).where(
        PasswordResetToken.token == token,
        PasswordResetToken.used_at.is_(None)
    )
    reset_token = session.exec(statement).first()
    
    if not reset_token:
        return None
    
    if reset_token.expires_at < datetime.now(timezone.utc):
        logger.warning(f"Password reset failed: Token expired")
        return None
    
    return reset_token


def reset_user_password(session: Session, reset_token: PasswordResetToken, new_password: str) -> User:
    statement = select(User).where(User.id == reset_token.user_id)
    user = session.exec(statement).first()
    
    if not user:
        raise ValueError("User not found")
    
    user.password_hash = get_password_hash(new_password)
    reset_token.used_at = datetime.now(timezone.utc)
    
    session.add(user)
    session.add(reset_token)
    session.commit()
    logger.info(f"Password reset for user: {user.email}")
    return user


def request_account_deletion(session: Session, user_id: UUID) -> User:
    statement = select(User).where(User.id == user_id)
    user = session.exec(statement).first()
    
    if not user:
        raise ValueError("User not found")
    
    user.account_deletion_requested_at = datetime.now(timezone.utc)
    session.add(user)
    session.commit()
    logger.info(f"Account deletion requested for user: {user.email}")
    return user


def cancel_account_deletion(session: Session, user_id: UUID) -> User:
    statement = select(User).where(User.id == user_id)
    user = session.exec(statement).first()
    
    if not user:
        raise ValueError("User not found")
    
    user.account_deletion_requested_at = None
    session.add(user)
    session.commit()
    logger.info(f"Account deletion cancelled for user: {user.email}")
    return user


def generate_new_verification_token(session: Session, email: str) -> Optional[User]:
    user = get_user_by_email(session, email)
    if not user:
        return None
    
    if user.email_verified:
        return user
    
    verification_token = secrets.token_urlsafe(32)
    verification_expires = datetime.now(timezone.utc) + timedelta(
        hours=settings.EMAIL_VERIFICATION_EXPIRY_HOURS
    )
    
    user.verification_token = verification_token
    user.verification_token_expires_at = verification_expires
    session.add(user)
    session.commit()
    logger.info(f"New verification token generated for {user.email}")
    return user

