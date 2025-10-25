import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./dev.db")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "change_this_locally")
    FERNET_KEY: str = os.getenv("FERNET_KEY", "")
    API_PREFIX: str = os.getenv("API_PREFIX", "/api/v1")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

settings = Settings()
