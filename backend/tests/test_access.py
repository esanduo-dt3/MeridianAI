import pytest

WORKSPACE = {"X-Workspace-Id": "00000000-0000-0000-0000-00000000000a"}

PROTECTED = [
    ("get", "/workspaces", None),
    ("post", "/workspaces", {"name": "New"}),
    ("get", "/members", None),
    ("post", "/admin/members", {"email": "a@b.co"}),
]


@pytest.mark.parametrize(("method", "path", "body"), PROTECTED)
def test_routes_require_a_token(client, method, path, body):
    response = getattr(client, method)(path, json=body, headers=WORKSPACE) if body else getattr(client, method)(path, headers=WORKSPACE)
    assert response.status_code == 401


ADMIN_ONLY = [
    ("post", "/admin/members", {"email": "new@example.com", "auth_role": "Member"}),
    ("patch", "/admin/members/00000000-0000-0000-0000-000000000009", {"auth_role": "Admin"}),
    ("delete", "/admin/members/00000000-0000-0000-0000-000000000009", None),
    ("delete", "/admin/invites/00000000-0000-0000-0000-000000000009", None),
    ("patch", "/workspace", {"name": "Renamed"}),
    ("post", "/tasks", {"title": "New task"}),
    ("delete", "/tasks/00000000-0000-0000-0000-000000000009", None),
    ("post", "/agent/actions/00000000-0000-0000-0000-000000000009/approve", None),
    ("post", "/agent/actions/00000000-0000-0000-0000-000000000009/reject", None),
    # Planning the work is an Admin job; Members still change status and order (D-048).
    ("post", "/admin/sprints", {"name": "Sprint 1"}),
    ("patch", "/admin/sprints/00000000-0000-0000-0000-000000000009", {"status": "active"}),
    ("delete", "/admin/sprints/00000000-0000-0000-0000-000000000009", None),
]


@pytest.mark.parametrize(("method", "path", "body"), ADMIN_ONLY)
def test_members_cannot_use_admin_routes(client, as_member, method, path, body):
    call = getattr(client, method)
    response = call(path, json=body, headers=WORKSPACE) if body else call(path, headers=WORKSPACE)
    assert response.status_code == 403
    assert "Admin" in response.json()["detail"]


@pytest.mark.parametrize("email", ["not-an-email", "a@b", " @x.com", "x" * 250 + "@example.com"])
def test_invalid_emails_are_rejected_before_any_lookup(client, as_admin, email):
    response = client.post("/admin/members", json={"email": email}, headers=WORKSPACE)
    assert response.status_code == 422


def test_workspace_header_must_be_a_uuid(client):
    from app.core.security import AuthenticatedUser, get_current_user
    from app.main import app

    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(id="u", email=None, token="t")
    response = client.get("/members", headers={"X-Workspace-Id": "not-a-uuid"})
    assert response.status_code == 422


@pytest.mark.parametrize(
    "body",
    [{"title": "Renamed"}, {"priority": "urgent"}, {"assignee_id": None}, {"status": "done", "due_date": "2026-10-01"}],
)
def test_members_can_only_change_status_and_order(client, as_member, body):
    response = client.patch("/tasks/00000000-0000-0000-0000-000000000009", json=body, headers=WORKSPACE)
    assert response.status_code == 403
    assert "status and order" in response.json()["detail"]


@pytest.mark.parametrize("body", [{}, {"status": "blocked"}, {"priority": "critical"}, {"position": "NaN"}])
def test_invalid_task_updates_are_rejected(client, as_admin, body):
    response = client.patch("/tasks/00000000-0000-0000-0000-000000000009", json=body, headers=WORKSPACE)
    assert response.status_code == 422


def test_blank_task_title_is_rejected(client, as_admin):
    response = client.post("/tasks", json={"title": "   "}, headers=WORKSPACE)
    assert response.status_code == 422


# --- Sprints and the backlog (D-048) -----------------------------------------


def test_a_member_cannot_move_a_task_between_backlog_and_sprint(client, as_member):
    """Members change status and order only; the sprint a task sits in is content."""
    response = client.patch(
        "/tasks/00000000-0000-0000-0000-000000000009",
        json={"sprint_id": "00000000-0000-0000-0000-00000000000b"},
        headers=WORKSPACE,
    )
    assert response.status_code == 403
    assert "status and order" in response.json()["detail"]


def test_the_sprint_column_did_not_narrow_what_a_member_may_edit():
    """Members keep status and order, and gain nothing; sprint_id is content."""
    from app.api.tasks import MEMBER_EDITABLE

    assert MEMBER_EDITABLE == {"status", "position"}


def test_reading_the_sprint_plan_needs_membership_not_an_admin():
    """Members see the plan they are working to; only Admins change it."""
    import inspect

    from fastapi.params import Depends as DependsParam

    from app.api import sprints
    from app.core.workspace import get_workspace_context, require_admin

    def dependencies(endpoint):
        return [
            p.default.dependency
            for p in inspect.signature(endpoint).parameters.values()
            if isinstance(p.default, DependsParam)
        ]

    assert get_workspace_context in dependencies(sprints.list_sprints)
    assert require_admin not in dependencies(sprints.list_sprints)
    for write in (sprints.create_sprint, sprints.update_sprint, sprints.delete_sprint):
        assert require_admin in dependencies(write)


@pytest.mark.parametrize(
    "body",
    [
        {"name": "   "},                                            # a sprint needs a name
        {"name": "x" * 81},                                         # 80 characters is the limit
        {"name": "Sprint 1", "status": "archived"},                 # not a sprint state
        {"name": "Sprint 1", "start_date": "2026-10-10", "end_date": "2026-10-01"},  # ends before it starts
    ],
)
def test_invalid_sprints_are_rejected(client, as_admin, body):
    assert client.post("/admin/sprints", json=body, headers=WORKSPACE).status_code == 422
