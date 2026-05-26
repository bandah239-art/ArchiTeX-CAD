import json
import urllib.request

tests = [
    "open the energy panel",
    "switch to the GIS map",
    "go to the boq",
    "show me the satellite view",
    "open wash",
    "navigate to geo",
    "calculate a pile foundation",
    "build a 5 meter wall",
    "help",
]

for cmd in tests:
    body = json.dumps({"command": cmd}).encode("utf-8")
    req = urllib.request.Request(
        "http://127.0.0.1:8000/ai/voice-command",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            intent = data.get('intent', '?')
            spoken = data.get('spoken_response', '?')
            payload = data.get('payload', {})
            print(f"'{cmd}' => [{intent}] {spoken}")
            if payload:
                print(f"   payload: {json.dumps(payload)}")
            print()
    except Exception as e:
        print(f"'{cmd}' => FAILED: {e}\n")
