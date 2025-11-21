
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
    EMAIL_NOT_VERIFIED = "EMAIL_NOT_VERIFIED"
    UNAUTHORIZED = "UNAUTHORIZED"
    NOT_FOUND = "NOT_FOUND"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    ENCRYPTION_ERROR = "ENCRYPTION_ERROR"
    DECRYPTION_ERROR = "DECRYPTION_ERROR"
    INVALID_TOKEN = "INVALID_TOKEN"
    FEATURE_DISABLED = "FEATURE_DISABLED"


LLM_SITES = [
    'chatgpt.com',
    'chat.openai.com',
    'openai.com',
    'platform.openai.com',
    'claude.ai',
    'chat.anthropic.com',
    'anthropic.com',
    'gemini.google.com',
    'bard.google.com',
    'deepmind.google',
    'ai.google.dev',
    'meta.ai',
    'llama.meta.com',
    'x.ai',
    'grok.x.ai',
    'mistral.ai',
    'chat.mistral.ai',
    'console.mistral.ai',
    'deepseek.com',
    'platform.deepseek.com',
    'cohere.com',
    'dashboard.cohere.com',
    'qwen.ai',
    'tongyi.aliyun.com',
    'yiyan.baidu.com',
    'baidu.com',
    'zhipu.ai',
    'chatglm.cn',
    'sensetime.com',
    'chat.sensetime.com',
    'xinghuo.xfyun.cn',
    'huawei.com',
    'ai21.com',
    'studio.ai21.com',
    'stability.ai',
    'aleph-alpha.com',
    'reka.ai',
    'writer.com',
    'snowflake.com',
    'databricks.com',
    'mosaicml.com',
    'perplexity.ai',
    'www.perplexity.ai',
    'poe.com',
    'character.ai',
    'you.com',
    'phind.com',
    'www.phind.com',
    'copilot.microsoft.com',
    'bing.com',
    'www.bing.com'
]

LLM_DISPLAY_NAMES = {
    'chat.openai.com': 'ChatGPT',
    'platform.openai.com': 'ChatGPT',
    'chatgpt.com': 'ChatGPT',
    'openai.com': 'ChatGPT',
    'chat.anthropic.com': 'Claude',
    'claude.ai': 'Claude',
    'anthropic.com': 'Claude',
    'gemini.google.com': 'Gemini',
    'bard.google.com': 'Gemini',
    'deepmind.google': 'Gemini',
    'ai.google.dev': 'Gemini',
    'meta.ai': 'Llama',
    'llama.meta.com': 'Llama',
    'grok.x.ai': 'Grok',
    'x.ai': 'Grok',
    'chat.mistral.ai': 'Mistral',
    'console.mistral.ai': 'Mistral',
    'mistral.ai': 'Mistral',
    'platform.deepseek.com': 'DeepSeek',
    'deepseek.com': 'DeepSeek',
    'dashboard.cohere.com': 'Cohere',
    'cohere.com': 'Cohere',
    'qwen.ai': 'Qwen',
    'tongyi.aliyun.com': 'Qwen',
    'yiyan.baidu.com': 'ERNIE',
    'baidu.com': 'ERNIE',
    'chatglm.cn': 'ChatGLM',
    'zhipu.ai': 'ChatGLM',
    'chat.sensetime.com': 'SenseNova',
    'sensetime.com': 'SenseNova',
    'xinghuo.xfyun.cn': 'Xinghuo',
    'huawei.com': 'Pangu',
    'studio.ai21.com': 'AI21',
    'ai21.com': 'AI21',
    'stability.ai': 'StableLM',
    'aleph-alpha.com': 'Luminous',
    'reka.ai': 'Reka',
    'writer.com': 'Palmyra',
    'snowflake.com': 'Arctic',
    'databricks.com': 'DBRX',
    'mosaicml.com': 'MPT',
    'perplexity.ai': 'Perplexity',
    'www.perplexity.ai': 'Perplexity',
    'poe.com': 'Poe',
    'character.ai': 'Character.ai',
    'you.com': 'You.com',
    'phind.com': 'Phind',
    'www.phind.com': 'Phind',
    'copilot.microsoft.com': 'Copilot',
    'bing.com': 'Bing',
    'www.bing.com': 'Bing'
}

