
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
    COMPLIMENT = "compliment"


class AnalyticsEventType(StrEnum):
    CONTEXT_CREATED = "context_created"
    CONTEXT_USED = "context_used"
    CONTEXT_COPIED = "context_copied"
    CONTEXT_INSERTED = "context_inserted"
    EXTENSION_INSTALLED = "extension_installed"
    ONBOARDING_STARTED = "onboarding_started"
    ONBOARDING_STEP_COMPLETED = "onboarding_step_completed"
    ONBOARDING_SKIPPED = "onboarding_skipped"
    DASHBOARD_VISITED = "dashboard_visited"
    UPGRADE_PAGE_VIEWED = "upgrade_page_viewed"


class ErrorCode(StrEnum):
    EMAIL_ALREADY_EXISTS = "EMAIL_ALREADY_EXISTS"
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
    UNAUTHORIZED = "UNAUTHORIZED"
    NOT_FOUND = "NOT_FOUND"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    ENCRYPTION_ERROR = "ENCRYPTION_ERROR"
    DECRYPTION_ERROR = "DECRYPTION_ERROR"
    INVALID_TOKEN = "INVALID_TOKEN"
    FEATURE_DISABLED = "FEATURE_DISABLED"


# LLM Platforms supported by the extension
LLM_SITES = [
    'chatgpt.com',
    'claude.ai',
    'anthropic.com',
    'openai.com',
    'bard.google.com',
    'gemini.google.com',
    'perplexity.ai',
    'poe.com',
    'character.ai',
    'you.com',
    'phind.com',
    'copilot.microsoft.com',
    'bing.com'
]

# Mapping of LLM site patterns to display names
LLM_DISPLAY_NAMES = {
    'chatgpt.com': 'ChatGPT',
    'openai.com': 'ChatGPT',
    'claude.ai': 'Claude',
    'anthropic.com': 'Claude',
    'gemini.google.com': 'Gemini',
    'bard.google.com': 'Gemini',
    'perplexity.ai': 'Perplexity',
    'poe.com': 'Poe',
    'character.ai': 'Character.ai',
    'you.com': 'You.com',
    'phind.com': 'Phind',
    'copilot.microsoft.com': 'Copilot',
    'bing.com': 'Bing'
}

