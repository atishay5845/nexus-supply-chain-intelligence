from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


@dataclass
class Blackboard:
    """Shared state used by every worker. Posts are append-only during a run."""
    scenario: dict[str, Any]
    run_id: str = field(default_factory=lambda: f"NX-{uuid4().hex[:8].upper()}")
    created_at: str = field(default_factory=utc_now)
    posts: list[dict[str, Any]] = field(default_factory=list)
    events: list[dict[str, Any]] = field(default_factory=list)
    decision: dict[str, Any] | None = None

    def event(self, agent: str, message: str, kind: str = "info", details: dict[str, Any] | None = None) -> None:
        self.events.append({
            "event_id": f"EV-{len(self.events) + 1:03d}",
            "timestamp": utc_now(),
            "agent": agent,
            "message": message,
            "kind": kind,
            "details": details or {},
        })

    def post(self, agent: str, payload: dict[str, Any], summary: str) -> dict[str, Any]:
        post = {
            "post_id": f"BB-{len(self.posts) + 1:03d}",
            "agent": agent,
            "timestamp": utc_now(),
            "summary": summary,
            "payload": payload,
        }
        self.posts.append(post)
        self.event(agent, summary, "success", {"post_id": post["post_id"]})
        return post

    def read(self, agent: str) -> dict[str, Any] | None:
        for post in reversed(self.posts):
            if post["agent"] == agent:
                return post["payload"]
        return None

    def to_dict(self) -> dict[str, Any]:
        return {
            "run_id": self.run_id,
            "created_at": self.created_at,
            "scenario": self.scenario,
            "posts": self.posts,
            "events": self.events,
            "decision": self.decision,
        }
