# Performance Optimization Design

**Date:** 2026-03-24
**Status:** Approved
**Goal:** Improve perceived and actual response speed across all pages (calendar, day, dashboard)

---

## Problem

The app feels slow across the board — page transitions, checklist interactions, timetable drag, and dashboard loading all have noticeable lag. Root causes span backend, frontend, and static file serving.

## Approach: Full-Stack Optimization (Approach C)

All changes are independent of each other, low-risk, and individually simple.

---

## 1. Backend + DB Optimization

### 1.1 DB Indexes (`db/models.py`)

Add indexes on frequently queried columns:

| Model | Column | Reason |
|-------|--------|--------|
| `Task` | `daily_page_id` | JOIN in overlap checks, analytics |
| `Task` | `category_id` | JOIN in analytics queries |
| `TimeBlock` | `task_id` | JOIN in analytics, overlap checks |

Note: `DailyPage.date` already has an implicit index via its `unique=True` constraint.

### 1.2 Eliminate Duplicate Queries (`api/daily_pages.py`)

**GET `/api/daily-pages/{date}`:**
- Current: after creating a new DailyPage, re-executes the full SELECT with selectinload joins
- Fix: for a newly created page (no tasks), skip the second query — return the in-memory object directly with `tasks=[]`. The second SELECT is only needed for existing pages (already handled by the first query).

**PUT `/api/daily-pages/{date}`:**
- Current: `db.refresh(page)` then re-executes the same SELECT with selectinload
- Fix: remove `db.refresh()`, keep only the second SELECT (which loads relationships properly). The refresh is redundant since the subsequent query fetches fresh data with all relationships.

### 1.3 Overlap Check Optimization (`api/time_blocks.py`)

- Current: `scalar_one_or_none() is not None` fetches full TimeBlock row
- Fix: use `select(exists(...))` to return boolean only

### 1.4 Middleware (`main.py`)

- Add `GZipMiddleware(minimum_size=500)` for response compression
- Add a custom `CacheControlMiddleware` that sets `Cache-Control: public, max-age=86400` for requests with paths starting with `/static/` (FastAPI's `StaticFiles` does not natively support custom cache headers)

### 1.5 Connection Pool (`db/database.py`)

- Add `pool_size=3, max_overflow=5` to `create_async_engine()`
- Conservative values to stay within Neon free tier's ~20 connection limit
- Skip `pool_pre_ping=True` — adds a round-trip per checkout, counterproductive for remote Neon (Singapore) latency

---

## 2. Frontend Optimization

### 2.1 DOM Re-rendering (`static/js/day.js` — `renderTasks()`)

- Current: clears `innerHTML` and rebuilds all DOM nodes + re-attaches event listeners on every action
- Fix:
  - Use event delegation: attach a single click handler on the task list container, match targets by `data-task-id` and action class (`.status-btn`, `.delete-btn`, `.task-item`)
  - On task add/delete: only append/remove the specific DOM node
  - On status change: update only the status icon text of the affected task element
  - Full re-render only on initial page load

### 2.2 Timetable Drag Performance (`static/js/day.js`)

- Current: mouseover fires 30-60x/sec, each clearing and repainting all slots in range
- Fix: wrap drag handler in `requestAnimationFrame` to coalesce updates to once per frame
- Use CSS classes for slot coloring instead of individual inline `style.background`

### 2.3 Category Lookup Optimization (`static/js/day.js`)

- Current: `getCategoryById()` is O(n) linear search through array, called repeatedly
- Fix: build a `Map<id, category>` on page load for O(1) lookup
- Cache categories in `localStorage` since they never change

---

## 3. Dashboard

### 3.1 Chart Update Strategy (`static/js/dashboard.js`)

- Current: `chart.destroy()` + `new Chart()` on every range change
- Fix: reuse chart instances — update `chart.data` and call `chart.update()`

---

## Files Changed

| File | Changes |
|------|---------|
| `db/models.py` | Add `index=True` to 3 FK columns |
| `db/database.py` | Add connection pool parameters |
| `api/daily_pages.py` | Remove duplicate queries in GET and PUT |
| `api/time_blocks.py` | Use `exists()` for overlap check |
| `main.py` | Add GZipMiddleware, CacheControlMiddleware |
| `static/js/day.js` | Event delegation, RAF drag, category Map |
| `static/js/dashboard.js` | Reuse chart instances |

## Testing

- All existing 16 tests must continue to pass
- Manual verification of:
  - Checklist add/edit/delete responsiveness
  - Timetable drag smoothness
  - Page transition speed
  - Dashboard chart loading

## Risks

- **Low:** All changes are independent, backwards-compatible, and don't alter data models or API contracts
- Index additions: project uses `Base.metadata.create_all()` which only creates missing tables/indexes — new indexes on existing columns will be created automatically on next startup. For production Neon, run `CREATE INDEX IF NOT EXISTS` manually if needed.
