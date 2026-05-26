"""Claude API client with African engineering context fallback."""

import json
import os
import re
from typing import Any

import anthropic

MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 4000


def call_claude(system: str, user: str) -> dict[str, Any]:
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        return {"error": "no_api_key", "fallback": True}

    try:
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        text = "".join(
            block.text for block in message.content if block.type == "text"
        )
        return parse_json_response(text)
    except anthropic.APIError as e:
        return {"error": str(e), "fallback": True}


def parse_json_response(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    return json.loads(text)
