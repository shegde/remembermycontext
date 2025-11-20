#!/usr/bin/env bash

cd "$(dirname "$0")"

if [ ! -f ".env" ]; then
    echo "❌ .env file not found"
    echo ""
    echo "Generate secrets:"
    echo "python3 -c \"import secrets; print('JWT_SECRET=' + secrets.token_urlsafe(32))\""
    echo "python3 -c \"from cryptography.fernet import Fernet; print('FERNET_KEY=' + Fernet.generate_key().decode())\""
    echo ""
    echo "Then create .env file with those values"
    exit 1
fi

source .venv/bin/activate
echo "🚀 Starting RememberMyContext API on http://127.0.0.1:8000"
echo "📚 API Docs: http://127.0.0.1:8000/docs"
echo ""
uvicorn src.main:app --reload --host 127.0.0.1 --port 8000

