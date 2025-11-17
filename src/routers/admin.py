from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlmodel import Session, select, func
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from collections import defaultdict
import json

from ..database import get_session
from ..services import create_access_token, get_admin_user
from ..crud.admin import authenticate_admin
from ..schemas.admin import AdminLogin, AdminTokenResponse
from ..models import (
    User, ContextVersion, AnalyticsEvent, Feedback, 
    UpgradeInterest, InstallEvent, OnboardingEvent
)
from ..constants import ErrorCode, ContextBox, LLM_SITES, LLM_DISPLAY_NAMES
from ..logging_config import logger
from ..middleware import limiter

# Helper function to categorize LLM consistently
def categorize_llm(llm_string: str) -> str:
    """Categorize an LLM string to a display name. Returns 'Other' if not matched."""
    if not llm_string:
        return "Other"
    
    llm_lower = llm_string.lower()
    
    # Check against LLM_DISPLAY_NAMES mapping (site patterns)
    for site, display_name in LLM_DISPLAY_NAMES.items():
        if site in llm_lower:
            return display_name
    
    # Also check for common variations
    if 'chatgpt' in llm_lower or 'openai' in llm_lower:
        return 'ChatGPT'
    elif 'claude' in llm_lower or 'anthropic' in llm_lower:
        return 'Claude'
    elif 'gemini' in llm_lower or 'bard' in llm_lower:
        return 'Gemini'
    elif 'perplexity' in llm_lower:
        return 'Perplexity'
    
    return "Other"

router = APIRouter(prefix="/admin", tags=["admin"])


# ============================================================================
# AUTHENTICATION
# ============================================================================

@router.post("/login", response_model=AdminTokenResponse)
@limiter.limit("5/minute")
def admin_login(
    request: Request,
    credentials: AdminLogin,
    session: Session = Depends(get_session)
):
    """Admin login endpoint"""
    admin = authenticate_admin(session, credentials.username, credentials.password)
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "message": "Incorrect username or password",
                "error_code": ErrorCode.INVALID_CREDENTIALS
            }
        )
    
    # Create JWT token with admin flag
    access_token = create_access_token(
        data={"sub": str(admin.id), "is_admin": True}
    )
    logger.info(f"Admin logged in: {credentials.username}")
    return AdminTokenResponse(access_token=access_token)


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def parse_time_range(time_range: str) -> tuple[datetime, datetime]:
    """Parse time_range parameter into start/end datetimes"""
    now = datetime.now(timezone.utc)
    
    if time_range == "7d":
        start = now - timedelta(days=7)
    elif time_range == "30d":
        start = now - timedelta(days=30)
    elif time_range == "90d":
        start = now - timedelta(days=90)
    elif time_range == "all_time":
        start = datetime(2020, 1, 1, tzinfo=timezone.utc)
    else:
        start = now - timedelta(days=7)
    
    return start, now


def safe_divide(numerator: float, denominator: float) -> float:
    """Safe division that returns 0 if denominator is 0"""
    return numerator / denominator if denominator > 0 else 0


def calculate_percentage_change(current: float, previous: float) -> float:
    """Calculate percentage change"""
    if previous == 0:
        return 100.0 if current > 0 else 0.0
    return round(((current - previous) / previous) * 100, 1)


# ============================================================================
# OVERVIEW ENDPOINTS
# ============================================================================

analytics_router = APIRouter(prefix="/analytics")


@analytics_router.get("/overview/kpis")
def get_overview_kpis(
    time_range: str = "7d",
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get overview KPIs with change percentages"""
    start_date, end_date = parse_time_range(time_range)
    prev_start = start_date - (end_date - start_date)
    
    # Total users
    total_users = session.exec(select(func.count(User.id))).one()
    
    # Active users (7d) - users with any activity
    active_events = session.exec(
        select(func.count(func.distinct(AnalyticsEvent.user_id)))
        .where(AnalyticsEvent.created_at >= start_date)
        .where(AnalyticsEvent.created_at < end_date)
    ).one() or 0
    
    prev_active = session.exec(
        select(func.count(func.distinct(AnalyticsEvent.user_id)))
        .where(AnalyticsEvent.created_at >= prev_start)
        .where(AnalyticsEvent.created_at < start_date)
    ).one() or 0
    
    # Context copies
    copies_current = session.exec(
        select(func.count(ContextVersion.id))
        .where(ContextVersion.last_used_at >= start_date)
        .where(ContextVersion.last_used_at < end_date)
        .where(ContextVersion.uses_count > 0)
    ).one() or 0
    
    copies_prev = session.exec(
        select(func.count(ContextVersion.id))
        .where(ContextVersion.last_used_at >= prev_start)
        .where(ContextVersion.last_used_at < start_date)
        .where(ContextVersion.uses_count > 0)
    ).one() or 0
    
    # Avg copies per user
    avg_copies = safe_divide(copies_current, active_events) if active_events > 0 else 0
    prev_avg_copies = safe_divide(copies_prev, prev_active) if prev_active > 0 else 0
    
    # New signups
    new_signups = session.exec(
        select(func.count(User.id))
        .where(User.created_at >= start_date)
        .where(User.created_at < end_date)
    ).one() or 0
    
    prev_signups = session.exec(
        select(func.count(User.id))
        .where(User.created_at >= prev_start)
        .where(User.created_at < start_date)
    ).one() or 0
    
    # Upgrade interest
    upgrade_interest = session.exec(select(func.count(UpgradeInterest.id))).one() or 0
    
    upgrade_current = session.exec(
        select(func.count(UpgradeInterest.id))
        .where(UpgradeInterest.created_at >= start_date)
    ).one() or 0
    
    upgrade_prev = session.exec(
        select(func.count(UpgradeInterest.id))
        .where(UpgradeInterest.created_at >= prev_start)
        .where(UpgradeInterest.created_at < start_date)
    ).one() or 0
    
    # Onboarding completion
    total_users_count = session.exec(select(func.count(User.id))).one() or 1
    completed_onboarding = session.exec(
        select(func.count(User.id))
        .where(User.onboarding_completed == True)
    ).one() or 0
    onboarding_rate = safe_divide(completed_onboarding * 100, total_users_count)
    
    prev_total_users = session.exec(
        select(func.count(User.id))
        .where(User.created_at < start_date)
    ).one() or 1
    prev_completed_onboarding = session.exec(
        select(func.count(User.id))
        .where(User.onboarding_completed == True)
        .where(User.created_at < start_date)
    ).one() or 0
    prev_onboarding_rate = safe_divide(prev_completed_onboarding * 100, prev_total_users)
    
    # 7-day retention (simplified - users active in week 1 after signup)
    week_ago = end_date - timedelta(days=14)
    two_weeks_ago = week_ago - timedelta(days=7)
    
    cohort_users = session.exec(
        select(func.count(User.id))
        .where(User.created_at >= two_weeks_ago)
        .where(User.created_at < week_ago)
    ).one() or 1
    
    retained_users = session.exec(
        select(func.count(func.distinct(AnalyticsEvent.user_id)))
        .join(User, AnalyticsEvent.user_id == User.id)
        .where(User.created_at >= two_weeks_ago)
        .where(User.created_at < week_ago)
        .where(AnalyticsEvent.created_at >= week_ago)
        .where(AnalyticsEvent.created_at < week_ago + timedelta(days=7))
    ).one() or 0
    
    retention_7d = safe_divide(retained_users * 100, cohort_users)
    
    prev_week_ago = start_date - timedelta(days=14)
    prev_two_weeks_ago = prev_week_ago - timedelta(days=7)
    
    prev_cohort_users = session.exec(
        select(func.count(User.id))
        .where(User.created_at >= prev_two_weeks_ago)
        .where(User.created_at < prev_week_ago)
    ).one() or 1
    
    prev_retained_users = session.exec(
        select(func.count(func.distinct(AnalyticsEvent.user_id)))
        .join(User, AnalyticsEvent.user_id == User.id)
        .where(User.created_at >= prev_two_weeks_ago)
        .where(User.created_at < prev_week_ago)
        .where(AnalyticsEvent.created_at >= prev_week_ago)
        .where(AnalyticsEvent.created_at < prev_week_ago + timedelta(days=7))
    ).one() or 0
    
    prev_retention_7d = safe_divide(prev_retained_users * 100, prev_cohort_users)
    
    return {
        "total_users": total_users,
        "active_users_7d": active_events,
        "active_users_7d_change_percent": calculate_percentage_change(active_events, prev_active),
        "context_copies_7d": copies_current,
        "context_copies_7d_change_percent": calculate_percentage_change(copies_current, copies_prev),
        "avg_copies_per_user": round(avg_copies, 1),
        "avg_copies_per_user_change_percent": calculate_percentage_change(avg_copies, prev_avg_copies),
        "new_signups_7d": new_signups,
        "new_signups_7d_change_percent": calculate_percentage_change(new_signups, prev_signups),
        "upgrade_interest_total": upgrade_interest,
        "upgrade_interest_change_percent": calculate_percentage_change(upgrade_current, upgrade_prev),
        "onboarding_completion_rate": round(onboarding_rate, 1),
        "onboarding_completion_change_percent": calculate_percentage_change(onboarding_rate, prev_onboarding_rate),
        "retention_7d": round(retention_7d, 1),
        "retention_7d_change_percent": calculate_percentage_change(retention_7d, prev_retention_7d)
    }


@analytics_router.get("/overview/insights")
def get_overview_insights(
    time_range: str = "7d",
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get key insights based on real data - matching the expected format"""
    start_date, end_date = parse_time_range(time_range)
    prev_start = start_date - (end_date - start_date)
    
    insights = []
    
    # 1. Active user growth week-over-week
    active_users_current = session.exec(
        select(func.count(func.distinct(AnalyticsEvent.user_id)))
        .where(AnalyticsEvent.created_at >= start_date)
        .where(AnalyticsEvent.created_at < end_date)
    ).one() or 0
    
    active_users_prev = session.exec(
        select(func.count(func.distinct(AnalyticsEvent.user_id)))
        .where(AnalyticsEvent.created_at >= prev_start)
        .where(AnalyticsEvent.created_at < start_date)
    ).one() or 0
    
    growth_percent = calculate_percentage_change(active_users_current, active_users_prev)
    if growth_percent > 0:
        insights.append(f"Active user growth up {abs(growth_percent)}% week-over-week")
    elif growth_percent < 0:
        insights.append(f"Active user growth down {abs(growth_percent)}% week-over-week")
    else:
        insights.append(f"Active user growth stable ({active_users_current} active users)")
    
    # 2. Most popular context box
    box_copies = {}
    for box in ContextBox:
        copies = session.exec(
            select(func.sum(ContextVersion.uses_count))
            .where(ContextVersion.box_name == box.value)
            .where(ContextVersion.last_used_at >= start_date)
            .where(ContextVersion.last_used_at < end_date)
        ).one() or 0
        if copies:
            box_copies[box.value] = int(copies)
    
    total_copies = sum(box_copies.values())
    if box_copies:
        most_popular_box = max(box_copies.items(), key=lambda x: x[1])
        box_percentage = round(safe_divide(most_popular_box[1] * 100, total_copies), 1)
        insights.append(f"{most_popular_box[0]} context box is most popular ({box_percentage}% of all copies)")
    else:
        insights.append("No context box usage data available")
    
    # 3. Power users (50+ copies/week)
    # Calculate copies per user in the time range
    week_days = (end_date - start_date).days or 7
    if week_days == 0:
        week_days = 7
    
    # Get all versions in time range
    versions_in_range = session.exec(
        select(ContextVersion.user_id, ContextVersion.uses_count)
        .where(ContextVersion.last_used_at >= start_date)
        .where(ContextVersion.last_used_at < end_date)
        .where(ContextVersion.uses_count > 0)
    ).all()
    
    # Group by user and sum copies
    user_copies = defaultdict(int)
    for version in versions_in_range:
        user_copies[version.user_id] += version.uses_count
    
    # Count power users (50+ copies/week)
    power_user_count = 0
    for user_id, total_copies in user_copies.items():
        copies_per_week = (total_copies / week_days) * 7
        if copies_per_week >= 50:
            power_user_count += 1
    
    insights.append(f"{power_user_count} power users identified (50+ copies/week)")
    
    # 4. Top LLM destination
    llm_usage = {}
    versions = session.exec(
        select(ContextVersion.last_llm_used, func.sum(ContextVersion.uses_count))
        .where(ContextVersion.last_used_at >= start_date)
        .where(ContextVersion.last_used_at < end_date)
        .where(ContextVersion.last_llm_used != None)
        .group_by(ContextVersion.last_llm_used)
    ).all()
    
    for llm, count in versions:
        if llm:
            llm_lower = llm.lower()
            # Match against LLM_SITES list
            matched = False
            for site in LLM_SITES:
                if site in llm_lower:
                    display_name = LLM_DISPLAY_NAMES.get(site, site.split('.')[0].title())
                    llm_usage[display_name] = llm_usage.get(display_name, 0) + int(count) if count else 0
                    matched = True
                    break
            if not matched:
                # Don't add to 'Other', just skip unknown LLMs
                pass
    
    if llm_usage:
        top_llm = max(llm_usage.items(), key=lambda x: x[1])
        total_llm_copies = sum(llm_usage.values())
        llm_percentage = round(safe_divide(top_llm[1] * 100, total_llm_copies), 1)
        insights.append(f"{top_llm[0]} is #1 destination ({llm_percentage}% of copies)")
    else:
        insights.append("No LLM usage data available")
    
    return {"insights": insights}


@analytics_router.get("/overview/growth-timeline")
def get_overview_growth_timeline(
    time_range: str = "30d",
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get daily growth timeline for the specified time range"""
    start_date, end_date = parse_time_range(time_range)
    
    # Get daily data
    dates = []
    daily_active = []
    new_signups = []
    context_copies = []
    
    current = start_date
    while current < end_date:
        next_day = current + timedelta(days=1)
        dates.append(current.strftime("%Y-%m-%d"))
        
        # DAU
        dau = session.exec(
            select(func.count(func.distinct(AnalyticsEvent.user_id)))
            .where(AnalyticsEvent.created_at >= current)
            .where(AnalyticsEvent.created_at < next_day)
        ).one() or 0
        daily_active.append(dau)
        
        # New signups
        signups = session.exec(
            select(func.count(User.id))
            .where(User.created_at >= current)
            .where(User.created_at < next_day)
        ).one() or 0
        new_signups.append(signups)
        
        # Context copies
        copies = session.exec(
            select(func.sum(ContextVersion.uses_count))
            .where(ContextVersion.last_used_at >= current)
            .where(ContextVersion.last_used_at < next_day)
        ).one() or 0
        context_copies.append(int(copies) if copies else 0)
        
        current = next_day
    
    # Format for frontend: days array with all metrics per day
    days = []
    for i, date in enumerate(dates):
        days.append({
            "date": date,
            "active_users": daily_active[i],
            "new_signups": new_signups[i],
            "context_copies": context_copies[i]
        })
    
    return {
        "days": days,
        "dates": dates,  # Keep for backward compatibility
        "daily_active_users": daily_active,
        "new_signups": new_signups,
        "context_copies": context_copies
    }


@analytics_router.get("/overview/context-box-distribution")
def get_context_box_distribution(
    time_range: str = "7d",
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get context box usage distribution"""
    start_date, end_date = parse_time_range(time_range)
    
    # Get copies per box
    box_data = {}
    total_copies = 0
    
    for box in ContextBox:
        copies = session.exec(
            select(func.sum(ContextVersion.uses_count))
            .where(ContextVersion.box_name == box.value)
            .where(ContextVersion.last_used_at >= start_date)
            .where(ContextVersion.last_used_at < end_date)
        ).one() or 0
        
        box_data[box.value.lower()] = {
            "count": int(copies) if copies else 0,
            "percentage": 0
        }
        total_copies += int(copies) if copies else 0
    
    # Calculate percentages
    for box in box_data:
        box_data[box]["percentage"] = round(safe_divide(box_data[box]["count"] * 100, total_copies), 1)
    
    # Format for frontend
    return {
        "boxes": box_data,
        "total_copies": total_copies
    }


@analytics_router.get("/overview/llm-distribution")
def get_llm_distribution(
    time_range: str = "7d",
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get LLM platform distribution"""
    start_date, end_date = parse_time_range(time_range)
    
    # Get LLM usage
    llm_data = defaultdict(int)
    total = 0
    
    versions = session.exec(
        select(ContextVersion.last_llm_used, func.sum(ContextVersion.uses_count))
        .where(ContextVersion.last_used_at >= start_date)
        .where(ContextVersion.last_used_at < end_date)
        .where(ContextVersion.last_llm_used != None)
        .group_by(ContextVersion.last_llm_used)
    ).all()
    
    for llm, count in versions:
        if llm:
            llm_lower = llm.lower()
            # Match against LLM_SITES list
            matched = False
            for site in LLM_SITES:
                if site in llm_lower:
                    display_name = LLM_DISPLAY_NAMES.get(site, site.split('.')[0].lower())
                    llm_data[display_name] = llm_data.get(display_name, 0) + int(count) if count else 0
                    matched = True
                    break
            if not matched:
                # Don't add to 'other', just skip unknown LLMs
                pass
            total += int(count) if count else 0
    
    result = {}
    # Only include LLMs that have data (exclude 'other' if it exists)
    for llm, count in llm_data.items():
        if llm.lower() != 'other' and count > 0:
            result[llm] = {
                "count": count,
                "percentage": round(safe_divide(count * 100, total), 1)
            }
    
    # Format for frontend
    return {
        "distribution": result,
        "total": total
    }


@analytics_router.get("/overview/user-lifecycle")
def get_user_lifecycle(
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get user lifecycle distribution - Active and Dormant only"""
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    
    total_users = session.exec(select(func.count(User.id))).one() or 0
    
    # Active: activity in last 7 days
    active = session.exec(
        select(func.count(func.distinct(AnalyticsEvent.user_id)))
        .where(AnalyticsEvent.created_at >= week_ago)
    ).one() or 0
    
    # Dormant: total - active (users with no activity in last 7 days)
    dormant = max(0, total_users - active)
    
    return {
        "active_users": {"count": active, "percentage": round(safe_divide(active * 100, total_users), 1)},
        "dormant_users": {"count": dormant, "percentage": round(safe_divide(dormant * 100, total_users), 1)},
        # Keep old format for backward compatibility
        "active": {"count": active, "percentage": round(safe_divide(active * 100, total_users), 1)},
        "dormant": {"count": dormant, "percentage": round(safe_divide(dormant * 100, total_users), 1)}
    }


@analytics_router.get("/overview/performance-health")
def get_performance_health(
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get performance health metrics from analytics events"""
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    
    retrieval_events = session.exec(
        select(AnalyticsEvent.event_metadata)
        .where(AnalyticsEvent.created_at >= week_ago)
        .where(AnalyticsEvent.event_type == "context_retrieved")
    ).all()
    
    retrieval_times = []
    for event_metadata in retrieval_events:
        if isinstance(event_metadata, dict) and "retrieval_time_ms" in event_metadata:
            try:
                time_val = float(event_metadata["retrieval_time_ms"])
                if time_val is not None and not (isinstance(time_val, float) and (time_val < 0 or time_val > 100000)):
                    retrieval_times.append(time_val)
            except (ValueError, TypeError):
                pass
    
    avg_retrieval_time_ms = round(sum(retrieval_times) / len(retrieval_times), 1) if retrieval_times else None
    
    events = session.exec(
        select(AnalyticsEvent.created_at)
        .where(AnalyticsEvent.created_at >= week_ago)
    ).all()
    
    unique_hours = set()
    for event_time in events:
        hour_key = event_time.replace(minute=0, second=0, microsecond=0)
        unique_hours.add(hour_key)
    
    hours_with_activity = len(unique_hours)
    total_hours = 168
    uptime_percent = round((hours_with_activity / total_hours) * 100, 1) if hours_with_activity > 0 else 95.0
    uptime_percent = min(100.0, uptime_percent)
    
    return {
        "avg_retrieval_time_ms": avg_retrieval_time_ms,
        "uptime_percent": uptime_percent,
        "total_retrievals_7d": len(retrieval_times),
        "hours_with_activity": hours_with_activity
    }


# ============================================================================
# ACQUISITION ENDPOINTS
# ============================================================================

@analytics_router.get("/acquisition/metrics")
def get_acquisition_metrics(
    time_range: str = "7d",
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get acquisition metrics (DAU, WAU, MAU)"""
    now = datetime.now(timezone.utc)
    
    # Total registered users
    total_users = session.exec(select(func.count(User.id))).one() or 0
    
    # DAU - yesterday vs day before
    yesterday_start = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0)
    yesterday_end = yesterday_start + timedelta(days=1)
    day_before_start = yesterday_start - timedelta(days=1)
    
    dau = session.exec(
        select(func.count(func.distinct(AnalyticsEvent.user_id)))
        .where(AnalyticsEvent.created_at >= yesterday_start)
        .where(AnalyticsEvent.created_at < yesterday_end)
    ).one() or 0
    
    dau_prev = session.exec(
        select(func.count(func.distinct(AnalyticsEvent.user_id)))
        .where(AnalyticsEvent.created_at >= day_before_start)
        .where(AnalyticsEvent.created_at < yesterday_start)
    ).one() or 0
    
    # WAU - last 7 days
    week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)
    
    wau = session.exec(
        select(func.count(func.distinct(AnalyticsEvent.user_id)))
        .where(AnalyticsEvent.created_at >= week_ago)
    ).one() or 0
    
    wau_prev = session.exec(
        select(func.count(func.distinct(AnalyticsEvent.user_id)))
        .where(AnalyticsEvent.created_at >= two_weeks_ago)
        .where(AnalyticsEvent.created_at < week_ago)
    ).one() or 0
    
    # MAU - last 30 days
    month_ago = now - timedelta(days=30)
    two_months_ago = now - timedelta(days=60)
    
    mau = session.exec(
        select(func.count(func.distinct(AnalyticsEvent.user_id)))
        .where(AnalyticsEvent.created_at >= month_ago)
    ).one() or 0
    
    mau_prev = session.exec(
        select(func.count(func.distinct(AnalyticsEvent.user_id)))
        .where(AnalyticsEvent.created_at >= two_months_ago)
        .where(AnalyticsEvent.created_at < month_ago)
    ).one() or 0
    
    # Calculate total registered users change
    week_ago_for_total = now - timedelta(days=7)
    total_users_prev = session.exec(
        select(func.count(User.id))
        .where(User.created_at < week_ago_for_total)
    ).one() or 0
    total_change = calculate_percentage_change(total_users, total_users_prev)
    
    return {
        "total_registered_users": total_users,
        "total_registered_change_percent": total_change,
        "dau": dau,
        "dau_change_percent": calculate_percentage_change(dau, dau_prev),
        "wau": wau,
        "wau_change_percent": calculate_percentage_change(wau, wau_prev),
        "mau": mau,
        "mau_change_percent": calculate_percentage_change(mau, mau_prev)
    }


@analytics_router.get("/acquisition/funnel")
def get_acquisition_funnel(
    time_range: str = "30d",
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get signup conversion funnel data"""
    start_date, end_date = parse_time_range(time_range)
    
    accounts = session.exec(
        select(func.count(User.id))
        .where(User.created_at >= start_date)
        .where(User.created_at < end_date)
    ).one() or 0
    
    verified = session.exec(
        select(func.count(User.id))
        .where(User.created_at >= start_date)
        .where(User.created_at < end_date)
        .where(User.email_verified == True)
    ).one() or 0
    
    onboarding_completed = session.exec(
        select(func.count(User.id))
        .where(User.created_at >= start_date)
        .where(User.created_at < end_date)
        .where(User.onboarding_completed == True)
    ).one() or 0
    
    users_with_first_box = session.exec(
        select(func.count(func.distinct(ContextVersion.user_id)))
        .join(User, ContextVersion.user_id == User.id)
        .where(User.created_at >= start_date)
        .where(User.created_at < end_date)
    ).one() or 0
    
    return {
        "funnel": [
            {
                "stage": "Account Created",
                "count": accounts,
                "conversion_rate": 100.0,
                "drop_off": 0
            },
            {
                "stage": "Email Verified",
                "count": verified,
                "conversion_rate": round(safe_divide(verified * 100, accounts), 1) if accounts > 0 else 0,
                "drop_off": accounts - verified
            },
            {
                "stage": "Onboarding Completed",
                "count": onboarding_completed,
                "conversion_rate": round(safe_divide(onboarding_completed * 100, verified), 1) if verified > 0 else 0,
                "drop_off": verified - onboarding_completed
            },
            {
                "stage": "Made First Box",
                "count": users_with_first_box,
                "conversion_rate": round(safe_divide(users_with_first_box * 100, onboarding_completed), 1) if onboarding_completed > 0 else 0,
                "drop_off": onboarding_completed - users_with_first_box
            }
        ]
    }


@analytics_router.get("/acquisition/growth-timeline")
def get_acquisition_growth_timeline(
    time_range: str = "90d",
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get cumulative user growth timeline"""
    start_date, end_date = parse_time_range(time_range)
    
    dates = []
    cumulative_users = []
    new_signups = []
    
    current = start_date
    total = 0
    
    while current < end_date:
        next_day = current + timedelta(days=1)
        dates.append(current.strftime("%Y-%m-%d"))
        
        # New signups
        signups = session.exec(
            select(func.count(User.id))
            .where(User.created_at >= current)
            .where(User.created_at < next_day)
        ).one() or 0
        new_signups.append(signups)
        total += signups
        cumulative_users.append(total)
        
        current = next_day
    
    return {
        "dates": dates,
        "cumulative_users": cumulative_users,
        "new_signups": new_signups
    }


@analytics_router.get("/acquisition/churn")
def get_acquisition_churn(
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get churn metrics"""
    now = datetime.now(timezone.utc)
    
    total_users = session.exec(select(func.count(User.id))).one() or 0
    users_with_activity = session.exec(
        select(func.count(func.distinct(AnalyticsEvent.user_id)))
    ).one() or 0
    never_activated = total_users - users_with_activity
    
    two_weeks_ago = now - timedelta(days=14)
    one_week_ago = now - timedelta(days=7)
    
    users_active_2w_ago_ids = set(session.exec(
        select(AnalyticsEvent.user_id)
        .where(AnalyticsEvent.created_at >= two_weeks_ago)
        .where(AnalyticsEvent.created_at < one_week_ago)
        .where(AnalyticsEvent.user_id != None)
        .distinct()
    ).all())
    
    users_active_last_week_ids = set(session.exec(
        select(AnalyticsEvent.user_id)
        .where(AnalyticsEvent.created_at >= one_week_ago)
        .where(AnalyticsEvent.user_id != None)
        .distinct()
    ).all())
    
    churned_users_weekly = users_active_2w_ago_ids - users_active_last_week_ids
    churned_weekly_count = len(churned_users_weekly)
    users_active_2w_ago_count = len(users_active_2w_ago_ids)
    weekly_churn_rate = safe_divide(churned_weekly_count * 100, users_active_2w_ago_count) if users_active_2w_ago_count > 0 else 0
    
    two_months_ago = now - timedelta(days=60)
    one_month_ago = now - timedelta(days=30)
    
    users_active_2m_ago_ids = set(session.exec(
        select(AnalyticsEvent.user_id)
        .where(AnalyticsEvent.created_at >= two_months_ago)
        .where(AnalyticsEvent.created_at < one_month_ago)
        .where(AnalyticsEvent.user_id != None)
        .distinct()
    ).all())
    
    users_active_last_month_ids = set(session.exec(
        select(AnalyticsEvent.user_id)
        .where(AnalyticsEvent.created_at >= one_month_ago)
        .where(AnalyticsEvent.user_id != None)
        .distinct()
    ).all())
    
    churned_users_monthly = users_active_2m_ago_ids - users_active_last_month_ids
    churned_monthly_count = len(churned_users_monthly)
    users_active_2m_ago_count = len(users_active_2m_ago_ids)
    monthly_churn_rate = safe_divide(churned_monthly_count * 100, users_active_2m_ago_count) if users_active_2m_ago_count > 0 else 0
    
    return {
        "weekly_churn_rate": round(weekly_churn_rate, 1),
        "monthly_churn_rate": round(monthly_churn_rate, 1),
        "never_activated_users": never_activated
    }


@analytics_router.get("/acquisition/signup-patterns")
def get_signup_patterns(
    time_range: str = "30d",
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get signup patterns by day and hour - from User.created_at (actual signup timestamps in DB)"""
    start_date, end_date = parse_time_range(time_range)
    
    # Get all signups in range - using User.created_at which is the actual signup timestamp
    users = session.exec(
        select(User.created_at)
        .where(User.created_at >= start_date)
        .where(User.created_at < end_date)
    ).all()
    
    by_day = defaultdict(int)
    by_hour = defaultdict(int)
    
    # Group by day of week and hour from actual signup timestamps
    for created_at in users:
        day_name = created_at.strftime("%A").lower()  # Monday, Tuesday, etc.
        by_day[day_name] += 1
        by_hour[str(created_at.hour)] += 1  # 0-23 for hour of day
    
    return {
        "by_day_of_week": dict(by_day),
        "by_hour": dict(by_hour)
    }


# ============================================================================
# ENGAGEMENT ENDPOINTS
# ============================================================================

@analytics_router.get("/engagement/metrics")
def get_engagement_metrics(
    time_range: str = "7d",
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get engagement metrics"""
    start_date, end_date = parse_time_range(time_range)
    prev_start = start_date - (end_date - start_date)
    
    # Total context copies
    copies_current = session.exec(
        select(func.sum(ContextVersion.uses_count))
        .where(ContextVersion.last_used_at >= start_date)
        .where(ContextVersion.last_used_at < end_date)
    ).one() or 0
    
    copies_prev = session.exec(
        select(func.sum(ContextVersion.uses_count))
        .where(ContextVersion.last_used_at >= prev_start)
        .where(ContextVersion.last_used_at < start_date)
    ).one() or 0
    
    # Active users
    active_users = session.exec(
        select(func.count(func.distinct(AnalyticsEvent.user_id)))
        .where(AnalyticsEvent.created_at >= start_date)
    ).one() or 1
    
    # Avg copies per active user
    avg_copies = safe_divide(copies_current, active_users)
    
    # New versions created
    new_versions = session.exec(
        select(func.count(ContextVersion.id))
        .where(ContextVersion.created_at >= start_date)
        .where(ContextVersion.created_at < end_date)
    ).one() or 0
    
    new_versions_prev = session.exec(
        select(func.count(ContextVersion.id))
        .where(ContextVersion.created_at >= prev_start)
        .where(ContextVersion.created_at < start_date)
    ).one() or 0
    
    return {
        "total_context_copies": int(copies_current),
        "total_context_copies_change_percent": calculate_percentage_change(copies_current, copies_prev),
        "avg_copies_per_active_user": round(avg_copies, 1),
        "avg_copies_change_percent": 0,
        "new_versions_created": new_versions,
        "new_versions_change_percent": calculate_percentage_change(new_versions, new_versions_prev),
        "avg_session_duration_seconds": -1  # Not tracked in current analytics
    }


@analytics_router.get("/engagement/copy-activity-timeline")
def get_copy_activity_timeline(
    time_range: str = "30d",
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get daily copy activity timeline"""
    start_date, end_date = parse_time_range(time_range)
    
    dates = []
    context_copies = []
    
    current = start_date
    while current < end_date:
        next_day = current + timedelta(days=1)
        dates.append(current.strftime("%Y-%m-%d"))
        
        copies = session.exec(
            select(func.sum(ContextVersion.uses_count))
            .where(ContextVersion.last_used_at >= current)
            .where(ContextVersion.last_used_at < next_day)
        ).one() or 0
        
        context_copies.append(int(copies))
        current = next_day
    
    # Calculate 7-day moving average
    moving_avg = []
    for i in range(len(context_copies)):
        start_idx = max(0, i - 6)
        avg = sum(context_copies[start_idx:i+1]) / min(i+1, 7)
        moving_avg.append(round(avg, 1))
    
    # Format for frontend: days array with all metrics per day
    days = []
    for i, date in enumerate(dates):
        days.append({
            "date": date,
            "copies": context_copies[i],
            "moving_avg": moving_avg[i]
        })
    
    return {
        "days": days,
        "dates": dates,  # Keep for backward compatibility
        "context_copies": context_copies,
        "moving_average_7d": moving_avg
    }


@analytics_router.get("/engagement/context-box-usage")
def get_context_box_usage(
    time_range: str = "7d",
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get context box usage breakdown"""
    start_date, end_date = parse_time_range(time_range)
    
    box_data = {}
    total_copies = 0
    
    for box in ContextBox:
        copies = session.exec(
            select(func.sum(ContextVersion.uses_count))
            .where(ContextVersion.box_name == box.value)
            .where(ContextVersion.last_used_at >= start_date)
            .where(ContextVersion.last_used_at < end_date)
        ).one() or 0
        
        box_data[box.value.lower()] = {
            "copies": int(copies),
            "percentage": 0
        }
        total_copies += int(copies)
    
    # Calculate percentages
    for box in box_data:
        box_data[box]["percentage"] = round(safe_divide(box_data[box]["copies"] * 100, total_copies), 1) if total_copies > 0 else 0
    
    # Return as dict (frontend expects direct access by box name)
    return box_data


@analytics_router.get("/engagement/version-stats")
def get_version_stats(
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get version statistics"""
    total_versions = session.exec(select(func.count(ContextVersion.id))).one() or 0
    
    # Unique users with versions
    unique_users = session.exec(
        select(func.count(func.distinct(ContextVersion.user_id)))
    ).one() or 1
    
    # Users with 5+ versions
    user_version_counts = session.exec(
        select(
            ContextVersion.user_id,
            func.count(ContextVersion.id).label("version_count")
        )
        .group_by(ContextVersion.user_id)
    ).all()
    
    users_5plus = [uid for uid, count in user_version_counts if count >= 5]
    
    # Calculate average versions per box
    box_counts = {}
    for box in ContextBox:
        count = session.exec(
            select(func.count(ContextVersion.id))
            .where(ContextVersion.box_name == box.value)
        ).one() or 0
        box_counts[box.value] = count
    
    total_boxes = len([b for b in box_counts.values() if b > 0])
    avg_versions_per_box = safe_divide(total_versions, total_boxes) if total_boxes > 0 else 0
    
    # Calculate average days between updates
    # Get all versions with created_at, ordered by user and created_at
    versions_with_dates = session.exec(
        select(ContextVersion.user_id, ContextVersion.created_at)
        .order_by(ContextVersion.user_id, ContextVersion.created_at)
    ).all()
    
    update_intervals = []
    current_user = None
    last_date = None
    
    for user_id, created_at in versions_with_dates:
        if current_user == user_id and last_date:
            days_diff = (created_at - last_date).days
            if days_diff > 0:
                update_intervals.append(days_diff)
        current_user = user_id
        last_date = created_at
    
    avg_days_between_updates = sum(update_intervals) / len(update_intervals) if update_intervals else 0
    
    return {
        "total_versions": total_versions,
        "avg_versions_per_box": round(avg_versions_per_box, 1),
        "avg_days_between_updates": round(avg_days_between_updates, 1),
        "users_with_5plus_versions": len(users_5plus)
    }


@analytics_router.get("/engagement/power-users")
def get_power_users(
    time_range: str = "7d",
    limit: int = 5,
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get top power users (default: top 5)"""
    start_date, end_date = parse_time_range(time_range)
    
    # Get users with most copies - limit to top 5
    users_data = session.exec(
        select(
            ContextVersion.user_id,
            func.sum(ContextVersion.uses_count).label("total_copies")
        )
        .where(ContextVersion.last_used_at >= start_date)
        .where(ContextVersion.last_used_at < end_date)
        .group_by(ContextVersion.user_id)
        .order_by(func.sum(ContextVersion.uses_count).desc())
        .limit(5)  # Fixed to top 5 only
    ).all()
    
    result = []
    for user_id, copies in users_data:
        # Get versions count
        versions = session.exec(
            select(func.count(ContextVersion.id))
            .where(ContextVersion.user_id == user_id)
        ).one() or 0
        
        # Get most used box
        most_used = session.exec(
            select(ContextVersion.box_name)
            .where(ContextVersion.user_id == user_id)
            .order_by(ContextVersion.uses_count.desc())
            .limit(1)
        ).first()
        
        # Calculate sessions from analytics events (unique days with activity)
        sessions = session.exec(
            select(func.count(func.distinct(func.date(AnalyticsEvent.created_at))))
            .where(AnalyticsEvent.user_id == user_id)
            .where(AnalyticsEvent.created_at >= start_date)
            .where(AnalyticsEvent.created_at < end_date)
        ).one() or 0
        
        result.append({
            "user_id": str(user_id)[:8],
            "context_copies_7d": int(copies),
            "versions_created": versions,
            "most_used_box": most_used if most_used else "N/A",
            "sessions": sessions,
            "status": "Power User" if copies > 50 else "Active"
        })
    
    return {"users": result}


@analytics_router.get("/engagement/onboarding-funnel")
def get_onboarding_funnel(
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get onboarding completion funnel - simplified to just completed/not completed"""
    total_users = session.exec(select(func.count(User.id))).one() or 0
    
    # Get users who completed onboarding
    completed = session.exec(
        select(func.count(User.id))
        .where(User.onboarding_completed == True)
    ).one() or 0
    
    # Get users who started onboarding (have onboarding events or are registered)
    onboarding_started = session.exec(
        select(func.count(func.distinct(OnboardingEvent.user_id)))
        .where(OnboardingEvent.event_type == "started")
    ).one() or 0
    
    # If no onboarding events, assume all registered users started
    if onboarding_started == 0:
        onboarding_started = total_users
    
    # Not completed = users who started but didn't complete
    not_completed = onboarding_started - completed
    
    # Format for frontend - simple: Started, Completed, Not Completed
    # Started is baseline (100%), Completed shows conversion from Started, Not Completed shows remaining
    stages = [
        {
            "stage": "Started Onboarding",
            "count": onboarding_started,
            "percentage": 100.0 if onboarding_started > 0 else 0
        },
        {
            "stage": "Completed Onboarding",
            "count": completed,
            "percentage": round(safe_divide(completed * 100, onboarding_started), 1) if onboarding_started > 0 else 0
        },
        {
            "stage": "Not Completed",
            "count": not_completed,
            "percentage": round(safe_divide(not_completed * 100, onboarding_started), 1) if onboarding_started > 0 else 0
        }
    ]
    
    return {
        "stages": stages
    }


# ============================================================================
# FEATURES ENDPOINTS
# ============================================================================

@analytics_router.get("/features/metrics")
def get_features_metrics(
    time_range: str = "7d",
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get feature adoption metrics"""
    start_date, end_date = parse_time_range(time_range)
    
    total_users = session.exec(select(func.count(User.id))).one() or 0
    
    users_with_context = session.exec(
        select(func.count(func.distinct(ContextVersion.user_id)))
        .where(ContextVersion.created_at >= start_date)
        .where(ContextVersion.created_at < end_date)
    ).one() or 0
    
    utilization = safe_divide(users_with_context * 100, total_users)
    
    multi_version = session.exec(
        select(ContextVersion.user_id)
        .where(ContextVersion.created_at >= start_date)
        .where(ContextVersion.created_at < end_date)
        .group_by(ContextVersion.user_id)
        .having(func.count(ContextVersion.id) > 1)
    ).all()
    
    dashboard_visitors = session.exec(
        select(func.count(func.distinct(AnalyticsEvent.user_id)))
        .where(AnalyticsEvent.event_type == "dashboard_visited")
        .where(AnalyticsEvent.created_at >= start_date)
        .where(AnalyticsEvent.created_at < end_date)
    ).one() or 0
    
    user_box_counts = session.exec(
        select(
            ContextVersion.user_id,
            func.count(func.distinct(ContextVersion.box_name)).label("box_count")
        )
        .where(ContextVersion.created_at >= start_date)
        .where(ContextVersion.created_at < end_date)
        .group_by(ContextVersion.user_id)
    ).all()
    
    avg_boxes = safe_divide(sum(count for _, count in user_box_counts), len(user_box_counts)) if user_box_counts else 0
    
    return {
        "context_box_utilization_percent": round(utilization, 1),
        "avg_active_boxes_per_user": round(avg_boxes, 1),
        "multi_version_users": len(multi_version),
        "multi_version_percent": round(safe_divide(len(multi_version) * 100, total_users), 1) if total_users > 0 else 0,
        "dashboard_visitors": dashboard_visitors,
        "dashboard_visitors_percent": round(safe_divide(dashboard_visitors * 100, total_users), 1) if total_users > 0 else 0
    }


@analytics_router.get("/features/adoption-breakdown")
def get_features_adoption_breakdown(
    time_range: str = "30d",
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get detailed feature adoption with real calculations"""
    start_date, end_date = parse_time_range(time_range)
    period_days = (end_date - start_date).days
    prev_start = start_date - timedelta(days=period_days)
    
    total_users = session.exec(select(func.count(User.id))).one() or 0
    
    users_with_context = session.exec(
        select(func.count(func.distinct(ContextVersion.user_id)))
        .where(ContextVersion.created_at >= start_date)
        .where(ContextVersion.created_at < end_date)
    ).one() or 0
    
    users_with_context_prev = session.exec(
        select(func.count(func.distinct(ContextVersion.user_id)))
        .where(ContextVersion.created_at >= prev_start)
        .where(ContextVersion.created_at < start_date)
    ).one() or 0
    
    avg_boxes_per_user = 0
    if users_with_context > 0:
        user_box_counts = session.exec(
            select(func.count(func.distinct(ContextVersion.box_name)))
            .where(ContextVersion.created_at >= start_date)
            .where(ContextVersion.created_at < end_date)
            .group_by(ContextVersion.user_id)
        ).all()
        avg_boxes_per_user = safe_divide(sum(user_box_counts), len(user_box_counts)) if user_box_counts else 0
    
    multi_version_users = session.exec(
        select(ContextVersion.user_id)
        .where(ContextVersion.created_at >= start_date)
        .where(ContextVersion.created_at < end_date)
        .group_by(ContextVersion.user_id)
        .having(func.count(ContextVersion.id) > 1)
    ).all()
    
    multi_version_count = len(multi_version_users)
    multi_version_prev_users = session.exec(
        select(ContextVersion.user_id)
        .where(ContextVersion.created_at >= prev_start)
        .where(ContextVersion.created_at < start_date)
        .group_by(ContextVersion.user_id)
        .having(func.count(ContextVersion.id) > 1)
    ).all()
    multi_version_prev = len(multi_version_prev_users)
    
    avg_versions_per_user = 0
    if multi_version_count > 0:
        version_counts = session.exec(
            select(func.count(ContextVersion.id))
            .where(ContextVersion.created_at >= start_date)
            .where(ContextVersion.created_at < end_date)
            .group_by(ContextVersion.user_id)
            .having(func.count(ContextVersion.id) > 1)
        ).all()
        avg_versions_per_user = safe_divide(sum(version_counts), len(version_counts)) if version_counts else 0
    
    dashboard_users = session.exec(
        select(func.count(func.distinct(AnalyticsEvent.user_id)))
        .where(AnalyticsEvent.event_type == "dashboard_visited")
        .where(AnalyticsEvent.created_at >= start_date)
        .where(AnalyticsEvent.created_at < end_date)
    ).one() or 0
    
    dashboard_users_prev = session.exec(
        select(func.count(func.distinct(AnalyticsEvent.user_id)))
        .where(AnalyticsEvent.event_type == "dashboard_visited")
        .where(AnalyticsEvent.created_at >= prev_start)
        .where(AnalyticsEvent.created_at < start_date)
    ).one() or 0
    
    total_dashboard_visits = session.exec(
        select(func.count(AnalyticsEvent.id))
        .where(AnalyticsEvent.event_type == "dashboard_visited")
        .where(AnalyticsEvent.created_at >= start_date)
        .where(AnalyticsEvent.created_at < end_date)
    ).one() or 0
    
    avg_visits_per_user = safe_divide(total_dashboard_visits, dashboard_users) if dashboard_users > 0 else 0
    visits_per_week = safe_divide(avg_visits_per_user * 7, period_days) if period_days > 0 else 0
    
    feedback_users = session.exec(
        select(func.count(func.distinct(Feedback.user_id)))
        .where(Feedback.created_at >= start_date)
        .where(Feedback.created_at < end_date)
    ).one() or 0
    
    feedback_users_prev = session.exec(
        select(func.count(func.distinct(Feedback.user_id)))
        .where(Feedback.created_at >= prev_start)
        .where(Feedback.created_at < start_date)
    ).one() or 0
    
    total_feedback = session.exec(
        select(func.count(Feedback.id))
        .where(Feedback.created_at >= start_date)
        .where(Feedback.created_at < end_date)
    ).one() or 0
    
    avg_feedback_per_user = safe_divide(total_feedback, feedback_users) if feedback_users > 0 else 0
    
    upgrade_users = session.exec(
        select(func.count(func.distinct(UpgradeInterest.user_id)))
        .where(UpgradeInterest.created_at >= start_date)
        .where(UpgradeInterest.created_at < end_date)
    ).one() or 0
    
    upgrade_users_prev = session.exec(
        select(func.count(func.distinct(UpgradeInterest.user_id)))
        .where(UpgradeInterest.created_at >= prev_start)
        .where(UpgradeInterest.created_at < start_date)
    ).one() or 0
    
    total_upgrades = session.exec(
        select(func.count(UpgradeInterest.id))
        .where(UpgradeInterest.created_at >= start_date)
        .where(UpgradeInterest.created_at < end_date)
    ).one() or 0
    
    avg_upgrade_per_user = safe_divide(total_upgrades, upgrade_users) if upgrade_users > 0 else 0
    
    def calculate_trend(current, previous):
        if previous == 0:
            return 100.0 if current > 0 else 0.0
        return round(((current - previous) / previous) * 100, 1)
    
    return {
        "features": [
            {
                "name": "Created Context (any box)",
                "unique_users": users_with_context,
                "adoption_rate": round(safe_divide(users_with_context * 100, total_users), 1),
                "avg_usage": f"{round(avg_boxes_per_user, 1)} boxes",
                "trend_percent": calculate_trend(users_with_context, users_with_context_prev)
            },
            {
                "name": "Multiple Versions",
                "unique_users": multi_version_count,
                "adoption_rate": round(safe_divide(multi_version_count * 100, total_users), 1),
                "avg_usage": f"{round(avg_versions_per_user, 1)} versions",
                "trend_percent": calculate_trend(multi_version_count, multi_version_prev)
            },
            {
                "name": "Dashboard Access",
                "unique_users": dashboard_users,
                "adoption_rate": round(safe_divide(dashboard_users * 100, total_users), 1),
                "avg_usage": f"{round(visits_per_week, 1)} visits/week",
                "trend_percent": calculate_trend(dashboard_users, dashboard_users_prev)
            },
            {
                "name": "Feedback Submitted",
                "unique_users": feedback_users,
                "adoption_rate": round(safe_divide(feedback_users * 100, total_users), 1),
                "avg_usage": f"{round(avg_feedback_per_user, 1)} submissions",
                "trend_percent": calculate_trend(feedback_users, feedback_users_prev)
            },
            {
                "name": "Upgrade Interest",
                "unique_users": upgrade_users,
                "adoption_rate": round(safe_divide(upgrade_users * 100, total_users), 1),
                "avg_usage": f"{round(avg_upgrade_per_user, 1)} submission",
                "trend_percent": calculate_trend(upgrade_users, upgrade_users_prev)
            }
        ]
    }


@analytics_router.get("/features/boxes-per-user")
def get_boxes_per_user(
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get distribution of populated boxes per user"""
    # Count distinct boxes per user
    user_box_counts = session.exec(
        select(
            func.count(func.distinct(ContextVersion.box_name)).label("box_count")
        )
        .group_by(ContextVersion.user_id)
    ).all()
    
    # Group by box count (1 box, 2 boxes, 3 boxes, etc.)
    distribution = defaultdict(int)
    for count in user_box_counts:
        distribution[count] += 1
    
    # Format for chart
    result = []
    for boxes in sorted(distribution.keys()):
        result.append({
            "boxes": boxes,
            "users": distribution[boxes]
        })
    
    return {"distribution": result}


@analytics_router.get("/features/version-distribution")
def get_version_distribution(
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get distribution of version counts per user"""
    # Count versions per user
    user_version_counts = session.exec(
        select(
            func.count(ContextVersion.id).label("version_count")
        )
        .group_by(ContextVersion.user_id)
    ).all()
    
    # Group by version count ranges
    distribution = {
        "1": 0,
        "2-3": 0,
        "4-5": 0,
        "6-10": 0,
        "11+": 0
    }
    
    for count in user_version_counts:
        if count == 1:
            distribution["1"] += 1
        elif 2 <= count <= 3:
            distribution["2-3"] += 1
        elif 4 <= count <= 5:
            distribution["4-5"] += 1
        elif 6 <= count <= 10:
            distribution["6-10"] += 1
        else:
            distribution["11+"] += 1
    
    # Format for chart
    result = []
    for range_label, count in distribution.items():
        result.append({
            "range": range_label,
            "users": count
        })
    
    return {"distribution": result}


@analytics_router.get("/features/box-ratio")
def get_box_ratio(
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get empty vs populated box ratio"""
    # Total context boxes created (total ContextVersion records)
    total_boxes = session.exec(select(func.count(ContextVersion.id))).one() or 0
    
    # Populated boxes (boxes that have been used at least once)
    populated_boxes = session.exec(
        select(func.count(ContextVersion.id))
        .where(ContextVersion.uses_count > 0)
    ).one() or 0
    
    # Empty boxes (never used)
    empty_boxes = total_boxes - populated_boxes
    
    # Calculate percentages
    populated_percent = round(safe_divide(populated_boxes * 100, total_boxes), 1) if total_boxes > 0 else 0
    empty_percent = round(safe_divide(empty_boxes * 100, total_boxes), 1) if total_boxes > 0 else 0
    
    return {
        "total_boxes": total_boxes,
        "populated_boxes": populated_boxes,
        "populated_percent": populated_percent,
        "empty_boxes": empty_boxes,
        "empty_percent": empty_percent
    }


@analytics_router.get("/features/power-user-stats")
def get_power_user_stats(
    time_range: str = "7d",
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get power user characteristics"""
    total_users = session.exec(select(func.count(User.id))).one() or 0
    start_date, end_date = parse_time_range(time_range)
    
    # Users with 5+ versions
    user_version_counts = session.exec(
        select(
            ContextVersion.user_id,
            func.count(ContextVersion.id).label("version_count")
        )
        .group_by(ContextVersion.user_id)
        .having(func.count(ContextVersion.id) >= 5)
    ).all()
    users_5plus_versions = len(user_version_counts)
    users_5plus_percent = round(safe_divide(users_5plus_versions * 100, total_users), 1) if total_users > 0 else 0
    
    # Users with all 5 boxes (distinct box_name count >= 5)
    users_with_all_5 = session.exec(
        select(ContextVersion.user_id)
        .group_by(ContextVersion.user_id)
        .having(func.count(func.distinct(ContextVersion.box_name)) >= 5)
    ).all()
    users_all_5_boxes = len(users_with_all_5)
    users_all_5_percent = round(safe_divide(users_all_5_boxes * 100, total_users), 1) if total_users > 0 else 0
    
    # Daily dashboard visitors (users who visited dashboard in the time range)
    daily_dashboard_visitors = session.exec(
        select(func.count(func.distinct(AnalyticsEvent.user_id)))
        .where(AnalyticsEvent.event_type == "dashboard_visited")
        .where(AnalyticsEvent.created_at >= start_date)
        .where(AnalyticsEvent.created_at < end_date)
    ).one() or 0
    daily_dashboard_percent = round(safe_divide(daily_dashboard_visitors * 100, total_users), 1) if total_users > 0 else 0
    
    return {
        "users_5plus_versions": users_5plus_versions,
        "users_5plus_versions_percent": users_5plus_percent,
        "users_all_5_boxes": users_all_5_boxes,
        "users_all_5_boxes_percent": users_all_5_percent,
        "daily_dashboard_visitors": daily_dashboard_visitors,
        "daily_dashboard_visitors_percent": daily_dashboard_percent
    }


@analytics_router.get("/features/adoption-timeline")
def get_features_adoption_timeline(
    time_range: str = "30d",
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get feature adoption timeline"""
    start_date, end_date = parse_time_range(time_range)
    
    dates = []
    context_created = []
    dashboard_visits = []
    feedback_submitted = []
    upgrade_interest = []
    
    current = start_date
    while current < end_date:
        next_day = current + timedelta(days=1)
        dates.append(current.strftime("%Y-%m-%d"))
        
        # Context created
        contexts = session.exec(
            select(func.count(ContextVersion.id))
            .where(ContextVersion.created_at >= current)
            .where(ContextVersion.created_at < next_day)
        ).one() or 0
        context_created.append(contexts)
        
        # Dashboard visits
        visits = session.exec(
            select(func.count(AnalyticsEvent.id))
            .where(AnalyticsEvent.event_type == "dashboard_visited")
            .where(AnalyticsEvent.created_at >= current)
            .where(AnalyticsEvent.created_at < next_day)
        ).one() or 0
        dashboard_visits.append(visits)
        
        # Feedback submitted
        feedback = session.exec(
            select(func.count(Feedback.id))
            .where(Feedback.created_at >= current)
            .where(Feedback.created_at < next_day)
        ).one() or 0
        feedback_submitted.append(feedback)
        
        # Upgrade interest
        upgrades = session.exec(
            select(func.count(UpgradeInterest.id))
            .where(UpgradeInterest.created_at >= current)
            .where(UpgradeInterest.created_at < next_day)
        ).one() or 0
        upgrade_interest.append(upgrades)
        
        current = next_day
    
    return {
        "dates": dates,
        "context_created": context_created,
        "dashboard_visits": dashboard_visits,
        "feedback_submitted": feedback_submitted,
        "upgrade_interest": upgrade_interest
    }


# ============================================================================
# LLM ENDPOINTS
# ============================================================================

@analytics_router.get("/llm/metrics")
def get_llm_metrics(
    time_range: str = "7d",
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get LLM integration metrics"""
    start_date, end_date = parse_time_range(time_range)
    prev_start = start_date - (end_date - start_date)
    
    # Unique LLM platforms used
    unique_llms = session.exec(
        select(func.count(func.distinct(ContextVersion.last_llm_used)))
        .where(ContextVersion.last_llm_used != None)
        .where(ContextVersion.last_used_at >= start_date)
        .where(ContextVersion.last_used_at < end_date)
    ).one() or 0
    
    # Users who used LLMs in time range
    users_with_llm = session.exec(
        select(func.count(func.distinct(ContextVersion.user_id)))
        .where(ContextVersion.last_llm_used != None)
        .where(ContextVersion.last_used_at >= start_date)
        .where(ContextVersion.last_used_at < end_date)
    ).one() or 0
    
    # Calculate average LLMs per user
    user_llm_counts = session.exec(
        select(
            ContextVersion.user_id,
            func.count(func.distinct(ContextVersion.last_llm_used)).label("llm_count")
        )
        .where(ContextVersion.last_llm_used != None)
        .where(ContextVersion.last_used_at >= start_date)
        .where(ContextVersion.last_used_at < end_date)
        .group_by(ContextVersion.user_id)
    ).all()
    
    avg_llms = safe_divide(sum(count for _, count in user_llm_counts), len(user_llm_counts)) if user_llm_counts else 0
    
    # Previous period average
    prev_user_llm_counts = session.exec(
        select(
            ContextVersion.user_id,
            func.count(func.distinct(ContextVersion.last_llm_used)).label("llm_count")
        )
        .where(ContextVersion.last_llm_used != None)
        .where(ContextVersion.last_used_at >= prev_start)
        .where(ContextVersion.last_used_at < start_date)
        .group_by(ContextVersion.user_id)
    ).all()
    
    prev_avg_llms = safe_divide(sum(count for _, count in prev_user_llm_counts), len(prev_user_llm_counts)) if prev_user_llm_counts else 0
    avg_llms_change = calculate_percentage_change(avg_llms, prev_avg_llms)
    
    # Multi-LLM users (users using 2+ different LLMs)
    multi_llm_users = len([uid for uid, count in user_llm_counts if count >= 2])
    total_active_users = session.exec(
        select(func.count(func.distinct(AnalyticsEvent.user_id)))
        .where(AnalyticsEvent.created_at >= start_date)
        .where(AnalyticsEvent.created_at < end_date)
    ).one() or 1
    multi_llm_percent = round(safe_divide(multi_llm_users * 100, total_active_users), 1)
    
    # Cross-platform sessions (users who used multiple LLMs in same day)
    # Get daily LLM usage per user
    daily_user_llms = defaultdict(lambda: defaultdict(set))
    user_llm_daily = session.exec(
        select(
            ContextVersion.user_id,
            ContextVersion.last_llm_used,
            ContextVersion.last_used_at
        )
        .where(ContextVersion.last_llm_used != None)
        .where(ContextVersion.last_used_at >= start_date)
        .where(ContextVersion.last_used_at < end_date)
        .distinct()
    ).all()
    
    for user_id, llm, usage_datetime in user_llm_daily:
        if llm and usage_datetime:
            usage_date = usage_datetime.date()
            daily_user_llms[user_id][usage_date].add(categorize_llm(llm))
    
    cross_platform_users = sum(1 for user_days in daily_user_llms.values() 
                               for day_llms in user_days.values() 
                               if len(day_llms) >= 2)
    cross_platform_percent = round(safe_divide(cross_platform_users * 100, total_active_users), 1) if total_active_users > 0 else 0
    
    return {
        "total_llm_apps_used": unique_llms,
        "avg_llms_per_user": round(avg_llms, 1),
        "avg_llms_change": round(avg_llms_change, 1),
        "multi_llm_users": multi_llm_users,
        "multi_llm_percent": multi_llm_percent,
        "cross_platform_sessions": cross_platform_users,
        "cross_platform_percent": cross_platform_percent
    }


@analytics_router.get("/llm/platform-distribution")
def get_llm_platform_distribution(
    time_range: str = "7d",
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get LLM platform pie chart distribution"""
    start_date, end_date = parse_time_range(time_range)
    
    llm_data = defaultdict(int)
    total = 0
    
    versions = session.exec(
        select(ContextVersion.last_llm_used, func.sum(ContextVersion.uses_count))
        .where(ContextVersion.last_used_at >= start_date)
        .where(ContextVersion.last_used_at < end_date)
        .where(ContextVersion.last_llm_used != None)
        .group_by(ContextVersion.last_llm_used)
    ).all()
    
    for llm, count in versions:
        if llm:
            llm_lower = llm.lower()
            if 'chatgpt' in llm_lower or 'openai' in llm_lower:
                llm_data['chatgpt'] += int(count) if count else 0
            elif 'claude' in llm_lower or 'anthropic' in llm_lower:
                llm_data['claude'] += int(count) if count else 0
            elif 'gemini' in llm_lower or 'bard' in llm_lower:
                llm_data['gemini'] += int(count) if count else 0
            elif 'perplexity' in llm_lower:
                llm_data['perplexity'] += int(count) if count else 0
            else:
                llm_data['others'] += int(count) if count else 0
            total += int(count) if count else 0
    
    result = {}
    for llm, count in llm_data.items():
        result[llm] = {
            "count": count,
            "percentage": round(safe_divide(count * 100, total), 1)
        }
    
    return result


@analytics_router.get("/llm/copies-by-platform")
def get_llm_copies_by_platform(
    time_range: str = "7d",
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get detailed LLM platform usage"""
    start_date, end_date = parse_time_range(time_range)
    
    llm_data = defaultdict(int)
    total = 0
    
    versions = session.exec(
        select(ContextVersion.last_llm_used, func.sum(ContextVersion.uses_count))
        .where(ContextVersion.last_used_at >= start_date)
        .where(ContextVersion.last_used_at < end_date)
        .where(ContextVersion.last_llm_used != None)
        .group_by(ContextVersion.last_llm_used)
    ).all()
    
    for llm, count in versions:
        if llm:
            display_name = categorize_llm(llm)
            if display_name != "Other":
                llm_data[display_name] += int(count) if count else 0
                total += int(count) if count else 0
            # Skip "Other" - don't include it
    
    platforms = []
    for name, copies in llm_data.items():
        platforms.append({
            "name": name,
            "site": name.lower() + ".com",
            "copies": copies,
            "percentage": round(safe_divide(copies * 100, total), 1)
        })
    
    return {"platforms": sorted(platforms, key=lambda x: x["copies"], reverse=True)}


@analytics_router.get("/llm/usage-trends")
def get_llm_usage_trends(
    time_range: str = "30d",
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get LLM usage trends over time (stacked area chart)"""
    start_date, end_date = parse_time_range(time_range)
    
    dates = []
    chatgpt_data = []
    claude_data = []
    gemini_data = []
    perplexity_data = []
    others_data = []
    
    from ..constants import LLM_DISPLAY_NAMES
    
    current = start_date
    while current < end_date:
        next_day = current + timedelta(days=1)
        dates.append(current.strftime("%Y-%m-%d"))
        
        # Get copies per LLM for this day
        versions = session.exec(
            select(ContextVersion.last_llm_used, func.sum(ContextVersion.uses_count))
            .where(ContextVersion.last_used_at >= current)
            .where(ContextVersion.last_used_at < next_day)
            .where(ContextVersion.last_llm_used != None)
            .group_by(ContextVersion.last_llm_used)
        ).all()
        
        day_data = defaultdict(int)
        for llm, count in versions:
            if llm:
                display_name = categorize_llm(llm)
                if display_name != "Other":
                    day_data[display_name] += int(count) if count else 0
                # Skip "Other" - don't track it
        
        chatgpt_data.append(day_data.get('ChatGPT', 0))
        claude_data.append(day_data.get('Claude', 0))
        gemini_data.append(day_data.get('Gemini', 0))
        perplexity_data.append(day_data.get('Perplexity', 0))
        others_data.append(0)  # No longer tracking "Other"
        
        current = next_day
    
    return {
        "dates": dates,
        "chatgpt": chatgpt_data,
        "claude": claude_data,
        "gemini": gemini_data,
        "perplexity": perplexity_data,
        "others": others_data
    }


@analytics_router.get("/llm/platform-details")
def get_llm_platform_details(
    time_range: str = "7d",
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get detailed LLM platform statistics"""
    start_date, end_date = parse_time_range(time_range)
    prev_start = start_date - (end_date - start_date)
    
    from ..constants import LLM_DISPLAY_NAMES, LLM_SITES
    
    # Get all LLM usage data
    llm_usage = session.exec(
        select(
            ContextVersion.last_llm_used,
            func.sum(ContextVersion.uses_count).label("total_copies"),
            func.count(func.distinct(ContextVersion.user_id)).label("unique_users")
        )
        .where(ContextVersion.last_used_at >= start_date)
        .where(ContextVersion.last_used_at < end_date)
        .where(ContextVersion.last_llm_used != None)
        .group_by(ContextVersion.last_llm_used)
    ).all()
    
    # Group by platform and aggregate
    platform_data = defaultdict(lambda: {"copies": 0, "user_ids": set(), "other_llms": set()})
    total_copies = 0
    
    # Get all user-LLM pairs to properly count unique users per platform
    user_llm_pairs = session.exec(
        select(
            ContextVersion.user_id,
            ContextVersion.last_llm_used
        )
        .where(ContextVersion.last_used_at >= start_date)
        .where(ContextVersion.last_used_at < end_date)
        .where(ContextVersion.last_llm_used != None)
        .distinct()
    ).all()
    
    # Map users to platforms and track "Other" LLMs
    for user_id, llm in user_llm_pairs:
        if llm:
            display_name = categorize_llm(llm)
            platform_data[display_name]["user_ids"].add(user_id)
            if display_name == "Other":
                platform_data[display_name]["other_llms"].add(llm)
    
    # Aggregate copies
    for llm, copies, _ in llm_usage:
        if llm:
            display_name = categorize_llm(llm)
            platform_data[display_name]["copies"] += int(copies) if copies else 0
            total_copies += int(copies) if copies else 0
            
            if display_name == "Other":
                platform_data[display_name]["other_llms"].add(llm)
    
    # Get previous period data for growth calculation
    prev_llm_usage = session.exec(
        select(
            ContextVersion.last_llm_used,
            func.sum(ContextVersion.uses_count).label("total_copies")
        )
        .where(ContextVersion.last_used_at >= prev_start)
        .where(ContextVersion.last_used_at < start_date)
        .where(ContextVersion.last_llm_used != None)
        .group_by(ContextVersion.last_llm_used)
    ).all()
    
    prev_platform_data = defaultdict(int)
    for llm, copies in prev_llm_usage:
        if llm:
            display_name = categorize_llm(llm)
            prev_platform_data[display_name] += int(copies) if copies else 0
    
    # Format results - exclude "Other" if it has very few copies or is empty
    result = []
    for platform, data in sorted(platform_data.items(), key=lambda x: x[1]["copies"], reverse=True):
        # Skip "Other" if it has less than 1% of total copies or no copies
        if platform == "Other":
            if data["copies"] == 0 or (total_copies > 0 and safe_divide(data["copies"] * 100, total_copies) < 1):
                continue  # Skip "Other" if it's negligible
        
        unique_users = len(data["user_ids"])
        avg_copies = safe_divide(data["copies"], unique_users) if unique_users > 0 else 0
        market_share = round(safe_divide(data["copies"] * 100, total_copies), 1) if total_copies > 0 else 0
        
        prev_copies = prev_platform_data.get(platform, 0)
        growth = calculate_percentage_change(data["copies"], prev_copies) if prev_copies > 0 else (100.0 if data["copies"] > 0 else 0.0)
        
        # For "Other" platform, include list of LLMs
        other_llms_list = list(data["other_llms"]) if platform == "Other" else []
        
        result.append({
            "platform": platform,
            "unique_users": unique_users,
            "total_copies": data["copies"],
            "avg_copies_per_user": round(avg_copies, 1),
            "market_share": market_share,
            "growth": round(growth, 1),
            "other_llms": other_llms_list  # List of LLM URLs/names in "Other"
        })
    
    return {"platforms": result}


@analytics_router.get("/llm/user-diversity")
def get_llm_user_diversity(
    time_range: str = "30d",
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get distribution of users by number of LLMs they use"""
    start_date, end_date = parse_time_range(time_range)
    
    user_llm_counts = session.exec(
        select(
            ContextVersion.user_id,
            func.count(func.distinct(ContextVersion.last_llm_used)).label("llm_count")
        )
        .where(ContextVersion.last_llm_used != None)
        .where(ContextVersion.last_used_at >= start_date)
        .where(ContextVersion.last_used_at < end_date)
        .group_by(ContextVersion.user_id)
    ).all()
    
    distribution = defaultdict(int)
    for _, count in user_llm_counts:
        if count == 1:
            distribution["1"] += 1
        elif count == 2:
            distribution["2"] += 1
        elif count == 3:
            distribution["3"] += 1
        else:
            distribution["4+"] += 1
    
    result = []
    for label in ["1", "2", "3", "4+"]:
        result.append({
            "llms": label,
            "users": distribution[label]
        })
    
    return {"distribution": result}


# ============================================================================
# DB VIEW ENDPOINTS
# ============================================================================

@analytics_router.get("/dbview/{table_name}")
def get_db_view(
    table_name: str,
    page: int = 1,
    page_size: int = 10,
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get paginated database view for admin"""
    offset = (page - 1) * page_size
    
    if table_name == "users":
        # Get total count
        total = session.exec(select(func.count(User.id))).one() or 0
        
        # Get paginated users
        users = session.exec(
            select(User)
            .order_by(User.created_at.desc())
            .offset(offset)
            .limit(page_size)
        ).all()
        
        headers = ["ID", "Email", "Email Verified", "Onboarding Completed", "Created At"]
        rows = []
        for user in users:
            rows.append([
                str(user.id)[:8] + "...",
                user.email,
                "✓" if user.email_verified else "✗",
                "✓" if user.onboarding_completed else "✗",
                user.created_at.strftime("%Y-%m-%d %H:%M") if user.created_at else ""
            ])
        
        return {"headers": headers, "rows": rows, "total": total, "page": page, "page_size": page_size}
    
    elif table_name == "contexts":
        total = session.exec(select(func.count(ContextVersion.id))).one() or 0
        
        contexts = session.exec(
            select(ContextVersion)
            .order_by(ContextVersion.created_at.desc())
            .offset(offset)
            .limit(page_size)
        ).all()
        
        headers = ["ID", "User ID", "Box Name", "Version", "Uses Count", "Last LLM", "Created At"]
        rows = []
        for ctx in contexts:
            rows.append([
                str(ctx.id)[:8] + "...",
                str(ctx.user_id)[:8] + "...",
                ctx.box_name,
                str(ctx.version_number),
                str(ctx.uses_count),
                ctx.last_llm_used or "N/A",
                ctx.created_at.strftime("%Y-%m-%d %H:%M") if ctx.created_at else ""
            ])
        
        return {"headers": headers, "rows": rows, "total": total, "page": page, "page_size": page_size}
    
    elif table_name == "feedbacks":
        total = session.exec(select(func.count(Feedback.id))).one() or 0
        
        feedbacks = session.exec(
            select(Feedback, User)
            .outerjoin(User, Feedback.user_id == User.id)
            .order_by(Feedback.created_at.desc())
            .offset(offset)
            .limit(page_size)
        ).all()
        
        headers = ["ID", "User ID", "Type", "Message", "Email", "Created At"]
        rows = []
        for fb, user in feedbacks:
            # Use user email if available, otherwise use feedback email, otherwise N/A
            email = (user.email if user else None) or fb.email or "N/A"
            rows.append([
                str(fb.id)[:8] + "...",
                str(fb.user_id)[:8] + "..." if fb.user_id else "N/A",
                fb.type,
                fb.message,  # Show full message
                email,
                fb.created_at.strftime("%Y-%m-%d %H:%M") if fb.created_at else ""
            ])
        
        return {"headers": headers, "rows": rows, "total": total, "page": page, "page_size": page_size}
    
    elif table_name == "upgrades":
        total = session.exec(select(func.count(UpgradeInterest.id))).one() or 0
        
        upgrades = session.exec(
            select(UpgradeInterest)
            .order_by(UpgradeInterest.created_at.desc())
            .offset(offset)
            .limit(page_size)
        ).all()
        
        headers = ["ID", "User ID", "Email", "Notes", "Created At"]
        rows = []
        for up in upgrades:
            rows.append([
                str(up.id)[:8] + "...",
                str(up.user_id)[:8] + "...",
                up.email,
                (up.notes[:50] + "...") if up.notes and len(up.notes) > 50 else (up.notes or "N/A"),
                up.created_at.strftime("%Y-%m-%d %H:%M") if up.created_at else ""
            ])
        
        return {"headers": headers, "rows": rows, "total": total, "page": page, "page_size": page_size}
    
    elif table_name == "analytics":
        total = session.exec(select(func.count(AnalyticsEvent.id))).one() or 0
        
        events = session.exec(
            select(AnalyticsEvent)
            .order_by(AnalyticsEvent.created_at.desc())
            .offset(offset)
            .limit(page_size)
        ).all()
        
        headers = ["ID", "User ID", "Event Type", "Retrieval Time", "Metadata", "Created At"]
        rows = []
        for event in events:
            metadata_str = json.dumps(event.event_metadata, indent=2) if event.event_metadata else "{}"
            
            retrieval_time = "N/A"
            if event.event_type == "context_retrieved" and isinstance(event.event_metadata, dict):
                retrieval_time_ms = event.event_metadata.get("retrieval_time_ms")
                if retrieval_time_ms is not None:
                    retrieval_time = f"{retrieval_time_ms}ms"
            
            rows.append([
                str(event.id)[:8] + "...",
                str(event.user_id)[:8] + "..." if event.user_id else "N/A",
                event.event_type,
                retrieval_time,
                metadata_str,
                event.created_at.strftime("%Y-%m-%d %H:%M") if event.created_at else ""
            ])
        
        return {"headers": headers, "rows": rows, "total": total, "page": page, "page_size": page_size}
    
    elif table_name == "installs":
        total = session.exec(select(func.count(InstallEvent.id))).one() or 0
        
        installs = session.exec(
            select(InstallEvent)
            .order_by(InstallEvent.created_at.desc())
            .offset(offset)
            .limit(page_size)
        ).all()
        
        headers = ["ID", "User ID", "Status", "Metadata", "Created At"]
        rows = []
        for inst in installs:
            # Show full metadata
            metadata_str = json.dumps(inst.event_metadata, indent=2) if inst.event_metadata else "{}"
            rows.append([
                str(inst.id)[:8] + "...",
                str(inst.user_id)[:8] + "..." if inst.user_id else "N/A",
                inst.status,
                metadata_str,  # Show full metadata
                inst.created_at.strftime("%Y-%m-%d %H:%M") if inst.created_at else ""
            ])
        
        return {"headers": headers, "rows": rows, "total": total, "page": page, "page_size": page_size}
    
    elif table_name == "onboarding":
        total = session.exec(select(func.count(OnboardingEvent.id))).one() or 0
        
        onboarding = session.exec(
            select(OnboardingEvent)
            .order_by(OnboardingEvent.created_at.desc())
            .offset(offset)
            .limit(page_size)
        ).all()
        
        headers = ["ID", "User ID", "Event Type", "Step Number", "Created At"]
        rows = []
        for onb in onboarding:
            rows.append([
                str(onb.id)[:8] + "...",
                str(onb.user_id)[:8] + "...",
                onb.event_type,
                str(onb.step_number) if onb.step_number else "N/A",
                onb.created_at.strftime("%Y-%m-%d %H:%M") if onb.created_at else ""
            ])
        
        return {"headers": headers, "rows": rows, "total": total, "page": page, "page_size": page_size}
    
    else:
        raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found")


# ============================================================================
# REMOVED: MONETIZATION, RETENTION, CONTENT ENDPOINTS
# These tabs were removed from the admin UI as per client request
# ============================================================================

# ============================================================================
# PERFORMANCE & RETENTION & CONTENT ENDPOINTS (Simplified)
# ============================================================================

@analytics_router.get("/performance/metrics")
def get_performance_metrics(
    time_range: str = "7d",
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get performance metrics KPIs"""
    start_date, end_date = parse_time_range(time_range)
    
    retrieval_events = session.exec(
        select(AnalyticsEvent.event_metadata)
        .where(AnalyticsEvent.created_at >= start_date)
        .where(AnalyticsEvent.created_at < end_date)
        .where(AnalyticsEvent.event_type == "context_retrieved")
    ).all()
    
    retrieval_times = []
    for event_metadata in retrieval_events:
        if isinstance(event_metadata, dict) and "retrieval_time_ms" in event_metadata:
            try:
                time_val = float(event_metadata["retrieval_time_ms"])
                if time_val is not None and not (isinstance(time_val, float) and (time_val < 0 or time_val > 100000)):
                    retrieval_times.append(time_val)
            except (ValueError, TypeError):
                pass
    
    avg_retrieval_time_ms = round(sum(retrieval_times) / len(retrieval_times), 1) if retrieval_times else None
    
    p95_retrieval_time_ms = None
    if retrieval_times:
        sorted_times = sorted(retrieval_times)
        p95_index = int(len(sorted_times) * 0.95)
        p95_retrieval_time_ms = round(sorted_times[min(p95_index, len(sorted_times) - 1)], 1)
    
    events = session.exec(
        select(AnalyticsEvent.created_at)
        .where(AnalyticsEvent.created_at >= start_date)
        .where(AnalyticsEvent.created_at < end_date)
    ).all()
    
    period_days = (end_date - start_date).days
    total_hours = period_days * 24
    
    unique_hours = set()
    for event_time in events:
        hour_key = event_time.replace(minute=0, second=0, microsecond=0)
        unique_hours.add(hour_key)
    
    hours_with_activity = len(unique_hours)
    uptime_percent = round((hours_with_activity / total_hours) * 100, 1) if total_hours > 0 else 95.0
    uptime_percent = min(100.0, uptime_percent)
    
    total_retrievals = len(retrieval_times)
    
    return {
        "avg_retrieval_time_ms": avg_retrieval_time_ms,
        "p95_retrieval_time_ms": p95_retrieval_time_ms,
        "uptime_percent": uptime_percent,
        "total_retrievals": total_retrievals,
        "hours_with_activity": hours_with_activity,
        "total_hours": total_hours
    }


@analytics_router.get("/performance/retrieval-trends")
def get_performance_retrieval_trends(
    time_range: str = "7d",
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get retrieval time trends over time"""
    start_date, end_date = parse_time_range(time_range)
    
    dates = []
    avg_times = []
    p95_times = []
    request_volumes = []
    
    current = start_date
    while current < end_date:
        next_day = current + timedelta(days=1)
        dates.append(current.strftime("%Y-%m-%d"))
        
        day_events = session.exec(
            select(AnalyticsEvent.event_metadata)
            .where(AnalyticsEvent.created_at >= current)
            .where(AnalyticsEvent.created_at < next_day)
            .where(AnalyticsEvent.event_type == "context_retrieved")
        ).all()
        
        day_times = []
        for event_metadata in day_events:
            if isinstance(event_metadata, dict) and "retrieval_time_ms" in event_metadata:
                try:
                    time_val = float(event_metadata["retrieval_time_ms"])
                    if time_val is not None and not (isinstance(time_val, float) and (time_val < 0 or time_val > 100000)):
                        day_times.append(time_val)
                except (ValueError, TypeError):
                    pass
        
        if day_times:
            filtered_times = [t for t in day_times if t <= 1000]
            if filtered_times:
                avg_time = round(sum(filtered_times) / len(filtered_times), 1)
                sorted_day_times = sorted(filtered_times)
                p95_index = int(len(sorted_day_times) * 0.95)
                p95_time = round(sorted_day_times[min(p95_index, len(sorted_day_times) - 1)], 1)
            else:
                avg_time = round(sum(day_times) / len(day_times), 1)
                sorted_day_times = sorted(day_times)
                p95_index = int(len(sorted_day_times) * 0.95)
                p95_time = round(sorted_day_times[min(p95_index, len(sorted_day_times) - 1)], 1)
        else:
            avg_time = 0
            p95_time = 0
        
        avg_times.append(avg_time)
        p95_times.append(p95_time)
        request_volumes.append(len(day_times))
        
        current = next_day
    
    return {
        "dates": dates,
        "avg_retrieval_time": avg_times,
        "p95_retrieval_time": p95_times,
        "request_volume": request_volumes
    }


@analytics_router.get("/performance/percentiles")
def get_performance_percentiles(
    time_range: str = "7d",
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get retrieval time percentiles (P50, P95, P99)"""
    start_date, end_date = parse_time_range(time_range)
    
    retrieval_events = session.exec(
        select(AnalyticsEvent.event_metadata)
        .where(AnalyticsEvent.created_at >= start_date)
        .where(AnalyticsEvent.created_at < end_date)
        .where(AnalyticsEvent.event_type == "context_retrieved")
    ).all()
    
    retrieval_times = []
    for event_metadata in retrieval_events:
        if isinstance(event_metadata, dict) and "retrieval_time_ms" in event_metadata:
            try:
                time_val = float(event_metadata["retrieval_time_ms"])
                if time_val is not None and not (isinstance(time_val, float) and (time_val < 0 or time_val > 100000)):
                    retrieval_times.append(time_val)
            except (ValueError, TypeError):
                pass
    
    if not retrieval_times:
        return {
            "p50": None,
            "p95": None,
            "p99": None,
            "min": None,
            "max": None
        }
    
    sorted_times = sorted(retrieval_times)
    
    def get_percentile(percentile):
        index = int(len(sorted_times) * percentile)
        return round(sorted_times[min(index, len(sorted_times) - 1)], 1)
    
    return {
        "p50": get_percentile(0.50),
        "p95": get_percentile(0.95),
        "p99": get_percentile(0.99),
        "min": round(min(sorted_times), 1),
        "max": round(max(sorted_times), 1)
    }


@analytics_router.get("/performance/by-box")
def get_performance_by_box(
    time_range: str = "7d",
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get retrieval time breakdown by box type"""
    start_date, end_date = parse_time_range(time_range)
    
    retrieval_events = session.exec(
        select(AnalyticsEvent.event_metadata)
        .where(AnalyticsEvent.created_at >= start_date)
        .where(AnalyticsEvent.created_at < end_date)
        .where(AnalyticsEvent.event_type == "context_retrieved")
    ).all()
    
    box_times = defaultdict(list)
    for event_metadata in retrieval_events:
        if isinstance(event_metadata, dict):
            box_name = event_metadata.get("box_name")
            retrieval_time = event_metadata.get("retrieval_time_ms")
            if box_name and retrieval_time is not None:
                try:
                    time_val = float(retrieval_time)
                    if time_val is not None and not (isinstance(time_val, float) and (time_val < 0 or time_val > 100000)):
                        box_times[box_name].append(time_val)
                except (ValueError, TypeError):
                    pass
    
    result = []
    for box_name, times in box_times.items():
        if times:
            result.append({
                "box_name": box_name,
                "avg_time_ms": round(sum(times) / len(times), 1),
                "p95_time_ms": round(sorted(times)[int(len(times) * 0.95)], 1) if times else 0,
                "count": len(times)
            })
    
    return {"breakdown": sorted(result, key=lambda x: x["avg_time_ms"], reverse=True)}


@analytics_router.get("/performance/by-llm")
def get_performance_by_llm(
    time_range: str = "7d",
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get retrieval time breakdown by LLM platform"""
    start_date, end_date = parse_time_range(time_range)
    
    retrieval_events = session.exec(
        select(AnalyticsEvent)
        .where(AnalyticsEvent.created_at >= start_date)
        .where(AnalyticsEvent.created_at < end_date)
        .where(AnalyticsEvent.event_type == "context_retrieved")
    ).all()
    
    llm_times = defaultdict(list)
    for event in retrieval_events:
        if isinstance(event.event_metadata, dict):
            retrieval_time = event.event_metadata.get("retrieval_time_ms")
            box_name = event.event_metadata.get("box_name")
            version_number = event.event_metadata.get("version_number")
            
            if box_name and event.user_id and retrieval_time is not None:
                try:
                    time_val = float(retrieval_time)
                    if time_val is not None and not (isinstance(time_val, float) and (time_val < 0 or time_val > 100000)):
                        context_version = session.exec(
                            select(ContextVersion)
                            .where(ContextVersion.user_id == event.user_id)
                            .where(ContextVersion.box_name == box_name)
                            .where(ContextVersion.version_number == (version_number if version_number else 0))
                            .limit(1)
                        ).first()
                        
                        if context_version and context_version.last_llm_used:
                            display_name = categorize_llm(context_version.last_llm_used)
                            llm_times[display_name].append(time_val)
                except (ValueError, TypeError):
                    pass
    
    result = []
    for llm_name, times in llm_times.items():
        if times:
            result.append({
                "llm_platform": llm_name,
                "avg_time_ms": round(sum(times) / len(times), 1),
                "p95_time_ms": round(sorted(times)[int(len(times) * 0.95)], 1) if times else 0,
                "count": len(times)
            })
    
    return {"breakdown": sorted(result, key=lambda x: x["avg_time_ms"], reverse=True)}


@analytics_router.get("/performance/slow-operations")
def get_performance_slow_operations(
    time_range: str = "7d",
    admin: dict = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    """Get slow retrieval operations (>1s, >5s)"""
    start_date, end_date = parse_time_range(time_range)
    
    retrieval_events = session.exec(
        select(AnalyticsEvent)
        .where(AnalyticsEvent.created_at >= start_date)
        .where(AnalyticsEvent.created_at < end_date)
        .where(AnalyticsEvent.event_type == "context_retrieved")
        .order_by(AnalyticsEvent.created_at.desc())
        .limit(100)
    ).all()
    
    slow_operations = []
    for event in retrieval_events:
        if isinstance(event.event_metadata, dict):
            retrieval_time = event.event_metadata.get("retrieval_time_ms")
            box_name = event.event_metadata.get("box_name", "Unknown")
            if retrieval_time is not None:
                try:
                    time_val = float(retrieval_time)
                    if time_val >= 1000:
                        slow_operations.append({
                            "user_id": str(event.user_id)[:8] + "..." if event.user_id else "N/A",
                            "box_name": box_name,
                            "retrieval_time_ms": round(time_val, 1),
                            "created_at": event.created_at.strftime("%Y-%m-%d %H:%M") if event.created_at else ""
                        })
                except (ValueError, TypeError):
                    pass
    
    slow_1s = [op for op in slow_operations if op["retrieval_time_ms"] >= 1000 and op["retrieval_time_ms"] < 5000]
    slow_5s = [op for op in slow_operations if op["retrieval_time_ms"] >= 5000]
    
    return {
        "slow_1s": sorted(slow_1s, key=lambda x: x["retrieval_time_ms"], reverse=True)[:20],
        "slow_5s": sorted(slow_5s, key=lambda x: x["retrieval_time_ms"], reverse=True)[:20],
        "total_slow_1s": len(slow_1s),
        "total_slow_5s": len(slow_5s)
    }


# Mount analytics router to admin router
router.include_router(analytics_router)
