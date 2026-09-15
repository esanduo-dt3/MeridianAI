import pytest

from app.api.notes import plain_text, validate_block_tree

WORKSPACE = {"X-Workspace-Id": "00000000-0000-0000-0000-00000000000a"}

DOC = {
    "type": "doc",
    "content": [
        {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "Kickoff"}]},
        {"type": "paragraph", "content": [{"type": "text", "text": "Agree the pilot scope."}]},
        {
            "type": "taskList",
            "content": [
                {"type": "taskItem", "attrs": {"checked": False}, "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Book the room"}]}]}
            ],
        },
    ],
}


def test_block_tree_is_accepted_and_flattened_for_previews():
    assert validate_block_tree(DOC) is DOC
    text = plain_text(DOC)
    assert "Kickoff" in text and "Agree the pilot scope." in text and "Book the room" in text


@pytest.mark.parametrize(
    "content",
    [
        "just a string",
        {"type": "paragraph"},
        {"type": "doc", "content": "flat"},
        {"type": "doc", "content": [{"text": "no type"}]},
    ],
)
def test_non_block_tree_content_is_rejected(content):
    with pytest.raises(ValueError):
        validate_block_tree(content)


def test_oversized_and_deeply_nested_notes_are_rejected():
    with pytest.raises(ValueError):
        validate_block_tree({"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "x" * 600_000}]}]})
    node = {"type": "paragraph"}
    for _ in range(60):
        node = {"type": "blockquote", "content": [node]}
    with pytest.raises(ValueError):
        validate_block_tree({"type": "doc", "content": [node]})


def test_notes_routes_require_a_token(client):
    assert client.get("/notes", headers=WORKSPACE).status_code == 401
    assert client.post("/notes", json={"title": "x"}, headers=WORKSPACE).status_code == 401


def test_invalid_content_is_422_before_the_database(client, as_member):
    response = client.post("/notes", json={"title": "Bad", "content": "flat text"}, headers=WORKSPACE)
    assert response.status_code == 422
