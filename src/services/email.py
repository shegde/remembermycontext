import os
import resend
from ..config import settings
from ..logging_config import logger

resend.api_key = settings.RESEND_API_KEY


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
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h1 style="color: #007bff; margin: 0;">Verify Your Email</h1>
                </div>
                <p>Thank you for signing up for RememberMyContext!</p>
                <p>Please click the button below to verify your email address:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{verification_url}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Verify Email</a>
                </div>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #666; font-size: 12px;">{verification_url}</p>
                <p style="color: #666; font-size: 12px; margin-top: 30px;">This link will expire in {settings.EMAIL_VERIFICATION_EXPIRY_HOURS} hours.</p>
                <p style="color: #666; font-size: 12px;">If you didn't create an account, please ignore this email.</p>
            </body>
            </html>
            """
            
            # Use Resend's default domain if custom domain not verified
            # Resend allows onboarding@resend.dev for testing without domain verification
            from_email = settings.FROM_EMAIL
            if "remembermycontext.com" in from_email.lower():
                # Check if we should use Resend's default domain for testing
                # You can set USE_RESEND_DEFAULT_DOMAIN=true in .env to use onboarding@resend.dev
                use_default = os.getenv("USE_RESEND_DEFAULT_DOMAIN", "false").lower() == "true"
                if use_default:
                    from_email = "onboarding@resend.dev"
                    logger.info(f"Using Resend default domain for testing: {from_email}")
            
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
            
            # If domain not verified, suggest using Resend default domain
            if "domain is not verified" in error_msg.lower():
                logger.warning("Domain not verified in Resend. Set USE_RESEND_DEFAULT_DOMAIN=true in .env to use onboarding@resend.dev for testing")
            
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
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h1 style="color: #dc3545; margin: 0;">Reset Your Password</h1>
                </div>
                <p>You requested to reset your password for RememberMyContext.</p>
                <p>Click the button below to reset your password:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{reset_url}" style="background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Reset Password</a>
                </div>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #666; font-size: 12px;">{reset_url}</p>
                <p style="color: #666; font-size: 12px; margin-top: 30px;">This link will expire in {settings.PASSWORD_RESET_EXPIRY_HOURS} hour(s).</p>
                <p style="color: #666; font-size: 12px;">If you didn't request a password reset, please ignore this email.</p>
            </body>
            </html>
            """
            
            # Use Resend's default domain if custom domain not verified
            from_email = settings.FROM_EMAIL
            if "remembermycontext.com" in from_email.lower():
                use_default = os.getenv("USE_RESEND_DEFAULT_DOMAIN", "false").lower() == "true"
                if use_default:
                    from_email = "onboarding@resend.dev"
                    logger.info(f"Using Resend default domain for testing: {from_email}")
            
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
            
            # If domain not verified, suggest using Resend default domain
            if "domain is not verified" in error_msg.lower():
                logger.warning("Domain not verified in Resend. Set USE_RESEND_DEFAULT_DOMAIN=true in .env to use onboarding@resend.dev for testing")
            
            return False


email_service = EmailService()

