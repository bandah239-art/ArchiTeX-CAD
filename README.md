# INFRAFRICA

Calculation Engine + BIM Viewer — Desktop application for structural engineering calculations and IFC model viewing.

## Stack

- **Desktop:** Electron 28 + React 18 + TypeScript + Vite + Tailwind CSS
- **BIM:** @xeokit/xeokit-sdk + web-ifc
- **Calculations:** Python 3.11 + FastAPI (Eurocode 2)

## Prerequisites

- **Node.js** 18+ and npm 10+
- **Python** 3.11+ ([python.org/downloads](https://www.python.org/downloads/)) — on Windows, enable **"Add python.exe to PATH"** during install

## Quick Start

### 1. Install dependencies

```bash
npm install
py -3 -m pip install -r python/requirements.txt
```

On macOS/Linux use `python3 -m pip` instead of `py -3 -m pip`.

### 2. Start Python calculation server

```bash
npm run python:dev
```

Test: `curl http://localhost:8000/health`

### 3. Start frontend (browser dev)

```bash
npm run dev
```

### 4. Start full Electron app

```bash
npm run electron:dev
```

## Project Structure

See the technical blueprint for full architecture. Key folders:

- `electron/` — Main process, preload IPC bridge, native menu
- `src/` — React UI (BIM viewer, calculator panel, stores)
- `python/` — FastAPI server with Eurocode 2 calculations

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health check |
| POST | `/calculate/beam` | Beam design (EC2) |
| POST | `/calculate/slab` | Slab design |
| POST | `/calculate/column` | Column design |
| POST | `/calculate/foundation` | Foundation design |
| POST | `/calculate/loads` | Load combinations |
| POST | `/calculate/road/pavement` | Pavement design |
| POST | `/calculate/road/drainage` | Drainage design |
