import os

# Settings are validated at import time; tests never reach Supabase.
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_PUBLISHABLE_KEY", "test-publishable")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role")
os.environ["ENVIRONMENT"] = "test"
# Generation runs on Claude on Bedrock (D-046). Tests never reach AWS: the
# provider is always faked. These only have to be shaped like real ids.
os.environ.setdefault(
    "BEDROCK_ANSWER_MODEL",
    "arn:aws:bedrock:us-east-2:000000000000:inference-profile/us.anthropic.claude-sonnet-4-20250514-v1:0",
)
os.environ.setdefault(
    "BEDROCK_FAST_MODEL",
    "arn:aws:bedrock:us-east-2:000000000000:inference-profile/us.anthropic.claude-haiku-4-5-20251001-v1:0",
)
os.environ.setdefault("BEDROCK_FALLBACK_MODELS", "us.anthropic.claude-haiku-4-5-20251001-v1:0")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.supabase import service_db, user_db  # noqa: E402
from app.core.workspace import WorkspaceContext, get_workspace_context  # noqa: E402
from app.main import app  # noqa: E402


class ForbiddenDb:
    """Fails the test if a handler reaches the database when it should not."""

    def __getattr__(self, name):
        raise AssertionError(f"database was called ({name}) but the request should have been rejected first")


@pytest.fixture
def client():
    yield TestClient(app)
    app.dependency_overrides.clear()


def _signed_in_as(role: str):
    def _context() -> WorkspaceContext:
        return WorkspaceContext(
            user_id="00000000-0000-0000-0000-000000000002",
            email="person@example.com",
            workspace_id="00000000-0000-0000-0000-00000000000a",
            workspace_name="Test",
            auth_role=role,
        )

    async def _db():
        yield ForbiddenDb()

    app.dependency_overrides[get_workspace_context] = _context
    app.dependency_overrides[user_db] = _db
    app.dependency_overrides[service_db] = _db


@pytest.fixture
def as_member():
    _signed_in_as("Member")
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def as_admin():
    _signed_in_as("Admin")
    yield
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _fresh_rate_limits():
    """Rate-limit windows are process state; no test may inherit another's."""
    from app.core.ratelimit import limiter

    limiter.reset()
    yield
    limiter.reset()
