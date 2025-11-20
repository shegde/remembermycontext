from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse
from sqlmodel import Session
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .database import create_db_and_tables, get_session, engine
from .routers import auth_router, context_router, feedback_router, analytics_router, upgrade_router, onboarding_router, admin_router
from .config import settings
from .logging_config import logger
from .middleware import limiter
from .services.crypto import crypto_service
from .services.verification import handle_email_verification, handle_password_reset_page
from .crud.admin import ensure_admin_exists

BASE_DIR = Path(__file__).parent
DASHBOARD_DIR = BASE_DIR / "dashboard"
ADMIN_DIR = BASE_DIR / "admin"


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting RememberMyContext API server...")
    
    try:
        settings.validate()
    except ValueError as e:
        logger.error(f"Configuration validation failed: {str(e)}")
        raise
    
    create_db_and_tables()
    
    if crypto_service is None:
        logger.error("Crypto service failed to initialize")
        raise RuntimeError("Crypto service initialization failed")
    
    from sqlmodel import Session
    with Session(engine) as session:
        ensure_admin_exists(session, settings.ADMIN_USERNAME, settings.ADMIN_PASSWORD)
    
    logger.info("Server started successfully")
    yield
    logger.info("Shutting down RememberMyContext API server...")


app = FastAPI(
    title="RememberMyContext API",
    version="1.0.0",
    description="Context Management API for RememberMyContext Chrome Extension",
    lifespan=lifespan
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

def get_allowed_origins():
    origins = [
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000"
    ]
    
    if settings.ALLOWED_ORIGINS:
        origins.extend([origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",")])
    
    is_production = "localhost" not in str(settings.DATABASE_URL) and "127.0.0.1" not in str(settings.DATABASE_URL)
    
    if not is_production:
        origins.append("chrome-extension://*")
    
    return origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix=settings.API_PREFIX)
app.include_router(context_router, prefix=settings.API_PREFIX)
app.include_router(feedback_router, prefix=settings.API_PREFIX)
app.include_router(analytics_router, prefix=settings.API_PREFIX)
app.include_router(upgrade_router, prefix=settings.API_PREFIX)
app.include_router(onboarding_router, prefix=settings.API_PREFIX)
app.include_router(admin_router, prefix=settings.API_PREFIX)

try:
    app.mount("/static", StaticFiles(directory=str(DASHBOARD_DIR)), name="static")
except RuntimeError:
    logger.warning("Dashboard directory not found, skipping static files mount")

try:
    app.mount("/admin-static", StaticFiles(directory=str(ADMIN_DIR)), name="admin-static")
except RuntimeError:
    logger.warning("Admin directory not found, skipping admin static files mount")


@app.get("/")
def read_root():
    return {
        "name": "RememberMyContext API",
        "version": "1.0.0",
        "status": "operational"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "database": "connected"
    }


@app.get("/verify-email", response_class=HTMLResponse)
def verify_email_web(
    token: str = Query(...),
    session: Session = Depends(get_session)
):
    return handle_email_verification(token, session)


@app.get("/reset-password", response_class=HTMLResponse)
def reset_password_web(
    token: str = Query(...),
    session: Session = Depends(get_session)
):
    return handle_password_reset_page(token, session)


@app.get("/dashboard")
def serve_dashboard():
    dashboard_path = DASHBOARD_DIR / "index.html"
    if dashboard_path.exists():
        return FileResponse(str(dashboard_path))
    else:
        logger.warning(f"Dashboard file not found at {dashboard_path}")
        return JSONResponse(
            status_code=404,
            content={"message": "Dashboard not found"}
        )


@app.get("/admin")
def serve_admin():
    admin_path = ADMIN_DIR / "index.html"
    if admin_path.exists():
        return FileResponse(str(admin_path))
    else:
        logger.warning(f"Admin panel file not found at {admin_path}")
        return JSONResponse(
            status_code=404,
            content={"message": "Admin panel not found"}
        )

