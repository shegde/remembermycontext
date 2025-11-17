#!/usr/bin/env python3
"""
Simple Database Viewer for memor-ai-extension
View all tables and their data in a readable format
"""
import sys
from pathlib import Path
from sqlmodel import Session, select, func
from datetime import datetime

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from src.database import engine
from src.models import (
    User, ContextVersion, AnalyticsEvent, Feedback, 
    UpgradeInterest, Admin, InstallEvent, OnboardingEvent
)

def format_datetime(dt):
    if dt is None:
        return "None"
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    return str(dt)

def print_table_header(name, count):
    print("\n" + "="*80)
    print(f"📊 {name.upper()} ({count} records)")
    print("="*80)

def view_users(session):
    users = session.exec(select(User)).all()
    print_table_header("Users", len(users))
    if not users:
        print("No users found")
        return
    
    for user in users:
        print(f"\n  ID: {user.id}")
        print(f"  Email: {user.email}")
        print(f"  Email Verified: {user.email_verified}")
        print(f"  Onboarding Completed: {user.onboarding_completed}")
        print(f"  Created At: {format_datetime(user.created_at)}")

def view_context_versions(session):
    versions = session.exec(select(ContextVersion)).all()
    print_table_header("Context Versions", len(versions))
    if not versions:
        print("No context versions found")
        return
    
    for v in versions:
        print(f"\n  ID: {v.id}")
        print(f"  User ID: {v.user_id}")
        print(f"  Box Name: {v.box_name}")
        print(f"  Version: {v.version_number}")
        print(f"  Uses Count: {v.uses_count}")
        print(f"  Last Used At: {format_datetime(v.last_used_at)}")
        print(f"  Last LLM Used: {v.last_llm_used}")
        print(f"  Created At: {format_datetime(v.created_at)}")

def view_analytics_events(session):
    events = session.exec(select(AnalyticsEvent).order_by(AnalyticsEvent.created_at.desc()).limit(50)).all()
    total = session.exec(select(func.count(AnalyticsEvent.id))).one()
    print_table_header("Analytics Events", total)
    print(f"Showing last 50 of {total} events")
    
    if not events:
        print("No analytics events found")
        return
    
    # Group by event type
    event_types = {}
    for event in events:
        event_type = event.event_type
        if event_type not in event_types:
            event_types[event_type] = []
        event_types[event_type].append(event)
    
    for event_type, type_events in event_types.items():
        print(f"\n  📈 {event_type} ({len(type_events)} events):")
        for event in type_events[:5]:  # Show first 5 of each type
            print(f"    - User: {event.user_id}, Created: {format_datetime(event.created_at)}")
            if event.metadata:
                print(f"      Metadata: {event.metadata}")

def view_feedback(session):
    feedbacks = session.exec(select(Feedback).order_by(Feedback.created_at.desc())).all()
    print_table_header("Feedback", len(feedbacks))
    if not feedbacks:
        print("No feedback found")
        return
    
    for f in feedbacks:
        print(f"\n  ID: {f.id}")
        print(f"  User ID: {f.user_id}")
        print(f"  Type: {f.type}")
        print(f"  Message: {f.message[:100]}..." if len(f.message) > 100 else f"  Message: {f.message}")
        print(f"  Created At: {format_datetime(f.created_at)}")

def view_upgrade_interest(session):
    interests = session.exec(select(UpgradeInterest)).all()
    print_table_header("Upgrade Interest", len(interests))
    if not interests:
        print("No upgrade interest records found")
        return
    
    for i in interests:
        print(f"\n  ID: {i.id}")
        print(f"  User ID: {i.user_id}")
        print(f"  Created At: {format_datetime(i.created_at)}")

def view_admins(session):
    admins = session.exec(select(Admin)).all()
    print_table_header("Admins", len(admins))
    if not admins:
        print("No admins found")
        return
    
    for admin in admins:
        print(f"\n  ID: {admin.id}")
        print(f"  Username: {admin.username}")
        print(f"  Created At: {format_datetime(admin.created_at)}")

def view_install_events(session):
    events = session.exec(select(InstallEvent).order_by(InstallEvent.created_at.desc())).all()
    print_table_header("Install Events", len(events))
    if not events:
        print("No install events found")
        return
    
    for event in events:
        print(f"\n  ID: {event.id}")
        print(f"  User ID: {event.user_id}")
        print(f"  Status: {event.status}")
        print(f"  Created At: {format_datetime(event.created_at)}")

def view_onboarding_events(session):
    events = session.exec(select(OnboardingEvent).order_by(OnboardingEvent.created_at.desc())).all()
    print_table_header("Onboarding Events", len(events))
    if not events:
        print("No onboarding events found")
        return
    
    # Group by event type
    event_types = {}
    for event in events:
        event_type = event.event_type
        if event_type not in event_types:
            event_types[event_type] = []
        event_types[event_type].append(event)
    
    for event_type, type_events in event_types.items():
        print(f"\n  📋 {event_type} ({len(type_events)} events):")
        for event in type_events[:10]:  # Show first 10 of each type
            print(f"    - User: {event.user_id}, Step: {event.step_number}, Created: {format_datetime(event.created_at)}")

def view_summary_stats(session):
    print("\n" + "="*80)
    print("📈 SUMMARY STATISTICS")
    print("="*80)
    
    total_users = session.exec(select(func.count(User.id))).one()
    total_versions = session.exec(select(func.count(ContextVersion.id))).one()
    total_analytics = session.exec(select(func.count(AnalyticsEvent.id))).one()
    total_feedback = session.exec(select(func.count(Feedback.id))).one()
    total_upgrade_interest = session.exec(select(func.count(UpgradeInterest.id))).one()
    
    print(f"\n  Total Users: {total_users}")
    print(f"  Total Context Versions: {total_versions}")
    print(f"  Total Analytics Events: {total_analytics}")
    print(f"  Total Feedback: {total_feedback}")
    print(f"  Total Upgrade Interest: {total_upgrade_interest}")
    
    # Analytics by type
    if total_analytics > 0:
        print(f"\n  Analytics Events by Type:")
        event_types = session.exec(
            select(AnalyticsEvent.event_type, func.count(AnalyticsEvent.id))
            .group_by(AnalyticsEvent.event_type)
        ).all()
        for event_type, count in event_types:
            print(f"    - {event_type}: {count}")

def main():
    print("\n" + "="*80)
    print("🗄️  MEMOR-AI-EXTENSION DATABASE VIEWER")
    print("="*80)
    
    with Session(engine) as session:
        view_summary_stats(session)
        view_users(session)
        view_context_versions(session)
        view_analytics_events(session)
        view_feedback(session)
        view_upgrade_interest(session)
        view_admins(session)
        view_install_events(session)
        view_onboarding_events(session)
    
    print("\n" + "="*80)
    print("✅ Database view complete")
    print("="*80 + "\n")

if __name__ == "__main__":
    main()

