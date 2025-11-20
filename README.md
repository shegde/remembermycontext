# RememberMyContext API

Context Management API for Chrome Extension - Store and manage context information across LLM applications.

## Quick Start

### Setup Environment

```bash
python3 -m venv .venv
uv sync
source .venv/bin/activate
```

### Configure Environment Variables

Create `.env` file with required variables:

```bash
# Required
JWT_SECRET=<generate-secure-random-string>
FERNET_KEY=<generate-fernett-key>
DATABASE_URL=sqlite:///./dev.db

# Email (for verification and password reset)
RESEND_API_KEY=<your-resend-api-key>
FROM_EMAIL=noreply@remembermycontext.com
FRONTEND_URL=http://localhost:8000

# Optional
EMAIL_VERIFICATION_REQUIRED=true
ACCESS_TOKEN_EXPIRE_MINUTES=10080
```

Generate secrets:
```bash
python3 -c "import secrets; print('JWT_SECRET=' + secrets.token_urlsafe(32))"
python3 -c "from cryptography.fernet import Fernet; print('FERNET_KEY=' + Fernet.generate_key().decode())"
```

### Run Server

```bash
uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

## Access Points

- **API Base**: `http://127.0.0.1:8000/api/v1`
- **API Docs**: `http://127.0.0.1:8000/docs`
- **Health Check**: `http://127.0.0.1:8000/health`

## API Endpoints

### Authentication

- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/change-password` - Change password (authenticated)
- `POST /api/v1/auth/forgot-password` - Request password reset
- `POST /api/v1/auth/reset-password` - Reset password with token
- `POST /api/v1/auth/resend-verification` - Resend verification email
- `POST /api/v1/auth/verify-email` - Verify email with token
- `DELETE /api/v1/auth/request-deletion` - Request account deletion (authenticated)
- `DELETE /api/v1/auth/cancel-deletion` - Cancel account deletion (authenticated)
- `GET /api/v1/auth/check-deletion` - Check deletion status (authenticated)

### Contexts

- `GET /api/v1/contexts` - Get all context boxes summary (authenticated)
- `POST /api/v1/contexts/{box_name}/versions` - Create new context version (authenticated)
- `GET /api/v1/contexts/{box_name}/versions` - Get all versions for a box (authenticated)
- `GET /api/v1/contexts/{box_name}/versions/{version_number}` - Get specific version (authenticated)
- `POST /api/v1/contexts/{box_name}/versions/{version_number}/mark_used` - Mark version as used (authenticated)
- `POST /api/v1/contexts/decrypt` - Decrypt context ciphertext (authenticated)

**Box Names**: `Career`, `Work`, `Health`, `Travel`, `Custom`

### Analytics

- `GET /api/v1/analytics?limit=50` - Get analytics events (authenticated)
- `POST /api/v1/analytics` - Create analytics event (authenticated)

### Feedback

- `POST /api/v1/feedback` - Submit feedback (authenticated)

**Types**: `bug`, `feature`, `improvement`, `other`

### Onboarding

- `GET /api/v1/onboarding/status` - Get onboarding status (authenticated)
- `POST /api/v1/onboarding/complete` - Complete onboarding (authenticated)

### Upgrade Interest

- `POST /api/v1/upgrade/express-interest` - Express interest in Pro features (authenticated)
- `GET /api/v1/upgrade/check-interest` - Check if user expressed interest (authenticated)

### Admin (Requires Admin Authentication)

#### Admin Authentication
- `POST /api/v1/admin/login` - Admin login

#### Overview Analytics
- `GET /api/v1/admin/analytics/overview/kpis?time_range=7d`
- `GET /api/v1/admin/analytics/overview/insights?time_range=7d`
- `GET /api/v1/admin/analytics/overview/growth-timeline?time_range=30d`
- `GET /api/v1/admin/analytics/overview/context-box-distribution?time_range=7d`
- `GET /api/v1/admin/analytics/overview/llm-distribution?time_range=7d`
- `GET /api/v1/admin/analytics/overview/user-lifecycle`
- `GET /api/v1/admin/analytics/overview/performance-health`

#### Acquisition Analytics
- `GET /api/v1/admin/analytics/acquisition/metrics?time_range=7d`
- `GET /api/v1/admin/analytics/acquisition/funnel?time_range=7d`
- `GET /api/v1/admin/analytics/acquisition/growth-timeline?time_range=30d`
- `GET /api/v1/admin/analytics/acquisition/churn`
- `GET /api/v1/admin/analytics/acquisition/signup-patterns?time_range=7d`

#### Engagement Analytics
- `GET /api/v1/admin/analytics/engagement/metrics?time_range=7d`
- `GET /api/v1/admin/analytics/engagement/copy-activity-timeline?time_range=7d`
- `GET /api/v1/admin/analytics/engagement/context-box-usage?time_range=7d`
- `GET /api/v1/admin/analytics/engagement/version-stats`
- `GET /api/v1/admin/analytics/engagement/power-users?time_range=7d&limit=5`
- `GET /api/v1/admin/analytics/engagement/onboarding-funnel`

#### Feature Adoption Analytics
- `GET /api/v1/admin/analytics/features/metrics?time_range=7d`
- `GET /api/v1/admin/analytics/features/adoption-breakdown?time_range=7d`
- `GET /api/v1/admin/analytics/features/boxes-per-user`
- `GET /api/v1/admin/analytics/features/version-distribution`
- `GET /api/v1/admin/analytics/features/box-ratio`
- `GET /api/v1/admin/analytics/features/power-user-stats?time_range=7d`
- `GET /api/v1/admin/analytics/features/adoption-timeline?time_range=30d`

#### LLM Integration Analytics
- `GET /api/v1/admin/analytics/llm/metrics?time_range=7d`
- `GET /api/v1/admin/analytics/llm/platform-distribution?time_range=7d`
- `GET /api/v1/admin/analytics/llm/copies-by-platform?time_range=7d`
- `GET /api/v1/admin/analytics/llm/usage-trends?time_range=30d`
- `GET /api/v1/admin/analytics/llm/platform-details?time_range=7d`
- `GET /api/v1/admin/analytics/llm/user-diversity?time_range=30d`

#### Performance Analytics
- `GET /api/v1/admin/analytics/performance/metrics?time_range=7d`
- `GET /api/v1/admin/analytics/performance/retrieval-trends?time_range=7d`
- `GET /api/v1/admin/analytics/performance/percentiles?time_range=7d`
- `GET /api/v1/admin/analytics/performance/by-box?time_range=7d`
- `GET /api/v1/admin/analytics/performance/by-llm?time_range=7d`
- `GET /api/v1/admin/analytics/performance/slow-operations?time_range=7d`

#### Database Views
- `GET /api/v1/admin/analytics/dbview/users?page=1&page_size=10`
- `GET /api/v1/admin/analytics/dbview/contexts?page=1&page_size=10`
- `GET /api/v1/admin/analytics/dbview/feedbacks?page=1&page_size=10`
- `GET /api/v1/admin/analytics/dbview/upgrades?page=1&page_size=10`
- `GET /api/v1/admin/analytics/dbview/analytics?page=1&page_size=10`

**Time Range Options**: `24h`, `7d`, `30d`, `90d`, `all_time`

## Authentication

All endpoints (except registration, login, password reset, and email verification) require authentication via JWT token:

```http
Authorization: Bearer <access_token>
```

Tokens expire after the configured time (default: 1 week). Use the login endpoint to obtain a new token.

## Password Requirements

- Minimum 8 characters
- At least one letter (a-z, A-Z)
- At least one digit (0-9)

## Rate Limiting

- Registration: 30 requests/minute
- Login: 60 requests/minute
- Password Reset: 3 requests/hour

## Testing

Run the complete test suite:

```bash
cd tests
./run_all_tests.sh
```

Run individual test suites:

```bash
./test_auth.sh
./test_contexts.sh
./test_admin.sh
```

## Project Structure

```
src/
├── main.py              # FastAPI application entry point
├── config.py            # Configuration and settings
├── constants.py         # Enums and constants
├── models.py            # SQLModel database models
├── database.py          # Database setup and session management
├── logging_config.py    # Logging configuration
├── schemas/             # Pydantic request/response schemas
│   ├── auth.py
│   ├── context.py
│   ├── analytics.py
│   ├── feedback.py
│   ├── upgrade.py
│   └── onboarding.py
├── services/            # Business logic services
│   ├── auth.py         # Authentication utilities
│   ├── email.py        # Email sending service
│   ├── verification.py # Email verification handlers
│   └── analytics.py    # Analytics event creation
├── crud/                # Database CRUD operations
│   ├── user.py
│   ├── context.py
│   ├── feedback.py
│   ├── analytics.py
│   ├── upgrade.py
│   ├── onboarding.py
│   └── admin.py
├── routers/             # API route handlers
│   ├── auth.py
│   ├── context.py
│   ├── feedback.py
│   ├── analytics.py
│   ├── upgrade.py
│   ├── onboarding.py
│   └── admin.py
├── middleware/          # Middleware (rate limiting)
└── templates/           # HTML email templates
    ├── email_verification.html
    ├── email_password_reset.html
    ├── verification_success.html
    ├── verification_failed.html
    ├── reset_password.html
    └── reset_password_invalid.html
```

## Database

### Development
Uses SQLite by default: `sqlite:///./dev.db`

### Production
Configure PostgreSQL:
```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

## Security Features

- **Password Hashing**: Bcrypt with automatic salt generation
- **Context Encryption**: Fernet symmetric encryption (AES-128)
- **JWT Authentication**: HS256 algorithm with configurable expiration
- **Rate Limiting**: Per-endpoint rate limits to prevent abuse
- **Input Validation**: Pydantic schemas for all inputs
- **Email Verification**: Optional email verification flow
- **Password Reset**: Secure token-based password reset

## Error Codes

Common error codes returned in error responses:

- `EMAIL_ALREADY_EXISTS`: Email is already registered
- `INVALID_CREDENTIALS`: Wrong email or password
- `EMAIL_NOT_VERIFIED`: Email verification required
- `INVALID_TOKEN`: Token is invalid or expired
- `VALIDATION_ERROR`: Input validation failed
- `NOT_FOUND`: Resource not found
- `DECRYPTION_ERROR`: Failed to decrypt context
- `FEATURE_DISABLED`: Feature is disabled in configuration
