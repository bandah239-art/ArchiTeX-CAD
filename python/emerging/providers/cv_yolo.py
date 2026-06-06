"""YOLO-based construction-site PPE detection (ultralytics).

Enabled when `ultralytics` is installed. The first call downloads model weights.
PPE classes are mapped from a generic COCO model; for production accuracy, point
MODEL_PATH at a hard-hat/vest-trained checkpoint.
"""

from __future__ import annotations

import io
import os
from typing import Any

# COCO 'person' is the anchor; a PPE-specific model should override via MODEL_PATH.
MODEL_PATH = os.environ.get("CV_SAFETY_MODEL", "yolov8n.pt")

_PPE_LABELS = {"hard_hat", "helmet", "high_vis_vest", "vest", "person", "no_helmet", "no_vest"}

_model = None


def _load_model():
    global _model
    if _model is None:
        from ultralytics import YOLO  # lazy import

        _model = YOLO(MODEL_PATH)
    return _model


def detect_ppe(image_bytes: bytes, payload: dict[str, Any]) -> dict[str, Any]:
    from PIL import Image

    conf = float(payload.get("confidence", 0.35))
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    model = _load_model()
    results = model.predict(img, conf=conf, verbose=False)

    counts: dict[str, int] = {}
    persons = 0
    for r in results:
        names = r.names
        for cls_id in (r.boxes.cls.tolist() if r.boxes is not None else []):
            label = str(names.get(int(cls_id), int(cls_id))).lower().replace(" ", "_")
            counts[label] = counts.get(label, 0) + 1
            if label == "person":
                persons += 1

    helmets = counts.get("hard_hat", 0) + counts.get("helmet", 0)
    vests = counts.get("high_vis_vest", 0) + counts.get("vest", 0)
    missing = max(0, persons - min(helmets, vests)) if persons else 0
    safety_score = 100 if persons == 0 else max(0, round(100 * (1 - missing / persons)))

    return {
        "model": MODEL_PATH,
        "persons_detected": persons,
        "raw_counts": counts,
        "detections": [
            {"class": "hard_hat", "count": helmets, "compliant": helmets >= persons},
            {"class": "high_vis_vest", "count": vests, "compliant": vests >= persons},
            {"class": "missing_ppe", "count": missing, "compliant": missing == 0},
        ],
        "safety_score": safety_score,
        "note": (
            "Counts use a generic detector unless CV_SAFETY_MODEL points to a PPE-trained "
            "checkpoint. Tune `confidence` to reduce false positives."
        ),
    }
