import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, create_engine, SQLModel
from app.main import app
from app.database import get_session

engine = create_engine("sqlite:///./test.db", connect_args={"check_same_thread": False})
SQLModel.metadata.create_all(engine)

def get_test_session():
    with Session(engine) as session:
        yield session

app.dependency_overrides[get_session] = get_test_session

client = TestClient(app)

def test_register_and_login():
    response = client.post("/api/v1/auth/register", json={
        "email": "test@example.com",
        "password": "testpassword"
    })
    assert response.status_code == 200
    assert response.json() == {"ok": True}
    
    response = client.post("/api/v1/auth/login", json={
        "email": "test@example.com",
        "password": "testpassword"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_protected_endpoint():
    response = client.post("/api/v1/auth/register", json={
        "email": "test2@example.com",
        "password": "testpassword"
    })
    
    response = client.post("/api/v1/auth/login", json={
        "email": "test2@example.com",
        "password": "testpassword"
    })
    token = response.json()["access_token"]
    
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/contexts", headers=headers)
    assert response.status_code == 200
