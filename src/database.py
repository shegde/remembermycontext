from sqlmodel import SQLModel, create_engine, Session
from .config import settings
from .logging_config import logger

engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.ECHO_SQL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)


def create_db_and_tables():
    logger.info("Creating database tables...")
    SQLModel.metadata.create_all(engine)
    logger.info("Database tables created successfully")


def get_session():
    with Session(engine) as session:
        yield session

