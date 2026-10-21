"""A producer can send the reply with STOP when its transcript is unreadable.

Gemini CLI's transcript is not in Claude Code's format, so its hook sends the
reply as ``speech_content.boss`` (from ``AfterAgent.prompt_response``).
"""

from typing import Any

import pytest

from app.core.event_processor import EventProcessor
from app.models.events import AnyEvent, EventAdapter, EventType


def _event(event_type: EventType, session_id: str, **data: Any) -> AnyEvent:
    return EventAdapter.validate_python(
        {"event_type": event_type, "session_id": session_id, "data": data}
    )


@pytest.mark.asyncio
async def test_reply_with_stop_reaches_the_conversation_and_the_boss() -> None:
    sid = "reply-gemini"
    ep = EventProcessor()
    await ep.process_event(_event(EventType.SESSION_START, sid, coding_agent="gemini-cli"))
    await ep.process_event(_event(EventType.USER_PROMPT_SUBMIT, sid, prompt="Fix the auth test"))
    await ep.process_event(
        _event(EventType.STOP, sid, speech_content={"boss": "Fixed the boundary. Tests pass."})
    )

    sm = ep.sessions[sid]
    replies = [entry["text"] for entry in sm.conversation if entry["role"] == "assistant"]
    assert replies == ["Fixed the boundary. Tests pass."]
    assert sm.boss_bubble is not None
    assert sm.boss_bubble.text.startswith("Fixed the boundary")
    assert sm.history[-1]["detail"]["message"] == "Fixed the boundary. Tests pass."


@pytest.mark.asyncio
async def test_stop_without_reply_or_transcript_adds_nothing() -> None:
    sid = "reply-none"
    ep = EventProcessor()
    await ep.process_event(_event(EventType.SESSION_START, sid))
    await ep.process_event(_event(EventType.STOP, sid))

    assert [e for e in ep.sessions[sid].conversation if e["role"] == "assistant"] == []


@pytest.mark.asyncio
async def test_subagent_reply_with_its_stop_becomes_its_report(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Codex CLI sends a subagent's last reply with SUBAGENT_STOP; it is the agent's report."""
    sid = "reply-codex-subagent"
    ep = EventProcessor()
    reports: list[str | None] = []

    async def capture(session_id: str, sm: Any) -> None:
        agent = sm.agents.get("sa1")
        reports.append(agent.bubble.text if agent and agent.bubble else None)

    monkeypatch.setattr("app.core.handlers.agent_handler.broadcast_state", capture)
    await ep.process_event(_event(EventType.SESSION_START, sid, coding_agent="codex"))
    await ep.process_event(
        _event(EventType.SUBAGENT_START, sid, agent_id="sa1", task_description="Find the timeout")
    )
    await ep.process_event(
        _event(
            EventType.SUBAGENT_STOP,
            sid,
            agent_id="sa1",
            speech_content={"agent": "SESSION_TIMEOUT is 30 in src/auth.py. That is the cause."},
        )
    )

    assert "SESSION_TIMEOUT is 30 in src/auth.py." in reports
    assert "sa1" not in ep.sessions[sid].agents
