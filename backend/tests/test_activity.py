"""Tool -> office activity contract (docs/plan/spec.md R1, R2).

Reading tools send a character to the archive, command tools to the server
room. The backend owns the mapping and exposes it as ``activity`` on the boss
and on each agent; these tests pin the mapping, the in-flight bookkeeping
(parallel and failed tools), and the attribution of subagent tool calls.
"""

from typing import Any

import pytest

from app.core.activity import ToolActivityTracker, activity_for_tool
from app.core.state_machine import StateMachine
from app.models.agents import Activity, Agent, AgentState
from app.models.events import AnyEvent, EventAdapter, EventType


def _event(event_type: EventType, **data: Any) -> AnyEvent:
    return EventAdapter.validate_python(
        {"event_type": event_type, "session_id": "s1", "data": data}
    )


def _tool(event_type: EventType, tool_name: str, tool_use_id: str | None, **data: Any) -> AnyEvent:
    payload: dict[str, Any] = {"tool_name": tool_name, **data}
    if tool_use_id is not None:
        payload["tool_use_id"] = tool_use_id
    if "agent_id" not in data and "native_agent_id" not in data:
        payload["agent_id"] = "main"
    return _event(event_type, **payload)


class TestActivityForTool:
    @pytest.mark.parametrize(
        "tool_name",
        ["Read", "Grep", "Glob", "LS", "WebFetch", "WebSearch", "read", "read_file", "grep_search"],
    )
    def test_reading_tools(self, tool_name: str) -> None:
        assert activity_for_tool(tool_name) == Activity.READING

    @pytest.mark.parametrize(
        "tool_name", ["Bash", "PowerShell", "BashOutput", "bash", "run_shell_command", "shell"]
    )
    def test_command_tools(self, tool_name: str) -> None:
        assert activity_for_tool(tool_name) == Activity.RUNNING

    @pytest.mark.parametrize("tool_name", ["Edit", "Write", "TodoWrite", "mcp__x__read", "", None])
    def test_other_tools_have_no_activity(self, tool_name: str | None) -> None:
        assert activity_for_tool(tool_name) is None


class TestToolActivityTracker:
    def test_most_recent_unfinished_tool_wins(self) -> None:
        tracker = ToolActivityTracker()
        tracker.start("main", "Read", "t1")
        tracker.start("main", "Bash", "t2")
        assert tracker.current("main") == Activity.RUNNING
        tracker.finish("main", "Bash", "t2")
        assert tracker.current("main") == Activity.READING
        tracker.finish("main", "Read", "t1")
        assert tracker.current("main") is None

    def test_finish_without_id_matches_oldest_same_name(self) -> None:
        tracker = ToolActivityTracker()
        tracker.start("main", "Read", None)
        tracker.start("main", "Bash", None)
        tracker.finish("main", "read", None)
        assert tracker.current("main") == Activity.RUNNING

    def test_characters_are_independent(self) -> None:
        tracker = ToolActivityTracker()
        tracker.start("main", "Read", "t1")
        tracker.start("agent-1", "Bash", "t2")
        tracker.clear("agent-1")
        assert tracker.current("main") == Activity.READING
        assert tracker.current("agent-1") is None


class TestBossActivity:
    def test_parallel_reads_and_command(self) -> None:
        sm = StateMachine()
        sm.transition(_tool(EventType.PRE_TOOL_USE, "Read", "r1"))
        sm.transition(_tool(EventType.PRE_TOOL_USE, "Read", "r2"))
        assert sm.to_game_state("s1").boss.activity == Activity.READING
        sm.transition(_tool(EventType.PRE_TOOL_USE, "Bash", "b1"))
        assert sm.to_game_state("s1").boss.activity == Activity.RUNNING
        sm.transition(_tool(EventType.POST_TOOL_USE, "Bash", "b1", success=True))
        sm.transition(_tool(EventType.POST_TOOL_USE, "Read", "r1", success=True))
        assert sm.boss_activity == Activity.READING
        sm.transition(_tool(EventType.POST_TOOL_USE, "Read", "r2", success=True))
        assert sm.boss_activity is None

    def test_failed_tool_ends_its_activity(self) -> None:
        sm = StateMachine()
        sm.transition(_tool(EventType.PRE_TOOL_USE, "Bash", "b1"))
        sm.transition(
            _tool(EventType.POST_TOOL_USE, "Bash", "b1", success=False, error_type="tool_error")
        )
        assert sm.boss_activity is None

    def test_unmapped_tool_keeps_boss_at_desk(self) -> None:
        sm = StateMachine()
        sm.transition(_tool(EventType.PRE_TOOL_USE, "Edit", "e1"))
        assert sm.boss_activity is None

    def test_turn_boundaries_clear_leftovers(self) -> None:
        sm = StateMachine()
        sm.transition(_tool(EventType.PRE_TOOL_USE, "Bash", "b1"))  # never finished
        sm.transition(_event(EventType.STOP))
        assert sm.boss_activity is None
        sm.transition(_tool(EventType.PRE_TOOL_USE, "Read", "r1"))  # never finished
        sm.transition(_event(EventType.USER_PROMPT_SUBMIT, prompt="next"))
        assert sm.boss_activity is None

    def test_game_state_serializes_activity(self) -> None:
        sm = StateMachine()
        sm.transition(_tool(EventType.PRE_TOOL_USE, "Grep", "g1"))
        payload = sm.to_game_state("s1").model_dump(mode="json", by_alias=True)
        assert payload["boss"]["activity"] == "reading"


class TestSubagentAttribution:
    def _sm_with_linked_agent(self) -> StateMachine:
        sm = StateMachine()
        sm.agents["subagent_tu1"] = Agent(
            id="subagent_tu1",
            native_id="a5a60c7",
            color="#3b82f6",
            number=1,
            state=AgentState.WORKING,
            desk=1,
        )
        return sm

    def test_subagent_read_moves_the_agent_not_the_boss(self) -> None:
        sm = self._sm_with_linked_agent()
        sm.transition(_tool(EventType.PRE_TOOL_USE, "Read", "r1", native_agent_id="a5a60c7"))
        assert sm.agents["subagent_tu1"].activity == Activity.READING
        assert sm.agents["subagent_tu1"].bubble is not None
        assert sm.boss_activity is None
        assert sm.boss_bubble is None

    def test_subagent_tools_end_with_the_subagent(self) -> None:
        sm = self._sm_with_linked_agent()
        sm.transition(_tool(EventType.PRE_TOOL_USE, "Bash", "b1", native_agent_id="a5a60c7"))
        sm.transition(_event(EventType.SUBAGENT_STOP, agent_id="subagent_tu1"))
        assert sm.agents["subagent_tu1"].activity is None

    def test_unlinked_subagent_is_late_linked_by_its_first_tool(self) -> None:
        sm = StateMachine()
        sm.transition(_event(EventType.SUBAGENT_START, agent_id="subagent_tu9"))
        sm.transition(_tool(EventType.PRE_TOOL_USE, "Read", "r1", native_agent_id="c42"))
        assert set(sm.agents) == {"subagent_tu9"}
        assert sm.agents["subagent_tu9"].native_id == "c42"
        assert sm.agents["subagent_tu9"].activity == Activity.READING

    def test_unknown_subagent_becomes_a_linked_ghost(self) -> None:
        sm = StateMachine()
        sm.transition(_tool(EventType.PRE_TOOL_USE, "Grep", "g1", native_agent_id="b77"))
        ghost = sm.agents["subagent_b77"]
        assert ghost.native_id == "b77"
        assert ghost.activity == Activity.READING
        sm.transition(
            _tool(EventType.POST_TOOL_USE, "Grep", "g1", native_agent_id="b77", success=True)
        )
        assert ghost.activity is None
