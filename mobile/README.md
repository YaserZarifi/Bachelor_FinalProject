# شهریاور — Mobile (Expo / React Native)

The **citizen** mobile app for UrbanHelper / شهریاور. Built with Expo (SDK 52),
expo-router, and a custom *Aurora Glass* design system that mirrors the web
citizen app (civic indigo + aurora accents, glassmorphism, Vazirmatn, RTL).

## Features

- **First-run onboarding** — animated intro slides introducing the app.
- **Guest-first reporting** — report immediately, no account needed; optional
  login/register to track all your reports across devices.
- **In-app live camera** — anti-fraud capture (`expo-camera`); gallery upload is
  intentionally not offered, matching the web app.
- **Automatic precise GPS** + a client-side **integrity hash** binding image +
  location + timestamp (`expo-crypto`).
- **Offline-first** — reports captured offline are queued (`AsyncStorage` +
  `expo-file-system`) and auto-sync when connectivity returns (`NetInfo`).
- **Live status** over the Channels WebSocket + **push notifications** when a
  report's status changes (works even when the app is closed).
- **My Reports** list, **report detail** with a status timeline and before/after
  photos, and a **Profile** tab.

## Prerequisites

- Node 18+ and the **Expo Go** app on your phone (or an emulator/simulator).
- The backend stack running (`docker compose up` at the repo root → API on
  `http://localhost:8080`).

## Setup & run

```bash
cd mobile
npm install

# Point the app at your backend (see .env.example).
# On a physical device you MUST use your PC's LAN IP, not localhost:
cp .env.example .env
#   EXPO_PUBLIC_API_BASE=http://<your-LAN-ip>:8080
#   EXPO_PUBLIC_WS_BASE=ws://<your-LAN-ip>:8080

npx expo start            # scan the QR with Expo Go
# or: npm run android / npm run ios
```

> If versions ever drift, run `npx expo install --fix` to reconcile native deps
> with the installed Expo SDK.

### Making the backend reachable from a device

`docker-compose` already exposes the API on `:8080`. For a physical phone, also
allow your device origin for the WebSocket validator — set on the backend:

```
WEBSOCKET_ALLOWED_ORIGINS=http://localhost:3001,http://<your-LAN-ip>:8080
```

(HTTP requests don't need CORS from a native app; the WS `OriginValidator` does.)

## Push notifications

- The app registers an **Expo push token** with the backend
  (`POST /api/push/register/`). Signed-in users are notified for all their
  reports; guests bind the token to a single report via its `guest_token`.
- The backend sends a push via the Expo Push API from a Celery task
  (`pushnotify.tasks.send_status_push`) whenever a report's `status` changes
  (detected in `civic_api/signals.py`).
- Push tokens require a **physical device** (not a simulator). Foreground status
  changes also surface an in-app banner + toast via the live WebSocket.

## Development build (required for real closed-app push)

Expo Go (SDK 53+) dropped remote-push support, so in Expo Go the app falls back
to **live WebSocket updates + local notifications** (fully functional for the
demo). To exercise the **real Expo push token → backend → closed-app push**
path, build a **development build** with EAS (`eas.json` is included):

```bash
npm i -g eas-cli
eas login                 # needs a free Expo account
eas init                  # creates the project + writes extra.eas.projectId into app.json
eas build --profile development --platform android   # cloud build → installable APK
```

Install the resulting APK on your device, then run `npx expo start --dev-client`
(instead of Expo Go) and open it from the dev build.

**Android push credentials:** Expo's push service delivers to Android via FCM.
On first `eas build` for a real push, configure FCM V1 credentials when prompted
(EAS walks you through it / can manage them). Once `extra.eas.projectId` exists,
`getExpoPushTokenAsync` returns a token and the backend `pushnotify` flow sends
status-change pushes that arrive even when the app is closed.

Other build profiles in `eas.json`: `preview` (standalone internal APK, no dev
client) and `production`.

## Project layout

```
mobile/
├─ app/                       # expo-router routes
│  ├─ _layout.jsx             # fonts, providers, splash, notification-tap routing
│  ├─ index.jsx               # first-run gate → onboarding or tabs
│  ├─ onboarding.jsx          # intro slides
│  ├─ (tabs)/                 # Home · Reports · Profile (+ center "report" FAB)
│  ├─ report/new.jsx          # capture → details → review wizard
│  ├─ report/[id].jsx         # detail + live status + alerts
│  └─ auth/{login,register}.jsx
└─ src/
   ├─ theme.js                # Aurora Glass design tokens
   ├─ api/                    # client (JWT+refresh, GeoJSON), reports, auth, push, offline, integrity
   ├─ components/             # UI kit (GlassCard, Button, StatusTimeline, ...)
   ├─ context/AuthContext.jsx
   ├─ hooks/                  # useLocation, useReportSocket
   └─ notifications/          # Expo push registration + manager
```

## Assets

`assets/*.png` (icon, adaptive icon, splash, favicon) are generated brand
artwork — the Aurora indigo→cyan gradient with a white location-pin glyph.
Swap in custom artwork anytime; keep the same filenames referenced in
`app.json`.
