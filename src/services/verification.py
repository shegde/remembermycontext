from pathlib import Path
from fastapi.responses import HTMLResponse
from sqlmodel import Session, select
from ..crud.user import verify_email_token, verify_reset_token
from ..models import User
from ..logging_config import logger

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"


def load_template(template_name: str) -> str:
    template_path = TEMPLATES_DIR / template_name
    if template_path.exists():
        return template_path.read_text(encoding="utf-8")
    logger.warning(f"Template not found: {template_name}")
    return ""


def handle_email_verification(token: str, session: Session) -> HTMLResponse:
    try:
        user = verify_email_token(session, token)
        
        if not user:
            logger.warning(f"Email verification failed: Invalid or expired token")
            template = load_template("verification_failed.html")
            if not template:
                return HTMLResponse(
                    content="<h1>Verification Failed</h1><p>Invalid or expired token.</p>",
                    status_code=400
                )
            return HTMLResponse(content=template, status_code=400)
        
        logger.info(f"Email verification successful for user: {user.email}")
        template = load_template("verification_success.html")
        if not template:
            return HTMLResponse(
                content="<h1>Email Verified!</h1><p>Your email has been verified successfully.</p>",
                status_code=200
            )
        return HTMLResponse(content=template, status_code=200)
    except Exception as e:
        logger.error(f"Error during email verification: {str(e)}", exc_info=True)
        template = load_template("verification_failed.html")
        if not template:
            return HTMLResponse(
                content="<h1>Verification Error</h1><p>An error occurred during verification.</p>",
                status_code=500
            )
        return HTMLResponse(content=template, status_code=500)


def handle_password_reset_page(token: str, session: Session) -> HTMLResponse:
    try:
        reset_token = verify_reset_token(session, token)
        
        if not reset_token:
            logger.warning(f"Password reset page access failed: Invalid or expired token")
            template = load_template("reset_password_invalid.html")
            if not template:
                return HTMLResponse(
                    content="<h1>Reset Link Invalid</h1><p>Invalid or expired reset token.</p>",
                    status_code=400
                )
            return HTMLResponse(content=template, status_code=400)
        
        statement = select(User).where(User.id == reset_token.user_id)
        user = session.exec(statement).first()
        
        if not user:
            logger.error(f"User not found for reset token: {reset_token.user_id}")
            template = load_template("reset_password_invalid.html")
            if not template:
                return HTMLResponse(
                    content="<h1>Reset Error</h1><p>User account not found.</p>",
                    status_code=400
                )
            return HTMLResponse(content=template, status_code=400)
        
        template = load_template("reset_password.html")
        if not template:
            return HTMLResponse(
                content="<h1>Reset Password</h1><p>Please use the API to reset your password.</p>",
                status_code=200
            )
        
        template = template.replace('{{USER_EMAIL}}', user.email)
        return HTMLResponse(content=template, status_code=200)
    except Exception as e:
        logger.error(f"Error loading password reset page: {str(e)}", exc_info=True)
        template = load_template("reset_password_invalid.html")
        if not template:
            return HTMLResponse(
                content="<h1>Reset Error</h1><p>An error occurred loading the reset page.</p>",
                status_code=500
            )
        return HTMLResponse(content=template, status_code=500)

