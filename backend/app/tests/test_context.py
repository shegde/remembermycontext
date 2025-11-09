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

def test_create_and_retrieve_context():
    response = client.post("/api/v1/auth/register", json={
        "email": "test3@example.com",
        "password": "testpassword"
    })
    
    response = client.post("/api/v1/auth/login", json={
        "email": "test3@example.com",
        "password": "testpassword"
    })
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    response = client.post("/api/v1/contexts/Career/versions", 
                          json={"text": "Test context content"}, 
                          headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "version_number" in data
    assert "created_at" in data
    
    response = client.get("/api/v1/contexts", headers=headers)
    assert response.status_code == 200
    contexts = response.json()
    assert len(contexts) > 0
