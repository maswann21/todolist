# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run dev server (requires .env with real DATABASE_URL)
uvicorn main:app --reload

# Run all tests (uses SQLite, no DB connection needed)
python -m pytest tests/ -v

# Run a single test file
python -m pytest tests/test_api_tasks.py -v

# Run a single test
python -m pytest tests/test_api_tasks.py::test_create_task -v

# Install dependencies
pip install -r requirements.txt
```

## Environment Setup

Copy `.env` and fill in the real Neon PostgreSQL URL:
```
DATABASE_URL=postgresql+asyncpg://user:pass@host/dbname
```

The app auto-creates tables and seeds 6 categories on startup via the `lifespan` handler in `main.py`.

## Architecture

**Backend:** FastAPI + SQLAlchemy 2.0 async + Neon PostgreSQL (cloud)
**Frontend:** Vanilla HTML/CSS/JS served as static files by FastAPI
**Tests:** pytest-asyncio with SQLite (aiosqlite) — no real DB needed

### Data model

```
Category (6 seeded: 업무/공부/운동/수면/생활/여가 with hex colors)
    └── Task (belongs to DailyPage + Category)
            └── TimeBlock (start_at, end_at TIME columns, 10-min snapped)

DailyPage (one per date, auto-created on first GET)
    └── Task[]
```

`DailyPage` is the container for a day. Accessing `GET /api/daily-pages/2026-03-21` creates it if it doesn't exist. `TimeBlock` overlap is checked across the whole day (all tasks), not just within one task.

### API layout

All API routes are under `/api/`:
- `/api/categories` — GET list
- `/api/daily-pages/{date}` — GET-or-create, PUT (comment/memo/d_day_label), GET `?month=YYYY-MM`
- `/api/daily-pages/{date}/tasks` — POST create task
- `/api/tasks/{id}` — PUT (title/category/priority/status), DELETE
- `/api/tasks/{id}/time-blocks` — POST (with overlap check + 10-min snap)
- `/api/time-blocks/{id}` — PUT, DELETE
- `/api/analytics/time-trend`, `/category-ratio`, `/completion-rate` — all take `?range=week|month|YYYY-MM-DD:YYYY-MM-DD`

Analytics queries use PostgreSQL `EXTRACT(EPOCH FROM end_at - start_at)` for time math — **will not work with SQLite**, so analytics endpoints are not covered by automated tests.

### Frontend pages

| Route | File | JS |
|-------|------|----|
| `/` | `static/index.html` | `static/js/calendar.js` |
| `/day?date=YYYY-MM-DD` | `static/day.html` | `static/js/day.js` |
| `/dashboard` | `static/dashboard.html` | `static/js/dashboard.js` |

`day.js` is the largest file — handles checklist (task CRUD, status cycling), timetable (144-slot drag-to-paint grid), auto-save fields, and date navigation. The checklist and timetable communicate via custom DOM events (`taskSelected`, `tasksChanged`).

Task status cycle: `null → done(✔) → failed(✖) → carry(▲) → null`. Sending `""` via the API clears status to null.

### Testing notes

- `tests/conftest.py` has two fixtures: `db` (for model tests, rolls back per test) and `client` (for API tests, drops+recreates the SQLite DB each time to avoid state leakage)
- `test_models.py` uses unique names like `"공부_model_test"` to avoid conflicts with seeded category names
- All API test fixtures use `client` from conftest — no per-file client setup needed
