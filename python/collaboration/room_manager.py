"""Real-time collaboration room manager."""

import json
from datetime import datetime, timezone
from typing import Any

# In-memory room state (production would use Redis)
_rooms: dict[str, dict[str, Any]] = {}
_connections: dict[str, list[str]] = {}  # project_id -> [user_ids]


def join_room(project_id: str, user_id: str, user_name: str) -> dict[str, Any]:
    if project_id not in _rooms:
        _rooms[project_id] = {"users": {}, "events": [], "updated_at": _now()}
    room = _rooms[project_id]
    room["users"][user_id] = {"name": user_name, "joined_at": _now()}
    _connections.setdefault(project_id, [])
    if user_id not in _connections[project_id]:
        _connections[project_id].append(user_id)
    room["updated_at"] = _now()
    return room_status(project_id)


def leave_room(project_id: str, user_id: str) -> dict[str, Any]:
    room = _rooms.get(project_id)
    if room and user_id in room["users"]:
        del room["users"][user_id]
    if project_id in _connections and user_id in _connections[project_id]:
        _connections[project_id].remove(user_id)
    return room_status(project_id)


def broadcast_event(project_id: str, user_id: str, event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    if project_id not in _rooms:
        _rooms[project_id] = {"users": {}, "events": [], "updated_at": _now()}
    event = {
        "id": f"EVT-{len(_rooms[project_id]['events']) + 1}",
        "type": event_type,
        "user_id": user_id,
        "payload": payload,
        "timestamp": _now(),
    }
    _rooms[project_id]["events"].append(event)
    _rooms[project_id]["events"] = _rooms[project_id]["events"][-100:]
    _rooms[project_id]["updated_at"] = _now()
    return event


def room_status(project_id: str) -> dict[str, Any]:
    room = _rooms.get(project_id, {"users": {}, "events": []})
    return {
        "project_id": project_id,
        "active_users": list(room.get("users", {}).values()),
        "user_count": len(room.get("users", {})),
        "recent_events": room.get("events", [])[-10:],
        "updated_at": room.get("updated_at", _now()),
    }


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def handle_message(project_id: str, user_id: str, raw: str) -> dict[str, Any] | None:
    try:
        msg = json.loads(raw)
    except json.JSONDecodeError:
        return None
    action = msg.get("action", "ping")
    if action == "join":
        return {"type": "room_state", "data": join_room(project_id, user_id, msg.get("user_name", user_id))}
    if action == "leave":
        return {"type": "room_state", "data": leave_room(project_id, user_id)}
    if action == "broadcast":
        event = broadcast_event(project_id, user_id, msg.get("event_type", "update"), msg.get("payload", {}))
        return {"type": "event", "data": event}
    if action == "ping":
        return {"type": "pong", "data": {"timestamp": _now()}}
    return None
