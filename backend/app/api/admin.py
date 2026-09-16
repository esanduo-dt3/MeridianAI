"""Admin surfaces: review queue, audit log, pipeline health (docs/decisions.md D-040).

Every endpoint requires an Admin of the workspace, and every read runs through
that Admin's own database client, so row-level security applies on top of the
role check. The one write, a review decision, goes through a database function
that writes the decision and its audit entry in one transaction (the same
pattern as approving an agent action, D-009).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, StringConstraints

from app.admin.health import summarise
from app.core.supabase import Db, service_db, user_db
from app.core.workspace import WorkspaceContext, require_admin

router = APIRouter(prefix="/admin", tags=["admin"])

_ANSWER_SELECT = (
    "id,question,answer,confidence,groundedness_pass,flagged,flag_reasons,model,created_at,"
    "asker:users!agent_answers_asked_by_fkey(email,full_name),"
    "answer_citations(ordinal,chunk_id,chunks(document_id,char_start,char_end,section,page,content,documents(file_name)))"
)


# --- Review queue ----------------------------------------------------------


def _answer(row: dict[str, Any]) -> dict[str, Any]:
    citations = []
    for c in sorted(row.get("answer_citations") or [], key=lambda c: c["ordinal"]):
        chunk = c.get("chunks") or {}
        citations.append({
            "ordinal": c["ordinal"],
            "chunk_id": c["chunk_id"],
            "document_id": chunk.get("document_id"),
            "file_name": (chunk.get("documents") or {}).get("file_name", ""),
            "char_start": chunk.get("char_start", 0),
            "char_end": chunk.get("char_end", 0),
            "page": chunk.get("page"),
            "section": chunk.get("section") or "",
            "excerpt": (chunk.get("content") or "")[:800],
        })
    asker = row.get("asker") or {}
    return {
        "id": row["id"],
        "question": row["question"],
        "answer": row["answer"],
        "confidence": {"value": row["confidence"], "label": "uncalibrated"},
        "groundedness_pass": row["groundedness_pass"],
        "flag_reasons": row.get("flag_reasons") or [],
        "model": row.get("model"),
        "asked_by": asker.get("full_name") or asker.get("email"),
        "created_at": row["created_at"],
        "citations": citations,
    }


@router.get("/review")
async def review_queue(context: WorkspaceContext = Depends(require_admin), db: Db = Depends(user_db)):
    ws = f"eq.{context.workspace_id}"
    flagged = await db.select("agent_answers", {"select": _ANSWER_SELECT, "workspace_id": ws, "flagged": "is.true",
                                                "order": "created_at.desc", "limit": "200"})
    reviews = await db.select("admin_reviews", {
        "select": "id,review_target_type,review_target_id,decision,notes,correction,reviewed_at,"
                  "reviewer:users(email,full_name)",
        "workspace_id": ws, "order": "reviewed_at.desc", "limit": "500"})
    reviewed = {r["review_target_id"] for r in reviews if r["review_target_type"] == "agent_answer"}
    pending = await db.select("agent_actions", {"select": "id,action_type,reasoning,proposed_payload,created_at",
                                                "workspace_id": ws, "status": "eq.pending", "order": "created_at.asc"})
    decided = await db.select("agent_actions", {
        "select": "id,proposed_payload,status,decided_at,decider:users!agent_actions_decided_by_fkey(email,full_name)",
        "workspace_id": ws, "status": "in.(approved,rejected)", "order": "decided_at.desc", "limit": "20"})

    question_by_id = {a["id"]: a["question"] for a in flagged}
    recent = [
        {"kind": "answer", "target_id": r["review_target_id"], "decision": r["decision"], "notes": r["notes"],
         "correction": r["correction"], "at": r["reviewed_at"], "summary": question_by_id.get(r["review_target_id"], ""),
         "by": (r.get("reviewer") or {}).get("full_name") or (r.get("reviewer") or {}).get("email")}
        for r in reviews[:20]
    ] + [
        {"kind": "action", "target_id": a["id"], "decision": a["status"], "notes": None, "correction": None,
         "at": a["decided_at"], "summary": (a.get("proposed_payload") or {}).get("title", ""),
         "by": (a.get("decider") or {}).get("full_name") or (a.get("decider") or {}).get("email")}
        for a in decided
    ]
    recent.sort(key=lambda d: d["at"] or "", reverse=True)
    return {
        "answers": [_answer(a) for a in flagged if a["id"] not in reviewed],
        "actions": pending,
        "recent": recent[:20],
    }


class ReviewDecision(BaseModel):
    decision: Literal["confirmed", "corrected", "dismissed"]
    notes: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None = None
    correction: Annotated[str, StringConstraints(strip_whitespace=True, max_length=8000)] | None = None


@router.post("/review/answers/{answer_id}")
async def review_answer(
    answer_id: str,
    body: ReviewDecision,
    context: WorkspaceContext = Depends(require_admin),
    service: Db = Depends(service_db),
):
    # The function re-checks the reviewer is an Admin of the answer's own workspace,
    # refuses a second decision, and writes the audit entry in the same transaction.
    return await service.rpc("review_agent_answer", {
        "answer_id": answer_id, "reviewer_id": context.user_id, "decision": body.decision,
        "notes": body.notes, "correction": body.correction,
    })


# --- Audit log -------------------------------------------------------------


@router.get("/audit")
async def audit_log(
    context: WorkspaceContext = Depends(require_admin),
    db: Db = Depends(user_db),
    actor_type: Literal["user", "agent", "system"] | None = None,
    action: Annotated[str | None, Query(max_length=80)] = None,
    before: Annotated[str | None, Query(max_length=40)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
):
    params = {
        "select": "id,actor_type,action,target_type,target_id,timestamp,details,actor:users(email,full_name)",
        "workspace_id": f"eq.{context.workspace_id}",
        "order": "timestamp.desc",
        "limit": str(limit + 1),
    }
    if actor_type:
        params["actor_type"] = f"eq.{actor_type}"
    if action:
        cleaned = "".join(ch for ch in action if ch.isalnum() or ch in "._-")
        if cleaned:
            params["action"] = f"ilike.*{cleaned}*"
    if before:
        params["timestamp"] = f"lt.{before}"
    rows = await db.select("audit_log", params)
    page = rows[:limit]
    return {"entries": page, "next_before": page[-1]["timestamp"] if len(rows) > limit else None}


# --- Pipeline health -------------------------------------------------------


@router.get("/pipeline-health")
async def pipeline_health(
    context: WorkspaceContext = Depends(require_admin),
    db: Db = Depends(user_db),
    days: Annotated[int, Query(ge=1, le=90)] = 30,
):
    today = datetime.now(timezone.utc).date()
    since = (today - timedelta(days=days - 1)).isoformat()
    ws = f"eq.{context.workspace_id}"
    runs = await db.select("retrieval_runs", {
        "select": "created_at,grade_outcome,retry_count,latency_ms,top_score,profile,rerank_scores_json",
        "workspace_id": ws, "created_at": f"gte.{since}", "limit": "5000"})
    answers = await db.select("agent_answers", {
        "select": "created_at,groundedness_pass,flagged,flag_reasons,model",
        "workspace_id": ws, "created_at": f"gte.{since}", "limit": "5000"})
    return summarise(runs, answers, today=today, days=days)
