# RememberMyContext

Context Management Chrome Extension for LLM Applications

## Quick Start

### 1. Setup Environment

```bash
cd /home/lordsahu/memor-ai-extension
source .venv/bin/activate
```

### 2. Install Dependencies

```bash
uv pip install -e .
```

### 3. Configure Environment Variables

Create `.env` file:

```bash
cp .env.example .env
```

Generate secrets:

```bash
python3 -c "import secrets; print('JWT_SECRET=' + secrets.token_urlsafe(32))"
python3 -c "from cryptography.fernet import Fernet; print('FERNET_KEY=' + Fernet.generate_key().decode())"
```

Update `.env` with generated values.

### 4. Run Server

```bash
./run.sh
```

Or manually:

```bash
uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

## Access Points

- API: http://127.0.0.1:8000
- Docs: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/health

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register user
- `POST /api/v1/auth/login` - Login user

### Contexts
- `GET /api/v1/contexts` - Get all contexts
- `POST /api/v1/contexts/{box_name}/versions` - Create version
- `GET /api/v1/contexts/{box_name}/versions` - Get versions
- `GET /api/v1/contexts/{box_name}/versions/{version}` - Get specific version
- `POST /api/v1/contexts/{box_name}/versions/{version}/mark_used` - Mark as used
- `POST /api/v1/contexts/decrypt` - Decrypt context

### Analytics
- `GET /api/v1/analytics` - Get events
- `POST /api/v1/analytics` - Create event

### Feedback
- `POST /api/v1/feedback` - Submit feedback

## Testing

```bash
python test_server.py
```

## Production Database

For production, use PostgreSQL:

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

Recommended providers:
- Supabase (free tier)
- Neon (serverless)
- AWS RDS
- DigitalOcean

## Project Structure

```
src/
├── main.py           # FastAPI app
├── config.py         # Configuration
├── constants.py      # Enums and constants
├── models.py         # Database models
├── database.py       # Database setup
├── logging_config.py # Logging setup
├── schemas/          # Pydantic schemas
├── services/         # Business logic
├── crud/             # Database operations
├── routers/          # API routes
└── middleware/       # Rate limiting, etc
```

## Features

- JWT Authentication
- Bcrypt Password Hashing
- Fernet Encryption
- Rate Limiting
- Input Validation
- Structured Logging
- Health Checks
- PostgreSQL Ready

## Security

- Passwords hashed with bcrypt
- Contexts encrypted with Fernet
- JWT token authentication
- Rate limiting enabled
- Input validation with Pydantic

