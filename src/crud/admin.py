from sqlmodel import Session, select
from uuid import UUID
from typing import Optional

from ..models import Admin
from ..logging_config import logger
from ..services.auth import get_password_hash, verify_password


def create_admin(session: Session, username: str, password: str) -> Admin:
    """Create a new admin user"""
    password_hash = get_password_hash(password)
    
    admin = Admin(
        username=username,
        password_hash=password_hash
    )
    
    session.add(admin)
    session.commit()
    session.refresh(admin)
    logger.info(f"Admin created: {username}")
    return admin


def get_admin_by_username(session: Session, username: str) -> Optional[Admin]:
    """Get admin by username"""
    statement = select(Admin).where(Admin.username == username)
    return session.exec(statement).first()


def authenticate_admin(session: Session, username: str, password: str) -> Optional[Admin]:
    """Authenticate admin user"""
    admin = get_admin_by_username(session, username)
    if not admin:
        return None
    if not verify_password(password, admin.password_hash):
        return None
    return admin


def ensure_admin_exists(session: Session, username: str, password: str) -> None:
    """Ensure admin user exists (for initialization)"""
    admin = get_admin_by_username(session, username)
    if not admin:
        create_admin(session, username, password)
        logger.info(f"Admin user '{username}' created")
    else:
        logger.info(f"Admin user '{username}' already exists")

