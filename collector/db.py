from sqlalchemy.pool import NullPool, StaticPool
from sqlmodel import Session, SQLModel, create_engine

from .config import settings


def _make_engine():
    url = settings.DATABASE_URL
    if "postgresql" in url or "postgres" in url:
        # NullPool is required for serverless — no persistent connections
        return create_engine(url, poolclass=NullPool)
    if url == "sqlite://" or ":memory:" in url:
        # StaticPool shares a single in-memory DB across all connections (tests)
        return create_engine(
            url,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
    return create_engine(url, connect_args={"check_same_thread": False})


engine = _make_engine()


def create_db() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
