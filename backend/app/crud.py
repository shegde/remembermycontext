from sqlmodel import Session, select
from app.models import User, ContextVersion, Feedback
from app.services.auth_service import get_password_hash, verify_password
from app.services.crypto_service import crypto_service
from typing import List, Optional
from uuid import UUID

def create_user(session: Session, email: str, password: str) -> User:
    password_hash = get_password_hash(password)
    user = User(email=email, password_hash=password_hash)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user

def get_user_by_email(session: Session, email: str) -> Optional[User]:
    statement = select(User).where(User.email == email)
    return session.exec(statement).first()

def authenticate_user(session: Session, email: str, password: str) -> Optional[User]:
    user = get_user_by_email(session, email)
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user

def create_context_version(session: Session, user_id: UUID, box_name: str, text: str) -> ContextVersion:
    latest_version = get_latest_version_number(session, user_id, box_name)
    version_number = latest_version + 1
    
    ciphertext = crypto_service.encrypt(text)
    
    context_version = ContextVersion(
        user_id=user_id,
        box_name=box_name,
        version_number=version_number,
        ciphertext=ciphertext
    )
    session.add(context_version)
    session.commit()
    session.refresh(context_version)
    return context_version

def get_latest_version_number(session: Session, user_id: UUID, box_name: str) -> int:
    statement = select(ContextVersion).where(
        ContextVersion.user_id == user_id,
        ContextVersion.box_name == box_name
    ).order_by(ContextVersion.version_number.desc())
    latest = session.exec(statement).first()
    return latest.version_number if latest else -1

def get_context_versions(session: Session, user_id: UUID, box_name: str) -> List[ContextVersion]:
    statement = select(ContextVersion).where(
        ContextVersion.user_id == user_id,
        ContextVersion.box_name == box_name
    ).order_by(ContextVersion.version_number.desc())
    return session.exec(statement).all()

def get_context_version(session: Session, user_id: UUID, box_name: str, version_number: int) -> Optional[ContextVersion]:
    statement = select(ContextVersion).where(
        ContextVersion.user_id == user_id,
        ContextVersion.box_name == box_name,
        ContextVersion.version_number == version_number
    )
    return session.exec(statement).first()

def mark_version_used(session: Session, user_id: UUID, box_name: str, version_number: int, site: str):
    version = get_context_version(session, user_id, box_name, version_number)
    if version:
        version.uses_count += 1
        from datetime import datetime
        version.last_used_at = datetime.utcnow()
        session.add(version)
        session.commit()

def get_user_contexts_summary(session: Session, user_id: UUID) -> List[dict]:
    statement = select(ContextVersion).where(ContextVersion.user_id == user_id)
    versions = session.exec(statement).all()
    
    boxes = {}
    for version in versions:
        if version.box_name not in boxes:
            boxes[version.box_name] = {
                "box_name": version.box_name,
                "latest_version_number": 0,
                "versions_count": 0,
                "last_used_at": None,
                "total_uses": 0
            }
        
        if version.version_number > boxes[version.box_name]["latest_version_number"]:
            boxes[version.box_name]["latest_version_number"] = version.version_number
        
        boxes[version.box_name]["versions_count"] += 1
        boxes[version.box_name]["total_uses"] += version.uses_count
        
        if version.last_used_at and (not boxes[version.box_name]["last_used_at"] or 
                                   version.last_used_at > boxes[version.box_name]["last_used_at"]):
            boxes[version.box_name]["last_used_at"] = version.last_used_at
    
    return list(boxes.values())

def create_feedback(session: Session, feedback_type: str, message: str, email: Optional[str] = None, user_id: Optional[UUID] = None) -> Feedback:
    feedback = Feedback(
        user_id=user_id,
        type=feedback_type,
        message=message,
        email=email
    )
    session.add(feedback)
    session.commit()
    session.refresh(feedback)
    return feedback
