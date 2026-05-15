"""Shared fixtures for backend API tests.

Uses in-memory SQLite and patches external services (MinIO, Redis/RQ)
so tests run without any infrastructure.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import JSON, Text, create_engine
from sqlalchemy.orm import sessionmaker

# ---------------------------------------------------------------------------
# Patch PostgreSQL-only column types before any model is imported.
# ---------------------------------------------------------------------------
patch("pgvector.sqlalchemy.Vector", lambda dim: Text()).start()
patch("sqlalchemy.dialects.postgresql.ARRAY", lambda item_type: JSON()).start()

from find_api.core.database import Base, get_db  # noqa: E402
from find_api.main import app  # noqa: E402

# ---------------------------------------------------------------------------
# In-memory SQLite engine
# ---------------------------------------------------------------------------
_engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
_TestSession = sessionmaker(bind=_engine)
Base.metadata.create_all(bind=_engine)


@asynccontextmanager
async def _noop_lifespan(_app):
    """Skip real init_db / init_storage during tests."""
    yield


@pytest.fixture()
def db():
    """Provide a clean database session for each test."""
    Base.metadata.drop_all(bind=_engine)
    Base.metadata.create_all(bind=_engine)
    session = _TestSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db):
    """TestClient with mocked storage and queue dependencies."""

    def _override_db():
        yield db

    app.dependency_overrides[get_db] = _override_db
    app.router.lifespan_context = _noop_lifespan

    fake_job = MagicMock(id="test-job-123")
    fake_queue = MagicMock()
    fake_queue.enqueue.return_value = fake_job

    with (
        patch("find_api.routers.upload.upload_file", return_value="images/ab/abc.jpg"),
        patch("find_api.routers.upload.get_task_queue", return_value=fake_queue),
        patch(
            "find_api.routers.gallery.get_file_url",
            return_value="http://fake/img.jpg",
        ),
        patch("find_api.routers.gallery.delete_file"),
        patch(
            "find_api.routers.search.get_file_url",
            return_value="http://fake/img.jpg",
        ),
    ):
        with TestClient(app) as c:
            yield c

    app.dependency_overrides.clear()


# Re-export for convenience in test files
from fastapi.testclient import TestClient  # noqa: E402, F401
