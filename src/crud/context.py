from sqlmodel import Session, select
from typing import List, Optional, Dict
from uuid import UUID
from datetime import datetime, timezone

from ..models import ContextVersion
from ..services.crypto import crypto_service
from ..logging_config import logger


def create_context_version(session: Session, user_id: UUID, box_name: str, text: str) -> ContextVersion:
    try:
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
        logger.info(f"Context version created: {box_name} v{version_number} for user {user_id}")
        return context_version
    except Exception as e:
        session.rollback()
        logger.error(f"Failed to create context version: {str(e)}")
        raise


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
    return list(session.exec(statement).all())


def get_context_version(
    session: Session,
    user_id: UUID,
    box_name: str,
    version_number: int
) -> Optional[ContextVersion]:
    statement = select(ContextVersion).where(
        ContextVersion.user_id == user_id,
        ContextVersion.box_name == box_name,
        ContextVersion.version_number == version_number
    )
    return session.exec(statement).first()


def mark_version_used(
    session: Session,
    user_id: UUID,
    box_name: str,
    version_number: int,
    site: str,
    llm_name: Optional[str] = None
):
    try:
        version = get_context_version(session, user_id, box_name, version_number)
        if version:
            version.uses_count += 1
            version.last_used_at = datetime.now(timezone.utc)
            if llm_name:
                version.last_llm_used = llm_name
            session.add(version)
            session.commit()
            logger.info(f"Context version marked as used: {box_name} v{version_number} on {site} (LLM: {llm_name or 'unknown'})")
    except Exception as e:
        session.rollback()
        logger.error(f"Failed to mark version as used: {str(e)}")
        raise


def get_user_contexts_summary(session: Session, user_id: UUID) -> List[Dict]:
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
        
        if version.last_used_at and (
            not boxes[version.box_name]["last_used_at"] or
            version.last_used_at > boxes[version.box_name]["last_used_at"]
        ):
            boxes[version.box_name]["last_used_at"] = version.last_used_at
    
    return list(boxes.values())

