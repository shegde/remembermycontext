from pathlib import Path
import resend
from ..config import settings
from ..logging_config import logger

resend.api_key = settings.RESEND_API_KEY

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"


def load_email_template(template_name: str) -> str:
    template_path = TEMPLATES_DIR / template_name
    if template_path.exists():
        return template_path.read_text(encoding="utf-8")
    logger.warning(f"Email template not found: {template_name}")
    return ""


class EmailService:
    @staticmethod
    def send_verification_email(email: str, verification_token: str) -> bool:
        if not settings.RESEND_API_KEY:
            logger.warning("RESEND_API_KEY not set, skipping email send")
            return False
        
        if not settings.EMAIL_VERIFICATION_REQUIRED:
            return True
        
        try:
            verification_url = f"{settings.FRONTEND_URL}/verify-email?token={verification_token}"
            
            template = load_email_template("email_verification.html")
            if not template:
                logger.error("Failed to load email verification template")
                return False
            
            html_content = template.replace("{{VERIFICATION_URL}}", verification_url)
            html_content = html_content.replace("{{EXPIRY_HOURS}}", str(settings.EMAIL_VERIFICATION_EXPIRY_HOURS))
            
            from_email = settings.FROM_EMAIL
            
            params = {
                "from": from_email,
                "to": [email],
                "subject": "Verify Your Email - RememberMyContext",
                "html": html_content,
            }
            
            email_response = resend.Emails.send(params)
            logger.info(f"Verification email sent to {email}: {email_response}")
            return True
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Failed to send verification email to {email}: {error_msg}")
            return False
    
    @staticmethod
    def send_password_reset_email(email: str, reset_token: str) -> bool:
        if not settings.RESEND_API_KEY:
            logger.warning("RESEND_API_KEY not set, skipping email send")
            return False
        
        if not settings.ENABLE_PASSWORD_RESET:
            return True
        
        try:
            reset_url = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"
            
            template = load_email_template("email_password_reset.html")
            if not template:
                logger.error("Failed to load password reset email template")
                return False
            
            html_content = template.replace("{{RESET_URL}}", reset_url)
            html_content = html_content.replace("{{EXPIRY_HOURS}}", str(settings.PASSWORD_RESET_EXPIRY_HOURS))
            
            from_email = settings.FROM_EMAIL
            
            params = {
                "from": from_email,
                "to": [email],
                "subject": "Reset Your Password - RememberMyContext",
                "html": html_content,
            }
            
            email_response = resend.Emails.send(params)
            logger.info(f"Password reset email sent to {email}: {email_response}")
            return True
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Failed to send password reset email to {email}: {error_msg}")
            return False


email_service = EmailService()

