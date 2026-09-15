from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import agent_actions, ask, documents, health, me, members, tasks, workspaces
from app.core.config import get_settings


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
        allow_origins=[settings.frontend_origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["Authorization", "Content-Type", "X-Workspace-Id"],
    )
    app.include_router(health.router)
    app.include_router(me.router)
    app.include_router(workspaces.router)
    app.include_router(members.router)
    app.include_router(tasks.router)
    app.include_router(agent_actions.router)
    app.include_router(documents.router)
    app.include_router(ask.router)
    return app


app = create_app()
