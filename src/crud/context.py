from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from uuid import UUID

from sqlalchemy import or_
from sqlmodel import Session, select

from ..logging_config import logger
from ..models import ContextVersion
from ..services.crypto import crypto_service


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
            if llm_name and llm_name.strip():
                normalized_llm = llm_name.strip().lower().replace('www.', '')
                version.last_llm_used = normalized_llm
            session.add(version)
            session.commit()
            session.refresh(version)
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


def preview_unused_versions(session: Session, days_threshold: int) -> List[Dict]:
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_threshold)

    statement = select(ContextVersion).where(
        or_(
            (ContextVersion.last_used_at.is_(None)) & (ContextVersion.created_at < cutoff_date),
            (ContextVersion.last_used_at.isnot(None)) & (ContextVersion.last_used_at < cutoff_date)
        )
    )

    versions_to_delete = list(session.exec(statement).all())
    now = datetime.now(timezone.utc)
    preview = []

    for version in versions_to_delete:
        created_at = version.created_at
        last_used_at = version.last_used_at

        if created_at and created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        if last_used_at and last_used_at.tzinfo is None:
            last_used_at = last_used_at.replace(tzinfo=timezone.utc)

        days_since_created = (now - created_at).days if created_at else None
        days_since_last_used = (now - last_used_at).days if last_used_at else None

        if last_used_at is None:
            deletion_reason = "never_used"
        elif last_used_at < cutoff_date:
            deletion_reason = "last_used_old"
        else:
            deletion_reason = None

        preview.append({
            "id": str(version.id),
            "user_id": str(version.user_id),
            "box_name": version.box_name,
            "version_number": version.version_number,
            "uses_count": version.uses_count,
            "created_at": created_at.isoformat() if created_at else None,
            "last_used_at": last_used_at.isoformat() if last_used_at else None,
            "days_since_created": days_since_created,
            "days_since_last_used": days_since_last_used,
            "deletion_reason": deletion_reason,
            "cutoff_date": cutoff_date.isoformat()
        })

    return preview

def delete_unused_versions(session: Session, days_threshold: int) -> int:
    if days_threshold < 1:
        raise ValueError("Days threshold must be at least 1")

    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_threshold)

    try:
        statement = select(ContextVersion).where(
            or_(
                (ContextVersion.last_used_at.is_(None)) & (ContextVersion.created_at < cutoff_date),
                (ContextVersion.last_used_at.isnot(None)) & (ContextVersion.last_used_at < cutoff_date)
            )
        )

        versions_to_delete = list(session.exec(statement).all())
        count = len(versions_to_delete)

        if count > 0:
            for version in versions_to_delete:
                session.delete(version)
            session.commit()
            logger.info(
                f"Deleted {count} unused context versions older than {days_threshold} days "
                f"(cutoff: {cutoff_date.isoformat()})"
            )
        else:
            logger.debug(f"No versions to delete with {days_threshold} days threshold")

        return count
    except Exception as e:
        session.rollback()
        logger.error(f"Failed to delete unused versions: {str(e)}")
        raise

