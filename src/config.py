import os
from typing import Optional
from dotenv import load_dotenv

load_dotenv()


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./dev.db")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "")
    FERNET_KEY: str = os.getenv("FERNET_KEY", "")
    API_PREFIX: str = os.getenv("API_PREFIX", "/api/v1")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))
    ECHO_SQL: bool = os.getenv("ECHO_SQL", "false").lower() == "true"
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))
    MAX_CONTEXT_LENGTH: int = int(os.getenv("MAX_CONTEXT_LENGTH", "50000"))
    ALLOWED_ORIGINS: str = os.getenv("ALLOWED_ORIGINS", "")
    
    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
    FROM_EMAIL: str = os.getenv("FROM_EMAIL", "noreply@remembermycontext.com")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:8000")
    
    EMAIL_VERIFICATION_REQUIRED: bool = os.getenv("EMAIL_VERIFICATION_REQUIRED", "false").lower() == "true"
    EMAIL_VERIFICATION_EXPIRY_HOURS: int = int(os.getenv("EMAIL_VERIFICATION_EXPIRY_HOURS", "24"))
    PASSWORD_RESET_EXPIRY_HOURS: int = int(os.getenv("PASSWORD_RESET_EXPIRY_HOURS", "1"))
    ACCOUNT_DELETION_GRACE_DAYS: int = int(os.getenv("ACCOUNT_DELETION_GRACE_DAYS", "7"))
    
    ENABLE_ONBOARDING: bool = os.getenv("ENABLE_ONBOARDING", "true").lower() == "true"
    ENABLE_PASSWORD_RESET: bool = os.getenv("ENABLE_PASSWORD_RESET", "true").lower() == "true"
    CALENDLY_LINK: str = os.getenv("CALENDLY_LINK", "")
    
    ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "admin")
    
    def validate(self) -> None:
        errors = []
        
        if not self.JWT_SECRET or self.JWT_SECRET == "change_this_locally":
            errors.append("JWT_SECRET must be set to a secure random string")
        
        if not self.FERNET_KEY:
            errors.append("FERNET_KEY must be set")
        
        if errors:
            raise ValueError("Configuration errors:\n" + "\n".join(f"  - {error}" for error in errors))


settings = Settings()

