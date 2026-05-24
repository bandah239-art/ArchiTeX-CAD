"""Desktop offline sync batch processor."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from sync.mobile_sync import receive_sync_item, list_sync_items


def process_sync_batch(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Accept batch operations from Electron offline queue.
    Returns accepted ops, conflicts, and server-side changes.
    """
    operations = payload.get("operations", [])
    accepted: list[dict[str, Any]] = []
    conflicts: list[dict[str, Any]] = []

    for op in operations:
        op_id = op.get("id") or str(uuid.uuid4())
        try:
            data = json.loads(op.get("data", "{}")) if isinstance(op.get("data"), str) else op.get("data", {})
            receive_sync_item({
                "id": op_id,
                "type": op.get("table_name", "desktop_sync"),
                "project_id": data.get("project_id", ""),
                "payload": data,
                "operation": op.get("operation", "UPDATE"),
            })
            accepted.append({"id": op_id, "revision": int(datetime.now(timezone.utc).timestamp())})
        except Exception as exc:
            conflicts.append({"local_id": op_id, "error": str(exc)})

    server_changes = list_sync_items(limit=20)

    return {
        "status": "complete",
        "accepted": accepted,
        "conflicts": conflicts,
        "server_changes": server_changes,
        "pushed": len(accepted),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
