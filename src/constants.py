
from enum import StrEnum


class ContextBox(StrEnum):
    CAREER = "Career"
    WORK = "Work"
    HEALTH = "Health"
    TRAVEL = "Travel"
    CUSTOM = "Custom"


class FeedbackType(StrEnum):
    BUG = "bug"
    FEATURE = "feature"
    GENERAL = "general"


class AnalyticsEventType(StrEnum):
    CONTEXT_CREATED = "context_created"
    CONTEXT_USED = "context_used"
    CONTEXT_COPIED = "context_copied"
    CONTEXT_INSERTED = "context_inserted"


class ErrorCode(StrEnum):
    EMAIL_ALREADY_EXISTS = "EMAIL_ALREADY_EXISTS"
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
    UNAUTHORIZED = "UNAUTHORIZED"
    NOT_FOUND = "NOT_FOUND"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    ENCRYPTION_ERROR = "ENCRYPTION_ERROR"
    DECRYPTION_ERROR = "DECRYPTION_ERROR"

