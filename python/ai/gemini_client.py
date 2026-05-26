"""Gemini API client with African engineering context fallback."""

import json
import os
import re
import urllib.error
import urllib.request
from typing import Any

MODEL = "gemini-1.5-flash"


def call_gemini(system: str, user: str) -> dict[str, Any]:
    api_key = os.environ.get("GEMINI_API_KEY", "") or os.environ.get("GOOGLE_API_KEY", "")
    if not api_key:
        return {"error": "no_api_key", "fallback": True}

    # Prepare Gemini API request
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={api_key}"
    
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": user}
                ]
            }
        ],
        "systemInstruction": {
            "parts": [
                {"text": system}
            ]
        },
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2
        }
    }
    
    body = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        
        candidates = data.get("candidates", [])
        if not candidates:
            return {"error": "No candidates returned from Gemini", "fallback": True}
            
        part_text = candidates[0].get("content", {}).get("parts", [])[0].get("text", "")
        return parse_json_response(part_text)
        
    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError, KeyError, IndexError) as e:
        return {"error": str(e), "fallback": True}


def parse_json_response(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    return json.loads(text)
