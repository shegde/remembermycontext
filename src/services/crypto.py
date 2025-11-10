from cryptography.fernet import Fernet
import base64
from typing import Optional

from ..config import settings
from ..logging_config import logger


class CryptoService:
    def __init__(self, fernet_key: Optional[str] = None):
        key = fernet_key or settings.FERNET_KEY
        if not key:
            raise ValueError("FERNET_KEY environment variable is required")
        try:
            self.fernet = Fernet(key.encode())
        except Exception as e:
            logger.error(f"Failed to initialize crypto service: {str(e)}")
            raise ValueError(f"Invalid FERNET_KEY: {str(e)}")
    
    def encrypt(self, plaintext: str) -> str:
        if not plaintext:
            raise ValueError("Cannot encrypt empty plaintext")
        encrypted_data = self.fernet.encrypt(plaintext.encode())
        return base64.b64encode(encrypted_data).decode()
    
    def decrypt(self, ciphertext: str) -> str:
        if not ciphertext:
            raise ValueError("Cannot decrypt empty ciphertext")
        try:
            encrypted_data = base64.b64decode(ciphertext.encode())
            return self.fernet.decrypt(encrypted_data).decode()
        except Exception as e:
            logger.error(f"Decryption failed: {str(e)}")
            raise ValueError(f"Decryption failed: {str(e)}")


try:
    crypto_service = CryptoService()
    logger.info("Crypto service initialized successfully")
except ValueError as e:
    logger.error(f"Failed to initialize crypto service: {str(e)}")
    crypto_service = None

