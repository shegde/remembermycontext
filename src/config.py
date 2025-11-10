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
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    ECHO_SQL: bool = os.getenv("ECHO_SQL", "false").lower() == "true"
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))
    MAX_CONTEXT_LENGTH: int = int(os.getenv("MAX_CONTEXT_LENGTH", "50000"))
    
    def validate(self) -> None:
        errors = []
        
        if not self.JWT_SECRET or self.JWT_SECRET == "change_this_locally":
            errors.append("JWT_SECRET must be set to a secure random string")
        
        if not self.FERNET_KEY:
            errors.append("FERNET_KEY must be set")
        
        if errors:
            raise ValueError("Configuration errors:\n" + "\n".join(f"  - {error}" for error in errors))


settings = Settings()

