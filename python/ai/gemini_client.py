"""Gemini API client with African engineering context fallback."""

import json
import os
import re
import urllib.error
import urllib.request
from typing import Any

# Load .env file manually if it exists in the parent or current directory
for folder in [os.path.dirname(os.path.abspath(__file__)), os.path.dirname(os.path.dirname(os.path.abspath(__file__)))]:
    env_path = os.path.join(folder, ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ[key.strip()] = val.strip()

MODEL = "gemini-1.5-flash"

CHAT_SYSTEM = """You are ARCH, the AI assistant embedded in ArchiTeX CAD — a professional infrastructure engineering platform built for Africa.
You help engineers with structural design, WASH, energy, geotechnical, roads, BIM, and project management.
Answer clearly and concisely. When a user asks you to perform a calculation or navigate the app, say what you would do.
Do not use markdown headers. Keep replies conversational but technically precise."""


def call_gemini_chat(system: str, user: str) -> str:
    """Call Gemini and return a plain-text response (for free-form chat)."""
    api_key = os.environ.get("GEMINI_API_KEY", "") or os.environ.get("GOOGLE_API_KEY", "")
    if not api_key:
        return "I'm offline — no API key found. Please set GEMINI_API_KEY in your .env file."

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={api_key}"

    payload = {
        "contents": [{"parts": [{"text": user}]}],
        "systemInstruction": {"parts": [{"text": system}]},
        "generationConfig": {"temperature": 0.7},
    }

    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        candidates = data.get("candidates", [])
        if not candidates:
            return "No response from Gemini."
        return candidates[0].get("content", {}).get("parts", [])[0].get("text", "").strip()
    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError, KeyError, IndexError) as e:
        return f"Gemini error: {e}"


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
