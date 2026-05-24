"""WebSocket connection registry for collaboration rooms."""

from __future__ import annotations

from typing import Any

from fastapi import WebSocket

_rooms: dict[str, dict[str, WebSocket]] = {}


def register(project_id: str, user_id: str, ws: WebSocket) -> None:
    _rooms.setdefault(project_id, {})[user_id] = ws


def unregister(project_id: str, user_id: str) -> None:
    room = _rooms.get(project_id)
    if room and user_id in room:
        del room[user_id]
    if room and not room:
        del _rooms[project_id]


async def broadcast(project_id: str, message: dict[str, Any], exclude_user: str | None = None) -> None:
    room = _rooms.get(project_id, {})
    dead: list[str] = []
    for uid, ws in room.items():
        if exclude_user and uid == exclude_user:
            continue
        try:
            await ws.send_json(message)
        except Exception:
            dead.append(uid)
    for uid in dead:
        unregister(project_id, uid)


def online_users(project_id: str) -> list[str]:
    return list(_rooms.get(project_id, {}).keys())
