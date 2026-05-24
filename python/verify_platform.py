"""Smoke test for platform tier endpoints (schedule, cache, ESG, emerging, simulations)."""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8000"


def post(path: str, payload: dict) -> dict:
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def get(path: str) -> dict:
    with urllib.request.urlopen(f"{BASE}{path}", timeout=15) as resp:
        return json.loads(resp.read())


def main() -> int:
    tests = []

    def check(name: str, fn):
        try:
            fn()
            tests.append((name, True, ""))
        except Exception as e:
            tests.append((name, False, str(e)))

    check("health", lambda: get("/health"))

    check(
        "schedule",
        lambda: post(
            "/schedule/build-from-bim",
            {
                "project_name": "Verify",
                "elements": [
                    {"type": "IfcWall", "name": "W1", "volume": 12.5},
                    {"type": "IfcSlab", "name": "S1", "area": 80},
                ],
            },
        ),
    )

    check(
        "esg",
        lambda: post(
            "/documents/esg-report",
            {"project_name": "Verify", "material_totals": {"concrete_c25": 10}},
        ),
    )

    check(
        "thermal",
        lambda: post(
            "/simulate/thermal",
            {"payload": {"floor_area_m2": 100, "wall_area_m2": 200, "internal_temp_c": 22, "external_temp_c": 32}},
        ),
    )

    check(
        "seismic",
        lambda: post(
            "/simulate/seismic",
            {"payload": {"mass_kg": 50000, "stiffness_kn_m": 1200, "damping_ratio": 0.05, "pga_g": 0.15}},
        ),
    )

    check(
        "geocode",
        lambda: post("/geo/geocode", {"query": "Lusaka Zambia"}),
    )

    check(
        "site budget",
        lambda: post(
            "/geo/site-budget",
            {
                "latitude": -15.4167,
                "longitude": 28.2833,
                "country_code": "ZM",
                "project_type": "residential",
                "gfa_m2": 142,
            },
        ),
    )

    check("blockchain stub", lambda: post("/emerging/blockchain/anchor", {"payload": {"asset_id": "test"}}))
    check("marketplace stub", lambda: get("/emerging/marketplace?country_code=ZM"))
    check("satellite stub", lambda: post("/emerging/satellite/analyse", {"payload": {"lat": -15.4, "lon": 28.3}}))

    check(
        "project cache",
        lambda: post("/cache/project", {"name": "Cached", "ifc_path": "/tmp/test.ifc"}),
    )

    passed = sum(1 for _, ok, _ in tests if ok)
    for name, ok, err in tests:
        status = "PASS" if ok else "FAIL"
        print(f"[{status}] {name}" + (f" — {err}" if err else ""))

    print(f"\n{passed}/{len(tests)} platform checks passed")
    return 0 if passed == len(tests) else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except urllib.error.URLError as e:
        print(f"Server not reachable at {BASE}: {e}")
        sys.exit(2)
