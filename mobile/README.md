# ARCHITEX-CAD Mobile Companion

React Native (Expo SDK 50) field app for construction sites.

## Features
- Daily site reports (offline-first)
- GPS-tagged photo capture
- Inspection checklists
- Quick calculators (concrete, rebar, beam)
- Sync to desktop API on WiFi

## Setup
```bash
cd mobile
npm install
npx expo start
```

Configure desktop IP in `src/services/sync.ts`.

## Sync endpoint
Mobile pushes to `POST http://<desktop-ip>:8000/sync/receive`
