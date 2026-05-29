# ARCHITEX-CAD — Architecture

## Overview

ARCHITEX-CAD is a desktop engineering workstation built as an Electron application with a React frontend and a FastAPI Python backend. It targets civil engineers in Zambia and Sub-Saharan Africa.

```
┌─────────────────────────────────────────────────────────────┐
│  Electron Shell                                             │
│  ┌─────────────────────────────┐  ┌──────────────────────┐ │
│  │  React / TypeScript (Vite)  │  │  FastAPI / Python    │ │
│  │  src/                       │  │  python/             │ │
│  │  ├── components/            │  │  ├── main.py         │ │
│  │  │   ├── Calculator/        │  │  ├── routers/        │ │
│  │  │   ├── BIMViewer/         │  │  ├── calculations/   │ │
│  │  │   ├── Government/        │  │  ├── calculators/    │ │
│  │  │   ├── Intelligence/      │  │  ├── simulations/    │ │
│  │  │   └── ...21 panels       │  │  ├── government/     │ │
│  │  ├── store/ (Zustand)       │  │  ├── intelligence/   │ │
│  │  └── services/              │  │  └── ...             │ │
│  └────────────┬────────────────┘  └──────────┬───────────┘ │
│               │  HTTP :5173                   │  :8000      │
│               └───────────────────────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Shell | Electron 28 |
| Frontend | React 18 + TypeScript + Vite |
| State | Zustand |
| 3D Viewer | xeokit-sdk + web-ifc |
| Backend | FastAPI + Uvicorn |
| Calculations | NumPy, SciPy, Pydantic |
| Database | SQLite (via better-sqlite3 / Python sqlite3) |
| Migrations | Alembic (government portfolio DB) |
| Tests | pytest (Python) + Vitest (TypeScript) |
| CI | GitHub Actions |

## Repository Layout

```
InFra_TeCh/
├── src/                        # React frontend
│   ├── components/             # UI panels (21 sidebar sections)
│   │   ├── Calculator/         # 53 engineering calculator modules
│   │   ├── BIMViewer/          # IFC/DXF 3D viewer + CAD tools
│   │   ├── Government/         # Portfolio dashboard
│   │   ├── Intelligence/       # Digital twin + collaboration
│   │   └── ...
│   ├── store/                  # Zustand state (one file per domain)
│   ├── services/               # API clients (boqAPI, emergingAPI, etc.)
│   └── tests/                  # Vitest unit tests
│
├── python/                     # FastAPI backend
│   ├── main.py                 # App setup + router includes
│   ├── routers/                # Domain-split FastAPI routers
│   │   ├── government.py       # Portfolio CRUD
│   │   ├── real_estate.py      # Valuation, feasibility, mortgage
│   │   ├── intelligence.py     # Digital twin, collab, cache, sync
│   │   ├── documents.py        # Tender, EIA, ESG, mobile quick-calc
│   │   └── emerging.py         # Emerging tech + physics simulations
│   ├── calculations/           # Core calculation engines (pure Python)
│   │   ├── structural/         # BS 8110, EC2 beam/slab/column/foundation
│   │   ├── wash/               # Water demand, borehole, WASH design
│   │   ├── geo/                # Bearing capacity, settlement, slope
│   │   ├── roads/              # Pavement, drainage, gravel road
│   │   ├── energy/             # Solar PV, battery storage
│   │   └── utils/              # Validators, formatters
│   ├── calculators/            # FastAPI-level handlers with Pydantic
│   ├── simulations/            # Physics simulation engines
│   ├── government/             # Portfolio database + EVM engine
│   ├── intelligence/           # Digital twin + predictive maintenance
│   ├── migrations/             # Alembic migrations (portfolio DB)
│   └── tests/                  # pytest: test_verification.py, test_golden.py
│
├── electron/                   # Electron main process
├── .github/workflows/ci.yml    # CI: Python tests + TypeScript + lint
├── pyproject.toml              # ruff + pytest config
└── ARCHITECTURE.md             # This file
```

## Backend API Structure

Routes are organised by domain. `main.py` is the entry point; domain routers live in `python/routers/`.

| Router | Prefix | Routes | Description |
|--------|--------|--------|-------------|
| main.py | `/calculate/*`, `/wash/*`, `/geo/*`, `/energy/*`, `/roads/*`, `/power/*`, `/fea/*`, `/seismic/*`, `/structural/*`, `/pressure/*`, `/circuit/*`, `/wind/*`, `/boq/*`, `/project/*`, `/verification/*`, `/site/*`, `/geotechnical/*`, `/bim/*`, `/geometry/*`, `/vision/*`, `/ai/*`, `/real-estate/*`, `/geo/*`, `/reviews/*`, `/export/*`, `/materials/*` | ~170 | Core calculations + BIM + AI |
| government.py | `/government/*` | 12 | Portfolio dashboard CRUD |
| real_estate.py | `/real-estate/*` | 4 | Valuation, feasibility, land use, mortgage |
| intelligence.py | `/intelligence/*`, `/collaboration/*`, `/schedule/*`, `/optimize/*`, `/sync/*`, `/cache/*` | 21 | Digital twin, collab, scheduling |
| documents.py | `/documents/*`, `/mobile/*` | 5 | Tender, EIA, ESG, mobile quick-calc |
| emerging.py | `/emerging/*`, `/simulate/*`, `/generate/*` | 11 | Emerging tech + thermal/seismic sim |

## Adding a New Calculator Module

1. **Backend** — add calculation logic to `python/calculations/<domain>/` and register a route in `python/main.py` (or create a new router in `python/routers/`).
2. **Type** — add the new module ID to `CalculationModule` union in `src/types/calculations.ts`.
3. **Default inputs** — add to `DEFAULT_INPUTS` in `src/store/calculationStore.ts`.
4. **Component** — create `src/components/Calculator/modules/<Name>Calculator.tsx`.
5. **Panel** — add to `MODULES_BY_CATEGORY` and `renderModule()` in `src/components/Calculator/CalculatorPanel.tsx`.
6. **Inline** — if the component manages its own Calculate button, add to `MODULES_WITH_INLINE_CALCULATE` in `calculatorModuleUtils.ts`.

## Calculation Engine Design

All Python calculation functions follow this contract:
- Input: `dict[str, Any]`
- Output: `{"status": "pass"|"fail"|"warning", "summary": {...}, "steps": [...], "warnings": [...], "errors": [...]}`
- Wrapped by `wrap_calculation_result()` from `calculations.core.engineer_control` before returning to the frontend

Input validation runs before any calculation:
- `validate_material_grades(fcu, fy)` — rejects implausible grades
- `validate_cover_feasibility(cover, h, bar_dia, link_dia)` — rejects negative effective depth
- Domain-specific guards (e.g. `ks > 0` for Winkler, `radius > 0` for borehole)

## Data Stores

| Database | Location | Contents | Migrations |
|----------|----------|----------|-----------|
| Portfolio | `python/government/portfolio.db` | Projects, snapshots, variations | Alembic (`python/migrations/`) |
| Digital twin | `python/intelligence/twin.db` | Assets, sensor readings | Manual (sqlite3) |
| Calculations | `python/data/projects.db` | Calculation history per project | Manual (sqlite3) |

## Security

- CORS restricted to `localhost:517x`, `127.0.0.1:517x`, and `app://.` (Electron)
- Security headers on all responses: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`
- No authentication needed for local desktop app; all data stored locally
- Input validation via Pydantic (HTTP layer) + domain validators (calculation layer)

## Testing

```bash
# Python
cd python && pytest tests/ -v

# TypeScript
npm run test:unit:run

# CI (GitHub Actions) — runs on every push to main/dev
```

Golden tests (`python/tests/test_golden.py`) assert known-answer results for critical calculations and GIGO guards — these are the canary for silent regressions.
