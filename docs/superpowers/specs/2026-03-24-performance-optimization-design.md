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
| `DailyPage` | `date` | Looked up on every page request |
| `Task` | `daily_page_id` | JOIN in overlap checks, analytics |
| `Task` | `category_id` | JOIN in analytics queries |
| `TimeBlock` | `task_id` | JOIN in analytics, overlap checks |

### 1.2 Eliminate Duplicate Queries (`api/daily_pages.py`)

**GET `/api/daily-pages/{date}`:**
- Current: after creating a new DailyPage, re-executes the same SELECT with all joins
- Fix: use `db.refresh(page)` + eagerly load relationships, skip the second query

**PUT `/api/daily-pages/{date}`:**
- Current: `db.refresh(page)` then re-executes same SELECT
- Fix: remove the redundant second query, return refreshed object directly

### 1.3 Overlap Check Optimization (`api/time_blocks.py`)

- Current: `scalar_one_or_none() is not None` fetches full TimeBlock row
- Fix: use `select(exists(...))` to return boolean only

### 1.4 Middleware (`main.py`)

- Add `GZipMiddleware(minimum_size=500)` for response compression
- Add custom middleware or configure static file caching with `Cache-Control: max-age=86400`

### 1.5 Connection Pool (`db/database.py`)

- Add `pool_size=5, max_overflow=10, pool_pre_ping=True` to `create_async_engine()`

---

## 2. Frontend Optimization

### 2.1 DOM Re-rendering (`static/js/day.js` — `renderTasks()`)

- Current: clears `innerHTML` and rebuilds all DOM nodes + re-attaches event listeners on every action
- Fix: use event delegation on the parent container (single click handler), update only changed elements instead of full rebuild

### 2.2 Timetable Drag Performance (`static/js/day.js`)

- Current: mouseover fires 30-60x/sec, each clearing and repainting all slots in range
- Fix: wrap drag handler in `requestAnimationFrame` to coalesce updates to once per frame
- Use CSS classes for slot coloring instead of individual inline `style.background`

### 2.3 Auto-Save Debounce (`static/js/day.js`)

- Current: comment/memo/d_day_label save on every blur with no debounce
- Fix: add 300ms debounce to prevent rapid-fire saves

### 2.4 Category Lookup Optimization (`static/js/day.js`)

- Current: `getCategoryById()` is O(n) linear search through array, called repeatedly
- Fix: build a `Map<id, category>` on page load for O(1) lookup
- Cache categories in `localStorage` since they never change

---

## 3. Dashboard + Static Resources

### 3.1 Chart.js Lazy Loading (`static/dashboard.html`)

- Current: `<script src="chart.js">` loaded synchronously on all pages
- Fix: load Chart.js dynamically only when dashboard page is accessed
- Note: Chart.js is only in dashboard.html, so this is about ensuring it stays that way and adding async/defer

### 3.2 Chart Update Strategy (`static/js/dashboard.js`)

- Current: `chart.destroy()` + `new Chart()` on every range change
- Fix: reuse chart instances — update `chart.data` and call `chart.update()`

---

## Files Changed

| File | Changes |
|------|---------|
| `db/models.py` | Add `index=True` to 4 columns |
| `db/database.py` | Add connection pool parameters |
| `api/daily_pages.py` | Remove duplicate queries in GET and PUT |
| `api/time_blocks.py` | Use `exists()` for overlap check |
| `main.py` | Add GZipMiddleware, static cache headers |
| `static/js/day.js` | Event delegation, RAF drag, debounce, category Map |
| `static/js/dashboard.js` | Reuse chart instances |
| `static/dashboard.html` | Add defer to Chart.js script tag |

## Testing

- All existing 16 tests must continue to pass
- Manual verification of:
  - Checklist add/edit/delete responsiveness
  - Timetable drag smoothness
  - Page transition speed
  - Dashboard chart loading

## Risks

- **Low:** All changes are independent, backwards-compatible, and don't alter data models or API contracts
- Index additions require a DB migration on production (Neon), but are non-breaking
