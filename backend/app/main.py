from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin, agent_actions, agent_chat, ask, documents, health, me, members, notes, tasks, workspaces
from app.core.config import get_settings
from app.core.security_headers import SecurityHeadersMiddleware


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Meridian API",
        version="0.1.0",
        docs_url="/docs" if settings.environment != "production" else None,
        redoc_url=None,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Workspace-Id"],
    )
    # Added last, so it is the outermost middleware and also covers the preflight
    # responses CORS answers on its own (D-041).
    app.add_middleware(SecurityHeadersMiddleware, production=settings.environment == "production")
    app.include_router(health.router)
    app.include_router(me.router)
    app.include_router(workspaces.router)
    app.include_router(members.router)
    app.include_router(tasks.router)
    app.include_router(agent_actions.router)
    app.include_router(documents.router)
    app.include_router(notes.router)
    app.include_router(ask.router)
    app.include_router(agent_chat.router)
    app.include_router(admin.router)
    return app


app = create_app()
