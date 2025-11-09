from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from app.database import create_db_and_tables
from app.routers import auth_router, context_router, feedback_router, analytics_router
from app.config import settings

app = FastAPI(title="Context Saver API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "chrome-extension://*",
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router, prefix=settings.API_PREFIX)
app.include_router(context_router.router, prefix=settings.API_PREFIX)
app.include_router(feedback_router.router, prefix=settings.API_PREFIX)
app.include_router(analytics_router.router, prefix=settings.API_PREFIX)

app.mount("/static", StaticFiles(directory="../dashboard"), name="static")

@app.get("/")
def read_root():
    return {"message": "Context Saver API"}

@app.get("/dashboard")
def serve_dashboard():
    return FileResponse("../dashboard/index.html")

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
