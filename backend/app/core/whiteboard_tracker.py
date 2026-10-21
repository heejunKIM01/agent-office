"""Whiteboard data tracking for the office simulation.

Encapsulates tool usage statistics, news items, agent lifespans,
heat map data, and background task tracking — all the state that
drives the whiteboard display in the frontend.
"""

import logging
from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, cast

from app.core.activity import activity_for_tool, tool_subject
from app.models.agents import Activity
from app.models.events import ToolEvent
from app.models.sessions import AgentLifespan, BackgroundTask, NewsItem

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Default-factory helpers (required to avoid mutable default arguments)
# ---------------------------------------------------------------------------


def _empty_tool_usage() -> dict[str, int]:
    return cast(dict[str, int], {})


def _empty_agent_lifespans() -> list[AgentLifespan]:
    return cast(list[AgentLifespan], [])


def _empty_news_items() -> list[NewsItem]:
    return cast(list[NewsItem], [])


def _empty_file_edits() -> dict[str, int]:
    return cast(dict[str, int], {})


def _empty_background_tasks() -> list[BackgroundTask]:
    return cast(list[BackgroundTask], [])


# ---------------------------------------------------------------------------
# Tool categorisation map (used for the pizza / doughnut chart)
# ---------------------------------------------------------------------------

# Lowercase tool names of every agent (docs/plan/spec.md "에이전트 범위").
# Unlisted reading and command tools fall back to "read" and "bash".
TOOL_CATEGORIES: dict[str, str] = {
    # Claude Code, and OpenCode, which uses the same names in lowercase
    "read": "read",
    "glob": "read",
    "grep": "read",
    "write": "write",
    "edit": "edit",
    "multiedit": "edit",
    "patch": "edit",
    "bash": "bash",
    "task": "task",
    "agent": "task",
    "todowrite": "todo",
    "websearch": "web",
    "webfetch": "web",
    # Gemini CLI
    "write_file": "write",
    "replace": "edit",
    "write_todos": "todo",
    "google_web_search": "web",
    "web_fetch": "web",
    # Codex CLI
    "apply_patch": "edit",
}

_ACTIVITY_CATEGORIES: dict[Activity, str] = {
    Activity.READING: "read",
    Activity.RUNNING: "bash",
    Activity.EDITING: "edit",
    Activity.BROWSING: "web",
    Activity.PLANNING: "todo",
    Activity.ASKING: "other",
}

# Tool inputs kept from PRE_TOOL_USE for producers whose POST_TOOL_USE omits
# them (the OpenCode plugin), bounded in case a POST never arrives.
MAX_REMEMBERED_TOOL_INPUTS = 200

MAX_NEWS_ITEMS = 20
MAX_AGENT_LIFESPANS = 10
MAX_BACKGROUND_TASKS = 10


@dataclass
class WhiteboardTracker:
    """Tracks all statistics and metadata displayed on the office whiteboard.

    Responsibilities:
    - Tool usage counts (categorised for the pizza chart)
    - Task / bug / coffee / code counters
    - Error / success streak tracking
    - Agent lifespan timeline entries
    - News ticker items
    - File edit heat-map data
    - Background task status list
    """

    tool_usage: dict[str, int] = field(default_factory=_empty_tool_usage)
    task_completed_count: int = 0
    bug_fixed_count: int = 0
    coffee_break_count: int = 0
    code_written_count: int = 0
    recent_error_count: int = 0
    recent_success_count: int = 0
    consecutive_successes: int = 0
    last_incident_time: str | None = None
    agent_lifespans: list[AgentLifespan] = field(default_factory=_empty_agent_lifespans)
    news_items: list[NewsItem] = field(default_factory=_empty_news_items)
    coffee_cups: int = 0
    file_edits: dict[str, int] = field(default_factory=_empty_file_edits)
    background_tasks: list[BackgroundTask] = field(default_factory=_empty_background_tasks)
    tool_inputs: OrderedDict[str, dict[str, Any]] = field(
        default_factory=lambda: OrderedDict[str, dict[str, Any]]()
    )

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def reset(self) -> None:
        """Reset all tracked state for a new session."""
        self.tool_usage = {}
        self.task_completed_count = 0
        self.bug_fixed_count = 0
        self.coffee_break_count = 0
        self.code_written_count = 0
        self.recent_error_count = 0
        self.recent_success_count = 0
        self.consecutive_successes = 0
        self.last_incident_time = None
        self.agent_lifespans = []
        self.news_items = []
        self.coffee_cups = 0
        self.file_edits = {}
        self.background_tasks = []
        self.tool_inputs.clear()

    # ------------------------------------------------------------------
    # News items
    # ------------------------------------------------------------------

    def add_news_item(self, category: str, headline: str) -> None:
        """Prepend a news item, keeping only the last MAX_NEWS_ITEMS entries."""
        news_item = NewsItem(
            category=category,
            headline=headline,
            timestamp=datetime.now(UTC).isoformat(),
        )
        self.news_items.insert(0, news_item)
        if len(self.news_items) > MAX_NEWS_ITEMS:
            self.news_items = self.news_items[:MAX_NEWS_ITEMS]

    # ------------------------------------------------------------------
    # Tool tracking
    # ------------------------------------------------------------------

    def categorize_tool(self, tool_name: str) -> str:
        """Return the broad category for any agent's tool name (used by pizza chart)."""
        category = TOOL_CATEGORIES.get(tool_name.lower())
        if category is not None:
            return category
        activity = activity_for_tool(tool_name)
        return _ACTIVITY_CATEGORIES[activity] if activity is not None else "other"

    def remember_tool_input(self, event: ToolEvent) -> None:
        """Keep a PRE_TOOL_USE input until its POST_TOOL_USE arrives."""
        tool_use_id = event.data.tool_use_id
        if not tool_use_id or not event.data.tool_input:
            return
        self.tool_inputs[tool_use_id] = event.data.tool_input
        while len(self.tool_inputs) > MAX_REMEMBERED_TOOL_INPUTS:
            self.tool_inputs.popitem(last=False)

    def track_tool_use(self, event: ToolEvent) -> None:
        """Update tool usage statistics from a POST_TOOL_USE event."""
        tool_name = event.data.tool_name or "unknown"
        remembered = (
            self.tool_inputs.pop(event.data.tool_use_id, None) if event.data.tool_use_id else None
        )
        tool_input: dict[str, Any] = event.data.tool_input or remembered or {}
        success = event.data.success
        error_type = event.data.error_type

        category = self.categorize_tool(tool_name)
        self.tool_usage[category] = self.tool_usage.get(category, 0) + 1

        if success is False or error_type:
            self.recent_error_count += 1
            self.consecutive_successes = 0
            self.last_incident_time = datetime.now(UTC).isoformat()
            error_msg = error_type or "unknown error"
            self.add_news_item("error", f"Warning: {tool_name} failed: {error_msg}")
        else:
            self.recent_success_count += 1
            self.consecutive_successes += 1

        subject = tool_subject(tool_name, tool_input)

        if category in ("edit", "write"):
            self.code_written_count += 1
            if subject is not None and subject.kind == "path":
                file_path = subject.value
                file_name = file_path.split("/")[-1] if "/" in file_path else file_path
                self.file_edits[file_name] = self.file_edits.get(file_name, 0) + 1

        if (
            category == "bash"
            and subject is not None
            and subject.kind == "command"
            and "fix" in subject.value.lower()
        ):
            self.bug_fixed_count += 1

        if category == "todo":
            todos_data = tool_input.get("todos", [])
            if isinstance(todos_data, list):
                completed_count = sum(
                    1
                    for t in cast(list[object], todos_data)
                    if isinstance(t, dict) and cast(dict[str, str], t).get("status") == "completed"
                )
                self.task_completed_count = completed_count

    # ------------------------------------------------------------------
    # Agent lifespan tracking
    # ------------------------------------------------------------------

    def record_agent_start(self, agent_id: str, agent_name: str, color: str) -> None:
        """Add a lifespan entry when an agent starts working."""
        self.agent_lifespans.append(
            AgentLifespan(
                agent_id=agent_id,
                agent_name=agent_name,
                color=color,
                start_time=datetime.now(UTC).isoformat(),
                end_time=None,
            )
        )
        if len(self.agent_lifespans) > MAX_AGENT_LIFESPANS:
            self.agent_lifespans = self.agent_lifespans[-MAX_AGENT_LIFESPANS:]

    def record_agent_stop(self, agent_id: str) -> None:
        """Mark a lifespan entry as complete when an agent stops."""
        for lifespan in self.agent_lifespans:
            if lifespan.agent_id == agent_id and lifespan.end_time is None:
                lifespan.end_time = datetime.now(UTC).isoformat()
                break

    # ------------------------------------------------------------------
    # Background task tracking
    # ------------------------------------------------------------------

    def update_background_task(self, task_id: str, status: str, summary: str | None) -> None:
        """Create or update a background task entry."""
        existing_task: BackgroundTask | None = None
        for task in self.background_tasks:
            if task.task_id == task_id:
                existing_task = task
                break

        if existing_task:
            existing_task.status = status
            existing_task.summary = summary
            # Only stamp completed_at when the task reaches a terminal status.
            # A "running" update must not mark an active background task finished.
            if status != "running":
                existing_task.completed_at = datetime.now(UTC).isoformat()
        else:
            new_task = BackgroundTask(
                task_id=task_id,
                status=status,
                summary=summary,
                started_at=datetime.now(UTC).isoformat(),
                completed_at=datetime.now(UTC).isoformat() if status != "running" else None,
            )
            self.background_tasks.insert(0, new_task)

        if len(self.background_tasks) > MAX_BACKGROUND_TASKS:
            self.background_tasks = self.background_tasks[:MAX_BACKGROUND_TASKS]

    # ------------------------------------------------------------------
    # Context compaction
    # ------------------------------------------------------------------

    def record_compaction(self) -> None:
        """Update coffee cup / compaction counters."""
        self.coffee_cups += 1
        self.coffee_break_count += 1

    # ------------------------------------------------------------------
    # Snapshot helpers (for GameState assembly)
    # ------------------------------------------------------------------

    def get_tool_usage_snapshot(self) -> dict[str, int]:
        """Return a copy of the current tool usage dict."""
        return self.tool_usage.copy()

    def get_agent_lifespans_snapshot(self) -> list[AgentLifespan]:
        """Return a copy of the current agent lifespans list."""
        return self.agent_lifespans.copy()

    def get_news_items_snapshot(self) -> list[NewsItem]:
        """Return a copy of the current news items list."""
        return self.news_items.copy()

    def get_file_edits_snapshot(self) -> dict[str, int]:
        """Return a copy of the current file edits dict."""
        return self.file_edits.copy()

    def get_background_tasks_snapshot(self) -> list[BackgroundTask]:
        """Return a copy of the current background tasks list."""
        return self.background_tasks.copy()
