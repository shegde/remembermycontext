from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlmodel import Session, select

from ..database import get_session
from ..crud import (
    create_user,
    authenticate_user,
    verify_email_token,
    create_password_reset_token,
    verify_reset_token,
    reset_user_password,
    change_user_password,
    request_account_deletion,
    cancel_account_deletion,
    get_user_by_email,
    generate_new_verification_token
)
from ..services import create_access_token, get_current_user
from ..services.auth import verify_password
from ..services.email import email_service
from ..models import User
from ..schemas import (
    UserRegister,
    UserLogin,
    TokenResponse,
    EmailVerificationRequest,
    VerifyEmailRequest,
    PasswordResetRequest,
    PasswordResetConfirm,
    ChangePasswordRequest
)
from ..constants import ErrorCode
from ..config import settings
from ..logging_config import logger
from ..middleware import limiter

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
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
    
    if settings.EMAIL_VERIFICATION_REQUIRED and not user.email_verified:
        return {
            "ok": True,
            "user_id": str(user.id),
            "message": "Account created! Please check your email to verify your account before logging in.",
            "email_verification_required": True
        }
    
    return {"ok": True, "user_id": str(user.id), "email_verification_required": False}


@router.post("/login", response_model=TokenResponse)
@limiter.limit("60/minute")
def login(request: Request, user_data: UserLogin, session: Session = Depends(get_session)):
    user = get_user_by_email(session, user_data.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "message": "Incorrect email or password",
                "error_code": ErrorCode.INVALID_CREDENTIALS
            }
        )
    
    if not verify_password(user_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "message": "Incorrect email or password",
                "error_code": ErrorCode.INVALID_CREDENTIALS
            }
        )
    
    if settings.EMAIL_VERIFICATION_REQUIRED and not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "message": "Please verify your email before logging in",
                "error_code": ErrorCode.EMAIL_NOT_VERIFIED
            }
        )
    
    access_token = create_access_token(data={"sub": str(user.id)})
    logger.info(f"User logged in: {user_data.email}")
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/verify-email", status_code=status.HTTP_200_OK)
def verify_email(verify_request: VerifyEmailRequest, session: Session = Depends(get_session)):
    user = verify_email_token(session, verify_request.token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Invalid or expired verification token",
                "error_code": ErrorCode.INVALID_TOKEN
            }
        )
    return {"ok": True, "message": "Email verified successfully"}


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
@limiter.limit("3/hour")
def forgot_password(
    request: Request,
    reset_request: PasswordResetRequest,
    session: Session = Depends(get_session)
):
    if not settings.ENABLE_PASSWORD_RESET:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail={
                "message": "Password reset is not available",
                "error_code": ErrorCode.FEATURE_DISABLED
            }
        )
    
    user = get_user_by_email(session, reset_request.email)
    if user:
        reset_token = create_password_reset_token(session, user.id)
        email_service.send_password_reset_email(user.email, reset_token.token)
        logger.info(f"Password reset token created for {user.email}")
    
    return {
        "ok": True,
        "message": "If an account exists with that email, a password reset link has been sent"
    }


@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(
    reset_data: PasswordResetConfirm,
    session: Session = Depends(get_session)
):
    if not settings.ENABLE_PASSWORD_RESET:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail={
                "message": "Password reset is not available",
                "error_code": ErrorCode.FEATURE_DISABLED
            }
        )
    
    reset_token = verify_reset_token(session, reset_data.token)
    if not reset_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Invalid or expired reset token",
                "error_code": ErrorCode.INVALID_TOKEN
            }
        )
    
    reset_user_password(session, reset_token, reset_data.new_password)
    return {"ok": True, "message": "Password reset successfully"}


@router.post("/change-password", status_code=status.HTTP_200_OK)
def change_password(
    password_data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    try:
        change_user_password(session, current_user, password_data.current_password, password_data.new_password)
        return {"ok": True, "message": "Password changed successfully"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": str(e),
                "error_code": ErrorCode.INVALID_CREDENTIALS
            }
        )


@router.delete("/request-deletion", status_code=status.HTTP_200_OK)
def request_deletion(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    request_account_deletion(session, current_user.id)
    return {
        "ok": True,
        "message": f"Account deletion requested. You have {settings.ACCOUNT_DELETION_GRACE_DAYS} days to cancel"
    }


@router.delete("/cancel-deletion", status_code=status.HTTP_200_OK)
def cancel_deletion(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    cancel_account_deletion(session, current_user.id)
    return {"ok": True, "message": "Account deletion cancelled"}


@router.post("/resend-verification", status_code=status.HTTP_200_OK)
@limiter.limit("5/hour")
def resend_verification(
    request: Request,
    verification_request: EmailVerificationRequest,
    session: Session = Depends(get_session)
):
    user = generate_new_verification_token(session, verification_request.email)
    if not user:
        return {
            "ok": True,
            "message": "If an account exists with that email, a verification link has been sent"
        }
    
    if user.email_verified:
        return {
            "ok": True,
            "message": "Email is already verified"
        }
    
    if user.verification_token:
        email_service.send_verification_email(user.email, user.verification_token)
        logger.info(f"Verification email resent to {user.email}")
    
    return {
        "ok": True,
        "message": "If an account exists with that email, a verification link has been sent"
    }


@router.get("/check-deletion", status_code=status.HTTP_200_OK)
def check_deletion_status(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    deletion_requested = current_user.account_deletion_requested_at is not None
    return {
        "deletion_requested": deletion_requested,
        "deletion_requested_at": current_user.account_deletion_requested_at.isoformat() if deletion_requested else None
    }

