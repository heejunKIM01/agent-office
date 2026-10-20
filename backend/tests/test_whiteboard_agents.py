"""Whiteboard statistics count every agent's tools (docs/plan/spec.md "에이전트 범위").

The OpenCode plugin sends a tool's input only with PRE_TOOL_USE, so the
whiteboard keeps it until the matching POST_TOOL_USE.
"""

from typing import Any

import pytest

from app.core.state_machine import StateMachine
from app.core.whiteboard_tracker import MAX_REMEMBERED_TOOL_INPUTS, WhiteboardTracker
from app.models.events import AnyEvent, EventAdapter, EventType, ToolEvent


def _tool(event_type: EventType, tool_name: str, tool_use_id: str, **data: Any) -> AnyEvent:
    return EventAdapter.validate_python(
        {
            "event_type": event_type,
            "session_id": "s1",
            "data": {
                "tool_name": tool_name,
                "tool_use_id": tool_use_id,
                "agent_id": "main",
                **data,
            },
        }
    )


def _run(sm: StateMachine, tool_name: str, tool_use_id: str, tool_input: dict[str, Any]) -> None:
    """A tool call the way the OpenCode plugin reports it: input only before."""
    sm.transition(_tool(EventType.PRE_TOOL_USE, tool_name, tool_use_id, tool_input=tool_input))
    sm.transition(_tool(EventType.POST_TOOL_USE, tool_name, tool_use_id, success=True))


@pytest.mark.parametrize(
    ("tool_name", "category"),
    [
        ("Read", "read"),
        ("read", "read"),
        ("read_file", "read"),
        ("list_directory", "read"),
        ("Bash", "bash"),
        ("bash", "bash"),
        ("run_shell_command", "bash"),
        ("shell", "bash"),
        ("PowerShell", "bash"),
        ("Edit", "edit"),
        ("edit", "edit"),
        ("replace", "edit"),
        ("apply_patch", "edit"),
        ("Write", "write"),
        ("write_file", "write"),
        ("TodoWrite", "todo"),
        ("todowrite", "todo"),
        ("write_todos", "todo"),
        ("WebFetch", "web"),
        ("google_web_search", "web"),
        ("Task", "task"),
        ("mystery_tool", "other"),
    ],
)
def test_every_agents_tools_have_a_category(tool_name: str, category: str) -> None:
    assert WhiteboardTracker().categorize_tool(tool_name) == category


def test_opencode_edit_counts_the_file_from_its_pre_input() -> None:
    sm = StateMachine()
    _run(sm, "edit", "c1", {"filePath": "/repo/src/auth.ts", "oldString": "a", "newString": "b"})

    assert sm.whiteboard.tool_usage == {"edit": 1}
    assert sm.whiteboard.code_written_count == 1
    assert sm.whiteboard.file_edits == {"auth.ts": 1}
    assert not sm.whiteboard.tool_inputs


def test_opencode_fix_command_counts_a_bug_fix() -> None:
    sm = StateMachine()
    _run(sm, "bash", "c1", {"command": "npm run lint:fix"})

    assert sm.whiteboard.bug_fixed_count == 1


def test_opencode_todowrite_fills_the_todo_board() -> None:
    sm = StateMachine()
    todos = [
        {"id": "1", "content": "Fix the auth test", "status": "completed", "priority": "high"},
        {"id": "2", "content": "Run the suite", "status": "pending", "priority": "low"},
    ]
    _run(sm, "todowrite", "c1", {"todos": todos})

    assert [todo.content for todo in sm.todos] == ["Fix the auth test", "Run the suite"]
    assert sm.whiteboard.task_completed_count == 1


def test_claude_edit_with_its_input_on_post_is_counted_as_before() -> None:
    sm = StateMachine()
    sm.transition(
        _tool(
            EventType.POST_TOOL_USE,
            "Edit",
            "t1",
            success=True,
            tool_input={"file_path": "src/a.py"},
        )
    )

    assert sm.whiteboard.file_edits == {"a.py": 1}


def test_remembered_inputs_are_bounded() -> None:
    tracker = WhiteboardTracker()
    for i in range(MAX_REMEMBERED_TOOL_INPUTS + 50):
        event = _tool(EventType.PRE_TOOL_USE, "read", f"c{i}", tool_input={"filePath": "a"})
        assert isinstance(event, ToolEvent)
        tracker.remember_tool_input(event)

    assert len(tracker.tool_inputs) == MAX_REMEMBERED_TOOL_INPUTS
    assert "c0" not in tracker.tool_inputs
