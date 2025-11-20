from sqlmodel import Session, select
from uuid import UUID
from typing import Optional

from ..models import Admin
from ..logging_config import logger
from ..services.auth import get_password_hash, verify_password


def create_admin(session: Session, username: str, password: str) -> Admin:
    try:
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
    except Exception as e:
        session.rollback()
        logger.error(f"Failed to create admin {username}: {str(e)}")
        raise


def get_admin_by_username(session: Session, username: str) -> Optional[Admin]:
    statement = select(Admin).where(Admin.username == username)
    return session.exec(statement).first()


def authenticate_admin(session: Session, username: str, password: str) -> Optional[Admin]:
    admin = get_admin_by_username(session, username)
    if not admin:
        return None
    if not verify_password(password, admin.password_hash):
        return None
    return admin


def ensure_admin_exists(session: Session, username: str, password: str) -> None:
    admin = get_admin_by_username(session, username)
    if not admin:
        create_admin(session, username, password)
        logger.info(f"Admin user '{username}' created")
    else:
        logger.info(f"Admin user '{username}' already exists")

