# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**UrbanHelper / شهریاور** — a citizen urban-issue reporting platform (BSc final project). Citizens report problems (in-app camera photo + device GPS + description); city staff triage and resolve them through a map dashboard. The authoritative spec is the proposal PDF (`پروپوزال (1).pdf`) at the repo root — when in doubt about intended behavior, it is the source of truth.

## Architecture (read this first)

Three deployable apps, one Django backend with two React SPAs, all orchestrated by `docker-compose.yml`.

### Backend (`backend/`) — Django 6 + DRF + Channels, modular monolith
The Django apps split by **responsibility, not by the usual Django convention**:

- **`civic_api/`** — the **live HTTP + WebSocket layer**. This is where the real `ReportViewSet`/`CategoryViewSet` (`viewsets.py`), permissions, guest-token logic, JWT register (`views_auth.py`), and the Channels consumers live.
- **`reports/`** — **models, serializers, admin only**. ⚠️ `reports/views.py` and `reports/urls.py` contain a *second, stubbed, dead* `ReportViewSet` (with literal `...`). It is NOT wired up — `core/urls.py` includes `reports.urls`, which imports the viewsets from **`civic_api`**. Always edit `civic_api/viewsets.py` for API behavior; ignore `reports/views.py`.
- **`nlp/`** — async report analysis (see NLP section).
- **`core/`** — settings, URL routing, ASGI (Daphne), Celery app.

Key cross-cutting flows:
- **GeoJSON everywhere.** `ReportSerializer` is a `GeoFeatureModelSerializer`, so list responses are GeoJSON `FeatureCollection` and a single report is a `Feature` (fields live under `.properties`, geometry under `.geometry.coordinates` as `[lng, lat]`). Both frontends normalize this with `flattenFeatures()` in their `api/client.js`. PostGIS is mandatory — geo filtering uses `DistanceToPointFilter`.
- **Report lifecycle is a guarded state machine.** Allowed transitions are defined in `reports/serializers.py` (`ALLOWED_STATUS_TRANSITIONS`). Staff change status via the `POST /api/reports/{id}/transition/` action (`ReportTransitionSerializer`), which enforces transitions and requires an `image_after` to reach `RESOLVED`. Do not bypass this map when changing status logic.
- **Dual access model.** Reports can be created anonymously (`AllowAny` on create). For a guest report, the server issues a **guest token stored in Redis db=1** (`civic_api/guest_tokens.py`) and returns it in the create response; the citizen uses it to view/subscribe to that one report. Registered users see only their own reports; `is_staff` users see all.
- **Real-time updates** go out over Channels WebSockets, not push. A `post_save` signal (`civic_api/signals.py`) broadcasts to group `report_{id}`; clients connect to `ws/reports/{id}/` authenticating via either `?access=<JWT>` or `?guest_token=<token>`. Channels layer + Celery broker are the same Redis (db 0 for Celery).
- **Trusted-capture metadata** (anti-fraud): `Report` stores `capture_source`, `captured_at`, `gps_accuracy`, `client_integrity_hash`. These are write-once at create time — `ReportSerializer.update()` strips them so staff edits can never rewrite the original capture record.

### NLP pipeline (`backend/nlp/`)
`service.analyze_report()` runs: **crisis keywords** (`crisis_keywords.py`, weighted, sets `is_urgent`) → **local sklearn classifier** (`classifier.py`, TF-IDF char n-grams + LinearSVC) → **Gemini fallback** only when classifier confidence < 0.40 (needs `GEMINI_API_KEY`) → **Persian sentiment** (`sentiment.py`, lexicon-based). It runs **asynchronously**: `perform_create` enqueues `nlp.tasks.process_report_nlp` on Celery, which writes results back to `report.nlp_meta` and `nlp_suggested_category`. The trained model is pickled to `nlp/model_files/` and lazy-trained on first use if absent.

### Frontends — two separate Vite + React 19 SPAs
- **`frontend-citizen/`** — public reporting app. **Tailwind** (RTL Persian, `Vazirmatn` font, `brand-*` palette). Report creation uses an **in-app camera** (`components/CameraCapture.jsx`, `getUserMedia` → canvas → JPEG) bound to device GPS (`hooks/useGeolocation.js`) — gallery upload is intentionally not offered. Offline-First queue lives in **IndexedDB** (`api/offline.js`) and auto-syncs on the `online` event.
- **`frontend-admin/`** — staff dashboard. **MUI** (with `stylis-plugin-rtl`) + Leaflet (`react-leaflet-cluster`) map + Recharts. Requires an `is_staff` account to log in.

Both store JWTs in `localStorage` and attach `Authorization: Bearer` via an axios interceptor.

## Commands

Everything runs through Docker; the backend image needs GDAL (already in `backend/Dockerfile`).

```bash
# Full stack (db+redis+backend+celery+both frontends). Migrations run on backend start.
docker compose up --build

# Ports:  backend http://localhost:8080  (+ ws://localhost:8080)
#         citizen http://localhost:3001   admin http://localhost:3002
#         postgres :5433 (host) → 5432     redis :6379
# API docs (Swagger): http://localhost:8080/api/docs/   Django admin: /admin/

# Backend management (run inside the container)
docker compose exec backend python manage.py createsuperuser   # create a staff user for the admin SPA
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py test              # Django tests (test files are currently stubs)
docker compose exec backend python manage.py test reports.tests # a single test module/class/method

# NLP model training / evaluation
docker compose exec backend python manage.py train_nlp           # train + save pickle
docker compose exec backend python manage.py train_nlp --eval    # evaluate existing model (CV accuracy)
docker compose exec backend python manage.py train_nlp --from-db # include admin-confirmed RESOLVED/CLOSED reports

# Frontends (inside either frontend dir; deps are installed in the image, not committed)
npm run dev      # vite dev server
npm run build    # production build
npm run lint     # eslint
```

API testing collection: `backend/postman/UrbanHelper.postman_collection.json`.

## Conventions & gotchas

- **Persian/RTL is the default UI language**; user-facing strings, model `verbose_name`s, and status labels are in Farsi. Keep new strings consistent.
- **Secrets via env** (`.env`, loaded by docker-compose): `GEMINI_API_KEY`, `DB_*`, `REDIS_*`, `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`. `DEBUG` and the `SECRET_KEY` fall back to insecure dev defaults in `settings.py` — never rely on those in a deployed setting.
- **Migrations are hand-checked.** When changing `reports/models.py`, generate the migration and verify it; the capture-metadata migration (`0004`) was authored manually.
- Junk/dead artifacts exist in the tree (`reports/models.py.bak`, `reports_models_updated.py`, `PATCHES.py`, `tmp.js`, committed `backend/venv/`, legacy `frontend/`). Don't treat them as live code.
