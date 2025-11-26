# RememberMyContext

[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.120+-green.svg)](https://fastapi.tiangolo.com/)

**RememberMyContext** is an open-source context management system for AI power users. It enables users to store their personal context once and use it across multiple LLM applications (ChatGPT, Claude, Gemini, etc.), eliminating the need to repeatedly copy-paste context information.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security](#security)
- [Links](#links)

## Overview

RememberMyContext consists of two main components:

1. **Chrome Extension**: A browser extension that automatically detects LLM platforms and provides context injection capabilities.
2. **Backend API**: A FastAPI-based REST API that handles user authentication, context storage, encryption, and analytics.

### Problem Statement

AI power users frequently switch between different LLM platforms (ChatGPT, Claude, Gemini, etc.) and must repeatedly provide the same context information. This manual process is time-consuming, error-prone, and frustrating. RememberMyContext solves this by:

- Storing context securely in encrypted format
- Providing automatic context injection across platforms
- Maintaining version history for context updates
- Offering granular control over what context is shared

## Features

### Core Functionality

- **Context Boxes**: Organize context into predefined boxes (Career, Work, Health, Travel, Custom)
- **Version Management**: Maintain multiple versions of context with automatic versioning
- **Cross-Platform Support**: Works seamlessly with ChatGPT, Claude, Gemini, and other LLM platforms
- **Secure Storage**: End-to-end encryption using Fernet (AES-128-CBC + HMAC-SHA256)
- **Analytics**: Track usage patterns, LLM platform distribution, and user engagement
- **Auto-Cleanup**: Automatic deletion of unused context versions after 30 days

### Security Features

- **Password Hashing**: Bcrypt with automatic salt generation
- **JWT Authentication**: HS256 algorithm with configurable token expiration
- **Rate Limiting**: Per-endpoint rate limits to prevent abuse
- **Input Validation**: Comprehensive Pydantic schema validation
- **Email Verification**: Optional email verification flow
- **Password Reset**: Secure token-based password reset mechanism

### User Features

- **Dashboard**: Web-based dashboard for managing contexts and viewing analytics
- **Admin Panel**: Comprehensive admin interface for monitoring and analytics
- **Onboarding Flow**: Guided onboarding experience for new users
- **Feedback System**: Built-in feedback collection mechanism

## Architecture

### Technology Stack

- **Backend Framework**: FastAPI 0.120+
- **Database**: PostgreSQL (production) / SQLite (development)
- **ORM**: SQLModel (built on SQLAlchemy)
- **Authentication**: JWT (python-jose)
- **Encryption**: Fernet (cryptography library)
- **Email Service**: Resend API
- **Rate Limiting**: SlowAPI
- **Python Version**: 3.12+

### Project Structure

```
remembermycontext/
├── src/
│   ├── main.py              # FastAPI application entry point
│   ├── config.py            # Configuration and settings management
│   ├── constants.py          # Enums and constants
│   ├── models.py            # SQLModel database models
│   ├── database.py          # Database setup and session management
│   ├── logging_config.py    # Logging configuration
│   ├── schemas/             # Pydantic request/response schemas
│   │   ├── auth.py
│   │   ├── context.py
│   │   ├── analytics.py
│   │   ├── feedback.py
│   │   ├── upgrade.py
│   │   └── onboarding.py
│   ├── services/            # Business logic services
│   │   ├── auth.py          # Authentication utilities
│   │   ├── crypto.py        # Encryption/decryption service
│   │   ├── email.py         # Email sending service
│   │   ├── verification.py # Email verification handlers
│   │   └── analytics.py     # Analytics event creation
│   ├── crud/                # Database CRUD operations
│   │   ├── user.py
│   │   ├── context.py
│   │   ├── feedback.py
│   │   ├── analytics.py
│   │   ├── upgrade.py
│   │   ├── onboarding.py
│   │   └── admin.py
│   ├── routers/             # API route handlers
│   │   ├── auth.py
│   │   ├── context.py
│   │   ├── feedback.py
│   │   ├── analytics.py
│   │   ├── upgrade.py
│   │   ├── onboarding.py
│   │   └── admin.py
│   ├── middleware/          # Custom middleware
│   │   └── rate_limit.py   # Rate limiting middleware
│   ├── templates/           # HTML email templates
│   │   ├── email_verification.html
│   │   ├── email_password_reset.html
│   │   ├── verification_success.html
│   │   ├── verification_failed.html
│   │   ├── reset_password.html
│   │   └── reset_password_invalid.html
│   ├── dashboard/           # Web dashboard static files
│   ├── admin/               # Admin panel static files
│   └── homepage/            # Marketing homepage static files
├── extension/               # Chrome extension source code
│   ├── manifest.json
│   ├── popup/
│   ├── content/
│   └── background/
├── tests/                   # Test suite
│   ├── test_auth.sh
│   ├── test_contexts.sh
│   ├── test_admin.sh
│   └── run_all_tests.sh
├── Procfile                 # Process file for deployment
├── pyproject.toml           # Python project configuration
├── uv.lock                  # Dependency lock file
└── README.md                # This file
```

### Database Schema

The application uses the following main models:

- **User**: User accounts with authentication credentials
- **ContextVersion**: Encrypted context storage with versioning
- **AnalyticsEvent**: User activity and usage tracking
- **Feedback**: User feedback submissions
- **UpgradeInterest**: Pro feature interest tracking
- **OnboardingStatus**: User onboarding progress

## Getting Started

### Prerequisites

- Python 3.12 or higher
- PostgreSQL 12+ (for production) or SQLite (for development)
- `uv` package manager (recommended) or `pip`
- Chrome browser (for extension development)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/utkarsh-iitbhu/remembermycontext.git
cd remembermycontext
```

2. **Create a virtual environment**

```bash
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

3. **Install dependencies**

Using `uv` (recommended):
```bash
uv sync
```

Or using `pip`:
```bash
pip install -e .
```

4. **Set up environment variables**

Create a `.env` file in the root directory with required variables:

```bash
# Required
JWT_SECRET=<generate-secure-random-string>
FERNET_KEY=<generate-fernett-key>
DATABASE_URL=sqlite:///./dev.db

# Email (for verification and password reset)
RESEND_API_KEY=<your-resend-api-key>
FROM_EMAIL=noreply@remembermycontext.com
FRONTEND_URL=http://localhost:8000
```

5. **Generate required secrets**

```bash
# Generate JWT secret
python3 -c "import secrets; print('JWT_SECRET=' + secrets.token_urlsafe(32))"

# Generate Fernet encryption key
python3 -c "from cryptography.fernet import Fernet; print('FERNET_KEY=' + Fernet.generate_key().decode())"
```

Add these values to your `.env` file.

6. **Set up database**

For local development, create your own database. The application uses SQLModel with automatic table creation:
- SQLite: Set `DATABASE_URL=sqlite:///./dev.db` in `.env` (default)
- PostgreSQL: Set `DATABASE_URL=postgresql://user:password@host:5432/dbname` in `.env`

Tables are automatically created on first run.

7. **Run the development server**

```bash
uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

The API will be available at:
- **API Base**: `http://127.0.0.1:8000/api/v1`
- **API Documentation**: `http://127.0.0.1:8000/docs`
- **Alternative Docs**: `http://127.0.0.1:8000/redoc`
- **Health Check**: `http://127.0.0.1:8000/health`

## Configuration

### Environment Variables

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT token signing | Generated random string |
| `FERNET_KEY` | Encryption key for context data | Generated Fernet key |
| `DATABASE_URL` | Database connection string | `sqlite:///./dev.db` or `postgresql://user:pass@host:5432/db` |

#### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_PREFIX` | API route prefix | `/api/v1` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT token expiration time | `10080` (7 days) |
| `LOG_LEVEL` | Logging level | `INFO` |
| `RATE_LIMIT_PER_MINUTE` | Global rate limit | `60` |
| `MAX_CONTEXT_LENGTH` | Maximum context length | `50000` |
| `RESEND_API_KEY` | Resend API key for emails | - |
| `FROM_EMAIL` | Sender email address | `noreply@remembermycontext.com` |
| `FRONTEND_URL` | Frontend application URL | `http://localhost:8000` |
| `EMAIL_VERIFICATION_REQUIRED` | Require email verification | `false` |
| `ENABLE_ONBOARDING` | Enable onboarding flow | `true` |
| `ENABLE_PASSWORD_RESET` | Enable password reset | `true` |
| `VERSION_AUTO_DELETE_DAYS` | Days before auto-deleting unused versions | `30` |
| `VERSION_CLEANUP_HOUR` | Hour (UTC) for daily cleanup | `3` |
| `ADMIN_USERNAME` | Admin panel username | `admin` |
| `ADMIN_PASSWORD` | Admin panel password | - |
| `ALLOWED_ORIGINS` | CORS allowed origins (comma-separated) | - |

### Database Configuration

#### Development (SQLite)

```env
DATABASE_URL=sqlite:///./dev.db
```

#### Production (PostgreSQL)

```env
DATABASE_URL=postgresql://username:password@host:5432/database_name
```

## API Documentation

### Authentication

All endpoints (except registration, login, password reset, and email verification) require authentication via JWT token:

```http
Authorization: Bearer <access_token>
```

### Endpoints

#### Authentication

- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/change-password` - Change password (authenticated)
- `POST /api/v1/auth/forgot-password` - Request password reset
- `POST /api/v1/auth/reset-password` - Reset password with token
- `POST /api/v1/auth/resend-verification` - Resend verification email
- `POST /api/v1/auth/verify-email` - Verify email with token
- `DELETE /api/v1/auth/request-deletion` - Request account deletion
- `DELETE /api/v1/auth/cancel-deletion` - Cancel account deletion
- `GET /api/v1/auth/check-deletion` - Check deletion status

#### Contexts

- `GET /api/v1/contexts` - Get all context boxes summary
- `POST /api/v1/contexts/{box_name}/versions` - Create new context version
- `GET /api/v1/contexts/{box_name}/versions` - Get all versions for a box
- `GET /api/v1/contexts/{box_name}/versions/{version_number}` - Get specific version
- `POST /api/v1/contexts/{box_name}/versions/{version_number}/mark_used` - Mark version as used
- `POST /api/v1/contexts/decrypt` - Decrypt context ciphertext

**Supported Box Names**: `Career`, `Work`, `Health`, `Travel`, `Custom`

#### Analytics

- `GET /api/v1/analytics?limit=50` - Get analytics events
- `POST /api/v1/analytics` - Create analytics event

#### Feedback

- `POST /api/v1/feedback` - Submit feedback

**Feedback Types**: `bug`, `feature`, `improvement`, `other`

#### Onboarding

- `GET /api/v1/onboarding/status` - Get onboarding status
- `POST /api/v1/onboarding/complete` - Complete onboarding

#### Admin (Requires Admin Authentication)

See the interactive API documentation at `/docs` for complete admin endpoint documentation.

### Rate Limiting

- Registration: 30 requests/minute
- Login: 60 requests/minute
- Password Reset: 3 requests/hour
- Other endpoints: Configurable via `RATE_LIMIT_PER_MINUTE`

### Password Requirements

- Minimum 8 characters
- At least one letter (a-z, A-Z)
- At least one digit (0-9)

## Development

### Git Branches

- `main` - Development branch
- `prod` - Production branch

### Running in Development Mode

```bash
# Activate virtual environment
source .venv/bin/activate

# Run with auto-reload
uvicorn src.main:app --reload --host 127.0.0.1 --port 8000

# Or use the provided script
./start.sh
```

### Background Tasks

The application includes a background task for automatic cleanup of unused context versions:

- Runs daily at the configured hour (default: 3 AM UTC)
- Deletes context versions unused for 30+ days
- Based on `last_used_at` field, or `created_at` if never used
- Logs all cleanup operations
- Implemented in `src/main.py` in the `lifespan` event handler

## Testing

### Running Tests

```bash
# Run all tests
cd tests
./run_all_tests.sh

# Run individual test suites
./test_auth.sh
./test_contexts.sh
./test_admin.sh
```

## Deployment

### Render.com

Deployment is configured via branch-based auto-deployment on Render.com.

1. **Create a Render account** and connect your repository
2. **Set the deployment branch** to `main` (development) or `prod` (production)
3. **Configure environment variables** in the Render dashboard
4. **Push to the configured branch** - Render automatically builds and deploys

The application uses automatic table creation via SQLModel, so no migrations are needed.

### Manual Deployment

1. **Set up production database** (PostgreSQL recommended)
2. **Configure all environment variables**
3. **Install dependencies**: `pip install -e .` or `uv sync`
4. **Start the server**: `uvicorn src.main:app --host 0.0.0.0 --port $PORT`

Tables are automatically created on first run.

## Security

- **Encryption**: All context data is encrypted using Fernet (AES-128-CBC + HMAC-SHA256)
- **Password Hashing**: Bcrypt with automatic salt generation
- **JWT Tokens**: Secure token-based authentication
- **CORS**: Configurable CORS policies
- **Rate Limiting**: Per-endpoint rate limits

## Links

- **Chrome Web Store**: [Install Extension](https://chromewebstore.google.com/detail/nbejjpdcfohobpanabandnpaldklgjfn)
- **Website**: [remembermycontext.com](https://remembermycontext.com)
- **API Documentation**: [API Docs](https://remembermycontext.com/docs)

---

**RememberMyContext** - Never repeat yourself again.
