"""A session rebuilt from the database applies each event once, at the right time.

When an event arrives for a session that is not in memory (a new session,
or one evicted or lost to a backend restart), the processor rebuilds the
session from its stored events. The arriving event must be applied once,
and stored timestamps must come back as the same UTC instant.
"""

from datetime import UTC, datetime
from typing import Any

import pytest
from sqlalchemy import select

from app.core.event_processor import EventProcessor
from app.db import database
from app.db.models import EventRecord
from app.models.events import AnyEvent, EventAdapter, EventType


def _event(
    event_type: EventType, session_id: str, timestamp: str | None = None, **data: Any
) -> AnyEvent:
    payload: dict[str, Any] = {"event_type": event_type, "session_id": session_id, "data": data}
    if timestamp is not None:
        payload["timestamp"] = timestamp
    return EventAdapter.validate_python(payload)


def _types(ep: EventProcessor, session_id: str) -> list[str]:
    return [entry["type"] for entry in ep.sessions[session_id].history]


@pytest.mark.asyncio
async def test_first_event_of_a_new_session_is_applied_once() -> None:
    ep = EventProcessor()
    await ep.process_event(_event(EventType.SESSION_START, "restore-new"))
    await ep.process_event(_event(EventType.USER_PROMPT_SUBMIT, "restore-new", prompt="hi"))

    assert _types(ep, "restore-new") == ["session_start", "user_prompt_submit"]


@pytest.mark.asyncio
async def test_event_after_eviction_is_applied_once() -> None:
    ep = EventProcessor()
    await ep.process_event(_event(EventType.SESSION_START, "restore-evicted"))
    await ep.process_event(_event(EventType.USER_PROMPT_SUBMIT, "restore-evicted", prompt="one"))
    del ep.sessions["restore-evicted"]  # evicted from memory, events stay in the DB

    await ep.process_event(_event(EventType.USER_PROMPT_SUBMIT, "restore-evicted", prompt="two"))

    assert _types(ep, "restore-evicted") == [
        "session_start",
        "user_prompt_submit",
        "user_prompt_submit",
    ]
    prompts = [
        e["text"] for e in ep.sessions["restore-evicted"].conversation if e["role"] == "user"
    ]
    assert prompts == ["one", "two"]


@pytest.mark.asyncio
async def test_restored_history_keeps_utc_times_and_ids() -> None:
    sid = "restore-utc"
    first = await _live_entry(sid)
    # A backend restart: a new processor rebuilds the session from the DB.
    state = await EventProcessor().get_current_state(sid)
    assert state is not None
    restored = state.history[0]

    assert restored["timestamp"] == "2026-10-19T23:00:00+00:00"
    # Same event, same id: the frontend's event log matches them up.
    assert restored["id"] == first["id"]
    assert datetime.fromisoformat(restored["timestamp"]) == datetime.fromisoformat(
        first["timestamp"]
    )


async def _live_entry(session_id: str) -> dict[str, str]:
    ep = EventProcessor()
    # 08:00 in Seoul is 23:00 UTC the day before.
    await ep.process_event(
        _event(EventType.SESSION_START, session_id, timestamp="2026-10-20T08:00:00+09:00")
    )
    entry = ep.sessions[session_id].history[0]
    return {"id": entry["id"], "timestamp": entry["timestamp"]}


@pytest.mark.asyncio
async def test_real_session_start_after_restart_starts_fresh() -> None:
    sid = "restore-resume"
    ep = EventProcessor()
    await ep.process_event(_event(EventType.SESSION_START, sid))
    await ep.process_event(_event(EventType.USER_PROMPT_SUBMIT, sid, prompt="old"))

    restarted = EventProcessor()
    await restarted.process_event(_event(EventType.SESSION_START, sid, source="resume"))

    assert _types(restarted, sid) == ["session_start"]
    async with database.AsyncSessionLocal() as db:
        stored = (
            await db.execute(select(EventRecord.event_type).where(EventRecord.session_id == sid))
        ).scalars()
        assert list(stored) == ["session_start"]


@pytest.mark.asyncio
async def test_stored_timestamps_read_back_as_the_same_utc_instant() -> None:
    seoul = datetime.fromisoformat("2026-10-20T08:00:00+09:00")
    async with database.AsyncSessionLocal() as db:
        db.add(EventRecord(session_id="restore-db", timestamp=seoul, event_type="stop", data={}))
        await db.commit()
    async with database.AsyncSessionLocal() as db:
        stored = (
            await db.execute(
                select(EventRecord.timestamp).where(EventRecord.session_id == "restore-db")
            )
        ).scalar_one()

    assert stored == seoul
    assert stored.tzinfo == UTC
