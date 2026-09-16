"""Talk to the workspace agent (docs/decisions.md D-028, D-039).

Any member may ask. The agent reads tasks, members and documents as that member,
and can only propose a task; an Admin approves or rejects the proposal on the
Tasks page. Every turn is written to the audit log with the tools it used.

The conversation is held by the client and sent back with each message, so the
server keeps no chat state beyond the audit trail.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, StringConstraints

from app.agent.loop import run_agent, today
from app.agent.tools import ToolContext, TurnState
from app.core import audit
from app.core.ratelimit import rate_limit
from app.core.supabase import Db, service_db, user_db
from app.core.workspace import WorkspaceContext, get_workspace_context
from app.llm.gateway import ModelError
from app.rag.guardrails import redact_secrets, sanitise_input

router = APIRouter(tags=["agent"])

MAX_MESSAGE_CHARS = 2000
Message = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_MESSAGE_CHARS)]


class Turn(BaseModel):
    role: Literal["user", "assistant"]
    content: Annotated[str, StringConstraints(max_length=8000)]


class ChatRequest(BaseModel):
    message: Message
    history: list[Turn] = Field(default_factory=list, max_length=20)


class StepOut(BaseModel):
    tool: str
    arguments: dict[str, Any]
    ok: bool
    summary: str


class ChatResponse(BaseModel):
    reply: str
    steps: list[StepOut]
    proposals: list[dict[str, Any]]
    tasks: list[dict[str, Any]]
    citations: list[dict[str, Any]]
    injection_detected: bool
    models: list[str]


@router.post("/agent/chat", response_model=ChatResponse, dependencies=[Depends(rate_limit("chat"))])
async def chat(
    body: ChatRequest,
    context: WorkspaceContext = Depends(get_workspace_context),
    db: Db = Depends(user_db),
    service: Db = Depends(service_db),
):
    message = sanitise_input(body.message, limit=MAX_MESSAGE_CHARS)
    if not message:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Type a message")
    # Secrets are removed on the way in, so they never reach the model, the
    # database or the audit log, and on the way out in case a tool result held
    # one. The history is redacted too: the browser holds it and sends it back
    # unredacted (D-041).
    message, redacted_in = redact_secrets(message)
    history = [{"role": t.role, "content": redact_secrets(t.content)[0]} for t in body.history]

    state = TurnState(user_message=message)
    ctx = ToolContext(db=db, service=service, workspace=context, today=today(), state=state)
    try:
        result = await run_agent(ctx, history)
    except ModelError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "The model provider is unavailable. Try again shortly.") from exc

    reply, redacted_out = redact_secrets(result.reply)

    await audit.record(
        service,
        workspace_id=context.workspace_id,
        actor_id=context.user_id,
        actor_type="user",
        action="agent.chat",
        target_type="agent_turn",
        details={
            "message": message,
            "reply": reply,
            "secrets_redacted": sorted(set(redacted_in + redacted_out)),
            "tools": [{"tool": s.tool, "arguments": s.arguments, "ok": s.ok} for s in result.steps],
            "proposal_ids": [p["id"] for p in state.proposals],
            "injection_detected": state.tainted,
            "models": result.models,
        },
    )
    return ChatResponse(
        reply=reply,
        steps=[StepOut(tool=s.tool, arguments=s.arguments, ok=s.ok, summary=s.summary) for s in result.steps],
        proposals=state.proposals,
        tasks=list(state.tasks.values()),
        citations=state.citations,
        injection_detected=state.tainted,
        models=result.models,
    )
