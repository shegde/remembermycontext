import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlmodel import Session

from .config import settings
from .crud.admin import ensure_admin_exists
from .crud.context import delete_unused_versions
from .database import create_db_and_tables, engine, get_session
from .logging_config import logger
from .middleware import limiter
from .routers import (
    admin_router,
    analytics_router,
    auth_router,
    context_router,
    feedback_router,
    onboarding_router,
    upgrade_router
)
from .services.crypto import crypto_service
from .services.verification import handle_email_verification, handle_password_reset_page

BASE_DIR = Path(__file__).parent
DASHBOARD_DIR = BASE_DIR / "dashboard"
ADMIN_DIR = BASE_DIR / "admin"
HOMEPAGE_DIR = BASE_DIR / "homepage"


def get_next_cleanup_time(target_hour: int) -> datetime:
    now = datetime.now(timezone.utc)
    target_time = now.replace(hour=target_hour, minute=0, second=0, microsecond=0)

    if target_time <= now:
        target_time += timedelta(days=1)

    return target_time


async def cleanup_unused_versions():
    while True:
        try:
            next_run = get_next_cleanup_time(settings.VERSION_CLEANUP_HOUR)
            now = datetime.now(timezone.utc)
            sleep_seconds = (next_run - now).total_seconds()

            if sleep_seconds > 0:
                logger.info(
                    f"Scheduled cleanup task will run at {next_run.strftime('%Y-%m-%d %H:%M:%S UTC')}"
                )
                await asyncio.sleep(sleep_seconds)

            try:
                with Session(engine) as session:
                    deleted_count = delete_unused_versions(
                        session, settings.VERSION_AUTO_DELETE_DAYS
                    )
                    if deleted_count > 0:
                        logger.info(
                            f"Auto-deleted {deleted_count} unused context versions "
                            f"(threshold: {settings.VERSION_AUTO_DELETE_DAYS} days)"
                        )
                    else:
                        logger.info(
                            f"Cleanup task completed: no unused versions to delete "
                            f"(threshold: {settings.VERSION_AUTO_DELETE_DAYS} days)"
                        )
            except Exception as db_error:
                logger.error(f"Database error in cleanup task: {str(db_error)}")
                await asyncio.sleep(3600)
                continue
        except asyncio.CancelledError:
            logger.info("Cleanup task cancelled")
            break
        except Exception as e:
            logger.error(f"Error in auto-deletion task: {str(e)}", exc_info=True)
            await asyncio.sleep(3600)

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

    with Session(engine) as session:
        ensure_admin_exists(session, settings.ADMIN_USERNAME, settings.ADMIN_PASSWORD)

    with Session(engine) as session:
        deleted_count = delete_unused_versions(session, settings.VERSION_AUTO_DELETE_DAYS)
        if deleted_count > 0:
            logger.info(f"Initial cleanup: deleted {deleted_count} unused context versions")

    cleanup_task = asyncio.create_task(cleanup_unused_versions())
    
    logger.info("Server started successfully")
    yield
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    logger.info("Shutting down RememberMyContext API server...")


app = FastAPI(
    title="RememberMyContext API",
    version="1.0.0",
    description="Context Management API for RememberMyContext Chrome Extension",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
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

    is_production = (
        "localhost" not in str(settings.DATABASE_URL) and
        "127.0.0.1" not in str(settings.DATABASE_URL)
    )

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

try:
    app.mount("/homepage-static", StaticFiles(directory=str(HOMEPAGE_DIR)), name="homepage-static")
except RuntimeError:
    logger.warning("Homepage directory not found, skipping homepage static files mount")


@app.get("/", response_class=HTMLResponse)
def read_root():
    homepage_path = HOMEPAGE_DIR / "index.html"
    if homepage_path.exists():
        return FileResponse(
            str(homepage_path),
            media_type="text/html",
            headers={"Cache-Control": "public, max-age=3600"}
        )
    else:
        logger.warning(f"Homepage file not found at {homepage_path}")
        return JSONResponse(
            status_code=200,
            content={
                "name": "RememberMyContext API",
                "version": "1.0.0",
                "status": "operational"
            }
        )


@app.get("/legal", response_class=HTMLResponse)
def serve_legal():
    legal_path = HOMEPAGE_DIR / "legal.html"
    if legal_path.exists():
        return FileResponse(
            str(legal_path),
            media_type="text/html",
            headers={"Cache-Control": "public, max-age=3600"}
        )
    else:
        logger.warning(f"Legal page not found at {legal_path}")
        return JSONResponse(
            status_code=404,
            content={"message": "Legal page not found"}
        )


@app.get("/favicon.ico")
def favicon():
    favicon_path = HOMEPAGE_DIR / "assets" / "favicon.png"
    if favicon_path.exists():
        return FileResponse(str(favicon_path))
    return Response(status_code=204)


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

