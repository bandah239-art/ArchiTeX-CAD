"""Drone photogrammetry via a WebODM / NodeODM server.

Enabled when WEBODM_URL is set. Submits image references to the server's task API
and returns the task handle. Heavy reconstruction runs on the WebODM server, not
in this process.
"""

from __future__ import annotations

import json
import os
import urllib.request
from typing import Any


def _auth_header() -> dict[str, str]:
    token = os.environ.get("WEBODM_TOKEN", "").strip()
    return {"Authorization": f"JWT {token}"} if token else {}


def submit_task(webodm_url: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Create a processing task on WebODM/NodeODM.

    Image upload itself is multipart and environment-specific; this creates the
    task envelope and returns the endpoint the client should stream images to.
    """
    base = webodm_url.rstrip("/")
    images = payload.get("images", []) or []
    options = payload.get("options", {"orthophoto-resolution": 5})

    project_endpoint = f"{base}/api/projects/"
    req = urllib.request.Request(
        project_endpoint,
        data=json.dumps({"name": payload.get("project_name", "ArchiTeX Survey")}).encode(),
        headers={"Content-Type": "application/json", **_auth_header()},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        project = json.loads(resp.read())

    return {
        "webodm_url": base,
        "project_id": project.get("id"),
        "images_queued": len(images),
        "options": options,
        "upload_endpoint": f"{base}/api/projects/{project.get('id')}/tasks/",
        "note": "Stream image files to upload_endpoint as multipart 'images[]' to start processing.",
    }
