# memor.ai - Context Management Chrome Extension

A Chrome extension for managing and reusing context across LLM applications like ChatGPT, Claude, and other AI tools.

## Overview

memor.ai allows users to save, manage, and quickly insert predefined contexts into any web-based text input. The extension provides five default context categories (Career, Work, Health, Travel, Custom) with version control and usage analytics.

## Architecture

### Backend
- FastAPI REST API
- SQLite database with SQLModel ORM
- JWT authentication
- Fernet encryption for context storage
- Analytics tracking

### Frontend
- Chrome Extension (Manifest V3)
- Vanilla JavaScript
- Chrome Storage API for local caching
- Dashboard for analytics and version management

## Prerequisites

- Python 3.10+
- Chrome Browser
- uv (Python package installer)

## Installation

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create and activate virtual environment:
```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` and set:
- `JWT_SECRET`: Generate a secure random string
- `FERNET_KEY`: Generate using `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`

5. Start the backend server:
```bash
chmod +x run.sh
./run.sh
```

The API will be available at `http://127.0.0.1:8000`

### Extension Setup

1. Open Chrome and navigate to `chrome://extensions/`

2. Enable "Developer mode" (toggle in top right)

3. Click "Load unpacked"

4. Select the `extension` directory from this project

5. The extension icon should appear in your Chrome toolbar

## Usage

### Extension

1. Click the extension icon to open the popup

2. Register a new account or login

3. Select a context box (Career, Work, Health, Travel, or Custom)

4. Click "Edit Latest" to create or modify context

5. Use "Copy" to copy context to clipboard or "Insert" to inject into active text field

### Dashboard

1. Navigate to `http://127.0.0.1:8000/dashboard`

2. Login with your credentials

3. View usage analytics, context versions, and LLM app tracking

4. Click "View Versions" on any context box to see version history and content

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - User login

### Contexts
- `GET /api/v1/contexts` - Get all context boxes
- `POST /api/v1/contexts/{box}/versions` - Create new version
- `GET /api/v1/contexts/{box}/versions` - Get all versions for a box
- `GET /api/v1/contexts/{box}/versions/{version}` - Get specific version
- `POST /api/v1/contexts/{box}/versions/{version}/mark_used` - Mark version as used
- `POST /api/v1/contexts/decrypt` - Decrypt context text

### Analytics
- `GET /api/v1/analytics` - Get analytics events
- `POST /api/v1/analytics` - Create analytics event

### Feedback
- `POST /api/v1/feedback` - Submit feedback

## Development

### Project Structure

```
memor/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI application
│   │   ├── config.py            # Configuration
│   │   ├── database.py          # Database setup
│   │   ├── models.py            # Data models
│   │   ├── crud.py              # Database operations
│   │   ├── services/            # Business logic
│   │   └── routers/             # API routes
│   ├── requirements.txt         # Python dependencies
│   ├── pyproject.toml          # Project configuration
│   └── run.sh                  # Startup script
├── extension/
│   ├── manifest.json           # Extension configuration
│   ├── background.js           # Service worker
│   ├── content.js              # Content script
│   └── popup/                  # Popup UI
├── dashboard/
│   ├── index.html              # Dashboard UI
│   └── dashboard.js            # Dashboard logic
└── README.md
```

### Running Tests

Backend tests:
```bash
cd backend
pytest
```

### Database

The application uses SQLite for development. The database file is created automatically at `backend/dev.db`.

To reset the database:
```bash
rm backend/dev.db
```

The database will be recreated on next server start.

## Security

- All contexts are encrypted at rest using Fernet symmetric encryption
- JWT tokens for authentication
- Passwords hashed with SHA256
- CORS configured for extension origins

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| DATABASE_URL | Database connection string | sqlite:///./dev.db |
| JWT_SECRET | Secret key for JWT tokens | Required |
| FERNET_KEY | Encryption key for contexts | Required |
| API_PREFIX | API route prefix | /api/v1 |

### Extension Configuration

The extension connects to `http://localhost:8000` by default. To change this, update `API_BASE` in `extension/popup/popup.js`.

## Production Deployment

1. Generate secure secrets:
```bash
# JWT Secret
openssl rand -hex 32

# Fernet Key
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

2. Update `.env` with production values

3. Switch to PostgreSQL for production database

4. Enable HTTPS

5. Configure CORS for production domain

6. Deploy backend to cloud provider (AWS, GCP, Heroku, etc.)

7. Update extension `API_BASE` to production URL

8. Submit extension to Chrome Web Store

## Troubleshooting

### Backend won't start
- Verify virtual environment is activated
- Check `.env` file exists and has valid values
- Ensure port 8000 is not in use

### Extension not loading
- Check manifest.json syntax
- Verify all required files are present
- Check Chrome console for errors

### Save/Insert not working
- Verify backend is running
- Check authentication token is valid
- Inspect network requests in browser DevTools

## Version History

### v1.0.0
- Initial release
- Five context categories
- Version control
- Copy/Insert functionality
- Analytics dashboard
- LLM app tracking
