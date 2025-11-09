from cryptography.fernet import Fernet
from app.config import settings
import base64

class CryptoService:
    def __init__(self):
        if not settings.FERNET_KEY:
            raise ValueError("FERNET_KEY environment variable is required")
        self.fernet = Fernet(settings.FERNET_KEY.encode())
    
    def encrypt(self, plaintext: str) -> str:
        encrypted_data = self.fernet.encrypt(plaintext.encode())
        return base64.b64encode(encrypted_data).decode()
    
    def decrypt(self, ciphertext: str) -> str:
        encrypted_data = base64.b64decode(ciphertext.encode())
        return self.fernet.decrypt(encrypted_data).decode()

crypto_service = CryptoService()
