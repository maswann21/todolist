# Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve perceived and actual response speed across all pages by optimizing backend queries, adding middleware, and reducing frontend DOM churn.

**Architecture:** Independent, low-risk changes across 7 files. Backend fixes reduce query count and response size. Frontend fixes reduce DOM operations and coalesce paint events. No data model or API contract changes.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, vanilla JS, Chart.js

---

### Task 1: Add DB indexes to FK columns

**Files:**
- Modify: `db/models.py:35-36` (Task FK columns), `db/models.py:52` (TimeBlock FK column)

- [ ] **Step 1: Add `index=True` to Task.daily_page_id**

In `db/models.py`, change line 35:
```python
daily_page_id: Mapped[int] = mapped_column(ForeignKey("daily_pages.id"), nullable=False, index=True)
```

- [ ] **Step 2: Add `index=True` to Task.category_id**

In `db/models.py`, change line 36:
```python
category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False, index=True)
```

- [ ] **Step 3: Add `index=True` to TimeBlock.task_id**

In `db/models.py`, change line 52:
```python
task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), nullable=False, index=True)
```

- [ ] **Step 4: Run tests to verify no regressions**

Run: `python -m pytest tests/ -v`
Expected: All 16 tests pass

- [ ] **Step 5: Commit**

```bash
git add db/models.py
git commit -m "perf: add indexes to FK columns for faster joins"
```

---

### Task 2: Add connection pool parameters

**Files:**
- Modify: `db/database.py:14`

- [ ] **Step 1: Add pool_size and max_overflow to engine**

In `db/database.py`, change line 14:
```python
engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_size=3, max_overflow=5)
```

- [ ] **Step 2: Run tests to verify no regressions**

Run: `python -m pytest tests/ -v`
Expected: All 16 tests pass (SQLite ignores pool settings but shouldn't error)

- [ ] **Step 3: Commit**

```bash
git add db/database.py
git commit -m "perf: configure connection pool for Neon free tier limits"
```

---

### Task 3: Eliminate duplicate queries in daily_pages.py

**Files:**
- Modify: `api/daily_pages.py:84-90` (GET handler), `api/daily_pages.py:112-116` (PUT handler)

- [ ] **Step 1: Fix GET — skip second query for newly created pages**

In `api/daily_pages.py`, replace lines 84-90:
```python
    if page is None:
        page = DailyPage(date=d)
        db.add(page)
        await db.commit()
        # Reload with relationships
        result = await db.execute(stmt)
        page = result.scalar_one_or_none()
```

With:
```python
    if page is None:
        page = DailyPage(date=d)
        db.add(page)
        await db.commit()
        await db.refresh(page)
        # New page has no tasks — set empty list to avoid lazy load
        page.tasks = []
```

- [ ] **Step 2: Fix PUT — remove redundant db.refresh before the SELECT**

In `api/daily_pages.py`, replace lines 112-117:
```python
    await db.commit()
    await db.refresh(page)
    # Reload with relationships after refresh
    result = await db.execute(stmt)
    page = result.scalar_one_or_none()
    return page
```

With:
```python
    await db.commit()
    # Reload with relationships (single query, no redundant refresh)
    result = await db.execute(stmt)
    page = result.scalar_one_or_none()
    return page
```

- [ ] **Step 3: Run tests to verify no regressions**

Run: `python -m pytest tests/ -v`
Expected: All 16 tests pass

- [ ] **Step 4: Commit**

```bash
git add api/daily_pages.py
git commit -m "perf: remove duplicate queries in daily page GET and PUT"
```

---

### Task 4: Optimize overlap check to use EXISTS

**Files:**
- Modify: `api/time_blocks.py:1-6` (imports), `api/time_blocks.py:44-62` (_check_overlap function)

- [ ] **Step 1: Add `exists` import**

In `api/time_blocks.py`, change line 5:
```python
from sqlalchemy import select, exists
```

- [ ] **Step 2: Rewrite _check_overlap to use EXISTS**

Replace the `_check_overlap` function (lines 44-62):
```python
async def _check_overlap(
    db: AsyncSession,
    daily_page_id: int,
    start: time,
    end: time,
    exclude_id: Optional[int] = None,
) -> bool:
    """Return True if there is an overlapping time block for the given day."""
    overlap_condition = (
        select(TimeBlock.id)
        .join(Task)
        .where(Task.daily_page_id == daily_page_id)
        .where(TimeBlock.start_at < end)
        .where(TimeBlock.end_at > start)
    )
    if exclude_id is not None:
        overlap_condition = overlap_condition.where(TimeBlock.id != exclude_id)
    stmt = select(overlap_condition.exists())
    result = await db.execute(stmt)
    return result.scalar()
```

- [ ] **Step 3: Run tests to verify no regressions**

Run: `python -m pytest tests/ -v`
Expected: All 16 tests pass (overlap tests should still work correctly)

- [ ] **Step 4: Commit**

```bash
git add api/time_blocks.py
git commit -m "perf: use EXISTS for overlap check instead of fetching full row"
```

---

### Task 5: Add GZip and cache-control middleware

**Files:**
- Modify: `main.py:1-3` (imports), `main.py:23` (after app creation)

- [ ] **Step 1: Add GZipMiddleware**

Add import at top of `main.py`:
```python
from starlette.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
```

Add after `app = FastAPI(...)` line (line 23):
```python
app.add_middleware(GZipMiddleware, minimum_size=500)
```

- [ ] **Step 2: Add CacheControlMiddleware for static files**

Add the middleware class before `app = FastAPI(...)`:
```python
class CacheControlMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/static/"):
            response.headers["Cache-Control"] = "public, max-age=86400"
        return response
```

Add after the GZip middleware:
```python
app.add_middleware(CacheControlMiddleware)
```

- [ ] **Step 3: Run tests to verify no regressions**

Run: `python -m pytest tests/ -v`
Expected: All 16 tests pass

- [ ] **Step 4: Commit**

```bash
git add main.py
git commit -m "perf: add GZip compression and static file cache headers"
```

---

### Task 6: Frontend — category Map for O(1) lookup

**Files:**
- Modify: `static/js/day.js:4` (state), `static/js/day.js:69-71` (getCategoryById), `static/js/day.js:211-214` (init data load)

- [ ] **Step 1: Add categoryMap to state**

In `static/js/day.js`, after line 4 (`let categories = [];`), add:
```javascript
let categoryMap = new Map();
```

- [ ] **Step 2: Build Map after loading categories**

In `static/js/day.js`, after the `Promise.all` block (after line 214), add:
```javascript
  categoryMap = new Map(categories.map(c => [c.id, c]));
```

- [ ] **Step 3: Update getCategoryById to use Map**

Replace `getCategoryById` (lines 69-71):
```javascript
function getCategoryById(id) {
  return categoryMap.get(id) || { color: '#94a3b8', name: '?' };
}
```

- [ ] **Step 4: Add localStorage caching for categories**

In `static/js/day.js`, replace the category loading in init (inside the `Promise.all` block). Change the init data loading section:
```javascript
  // Load data
  try {
    const cachedCats = localStorage.getItem('categories');
    const [pageDataResult, categoriesResult] = await Promise.all([
      api('GET', `/api/daily-pages/${currentDate}`),
      cachedCats ? Promise.resolve(JSON.parse(cachedCats)) : api('GET', '/api/categories'),
    ]);
    pageData = pageDataResult;
    categories = categoriesResult;
    if (!cachedCats) localStorage.setItem('categories', JSON.stringify(categories));
  } catch (err) {
    alert('데이터 로드 실패: ' + err.message);
    return;
  }
```

- [ ] **Step 5: Test manually**

Open day page in browser, verify:
- Tasks render with correct category colors
- Categories appear in dropdown
- Check DevTools Network tab: second page load should not fetch `/api/categories`

- [ ] **Step 6: Commit**

```bash
git add static/js/day.js
git commit -m "perf: use Map for O(1) category lookup + localStorage cache"
```

---

### Task 7: Frontend — event delegation for task list

**Files:**
- Modify: `static/js/day.js:74-136` (renderTasks), `static/js/day.js:226-228` (init call)

- [ ] **Step 1: Add event delegation setup in init**

In `static/js/day.js`, add after `setupAutoSave()` call in init (after line 228):
```javascript
  // Event delegation for task list
  document.getElementById('taskList').addEventListener('click', handleTaskListClick);
```

- [ ] **Step 2: Create handleTaskListClick function**

Add before `renderTasks()`:
```javascript
async function handleTaskListClick(e) {
  const taskItem = e.target.closest('.task-item');
  if (!taskItem) return;
  const taskId = parseInt(taskItem.dataset.taskId);
  const task = pageData.tasks.find(t => t.id === taskId);
  if (!task) return;

  // Delete button
  if (e.target.classList.contains('task-delete')) {
    e.stopPropagation();
    if (!confirm(`"${task.title}" 삭제할까요?`)) return;
    try {
      await api('DELETE', `/api/tasks/${task.id}`);
      pageData.tasks = pageData.tasks.filter(t => t.id !== task.id);
      if (selectedTaskId === task.id) selectedTaskId = null;
      taskItem.remove();
      updateTotalTime();
      document.dispatchEvent(new CustomEvent('tasksChanged', { detail: { tasks: pageData.tasks } }));
    } catch (err) {
      alert('삭제 실패: ' + err.message);
    }
    return;
  }

  // Status badge
  if (e.target.classList.contains('task-status') || e.target.classList.contains('task-status-badge')) {
    e.stopPropagation();
    const currentIdx = STATUS_CYCLE.indexOf(task.status);
    const nextStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length];
    try {
      const updated = await api('PUT', `/api/tasks/${task.id}`, { status: nextStatus || '' });
      task.status = updated.status;
      // Update only this task's DOM
      const statusEl = taskItem.querySelector('.task-status');
      statusEl.textContent = STATUS_ICONS[task.status] || '—';
      statusEl.className = `task-status task-status-badge status-badge-${task.status || 'none'}`;
      const statusClass = task.status ? `status-${task.status}` : '';
      taskItem.className = 'task-item' + (task.id === selectedTaskId ? ' selected' : '') + (statusClass ? ` ${statusClass}` : '');
    } catch (err) {
      alert('상태 변경 실패: ' + err.message);
    }
    return;
  }

  // Task selection (click on task item body)
  selectedTaskId = task.id === selectedTaskId ? null : task.id;
  // Update selected state for all items
  document.querySelectorAll('.task-item').forEach(item => {
    const id = parseInt(item.dataset.taskId);
    item.classList.toggle('selected', id === selectedTaskId);
  });
  document.dispatchEvent(new CustomEvent('taskSelected', { detail: { taskId: selectedTaskId } }));
}
```

- [ ] **Step 3: Simplify renderTasks to only build DOM (no event listeners)**

Replace `renderTasks()` (lines 74-136):
```javascript
function renderTasks() {
  const container = document.getElementById('taskList');
  container.innerHTML = '';

  const tasks = pageData?.tasks || [];
  tasks.sort((a, b) => a.priority - b.priority);

  for (const task of tasks) {
    const cat = getCategoryById(task.category_id);
    const item = document.createElement('div');
    const statusClass = task.status ? ` status-${task.status}` : '';
    item.className = 'task-item' + (task.id === selectedTaskId ? ' selected' : '') + statusClass;
    item.dataset.taskId = task.id;

    item.innerHTML = `
      <div class="task-color-dot" style="background:${cat.color}"></div>
      <span class="task-title">${escapeHtml(task.title)}</span>
      <span class="task-status task-status-badge status-badge-${task.status || 'none'}" title="클릭하여 상태 변경">${STATUS_ICONS[task.status] || '—'}</span>
      <span class="task-delete" title="삭제">✕</span>
    `;

    container.appendChild(item);
  }
}
```

- [ ] **Step 4: Update addTask to append DOM node instead of full re-render**

Replace `renderTasks()` call in `addTask()` (around line 157):
```javascript
    newTask.time_blocks = [];
    pageData.tasks.push(newTask);
    titleInput.value = '';
    // Append single DOM node instead of full re-render
    const cat = getCategoryById(newTask.category_id);
    const item = document.createElement('div');
    item.className = 'task-item';
    item.dataset.taskId = newTask.id;
    item.innerHTML = `
      <div class="task-color-dot" style="background:${cat.color}"></div>
      <span class="task-title">${escapeHtml(newTask.title)}</span>
      <span class="task-status task-status-badge status-badge-none" title="클릭하여 상태 변경">—</span>
      <span class="task-delete" title="삭제">✕</span>
    `;
    document.getElementById('taskList').appendChild(item);
    document.dispatchEvent(new CustomEvent('tasksChanged', { detail: { tasks: pageData.tasks } }));
```

- [ ] **Step 5: Test manually**

Open day page in browser, verify:
- Click task to select → highlights correctly, timetable responds
- Click status badge → cycles through null/done/failed/carry, only badge updates
- Click delete → removes single task from list
- Add task → appends to bottom of list

- [ ] **Step 6: Run backend tests to ensure no breakage**

Run: `python -m pytest tests/ -v`
Expected: All 16 tests pass

- [ ] **Step 7: Commit**

```bash
git add static/js/day.js
git commit -m "perf: event delegation for task list — eliminate per-task listeners"
```

---

### Task 8: Frontend — requestAnimationFrame for timetable drag

**Files:**
- Modify: `static/js/day.js:377-384` (onSlotMouseover function)

- [ ] **Step 1: Add RAF state variable**

Add after `let activeTimetableTaskId = null;` (line 249):
```javascript
let dragRAFId = null;
```

- [ ] **Step 2: Wrap onSlotMouseover in requestAnimationFrame**

Replace `onSlotMouseover` function (lines 377-384):
```javascript
function onSlotMouseover(e) {
  if (!isDragging) return;
  const slot = parseInt(e.currentTarget.dataset.slot);
  if (dragRAFId) cancelAnimationFrame(dragRAFId);
  dragRAFId = requestAnimationFrame(() => {
    clearDragPaint(dragStartSlot, dragEndSlot);
    dragEndSlot = slot;
    const cat = getCategoryById(pageData.tasks.find(t => t.id === activeTimetableTaskId)?.category_id);
    paintRange(dragStartSlot, dragEndSlot, cat.color + '88');
    dragRAFId = null;
  });
}
```

- [ ] **Step 3: Clean up RAF on mouseup**

In `onDocumentMouseup` (around line 420), add cleanup:
```javascript
function onDocumentMouseup() {
  if (isDragging) {
    isDragging = false;
    if (dragRAFId) { cancelAnimationFrame(dragRAFId); dragRAFId = null; }
    if (dragStartSlot !== null && dragEndSlot !== null) {
      clearDragPaint(dragStartSlot, dragEndSlot);
    }
  }
}
```

- [ ] **Step 4: Test manually**

Open day page, select a task, drag across timetable slots:
- Should feel smoother with no frame drops
- Drag preview color should still appear correctly
- Releasing should still create time block

- [ ] **Step 5: Commit**

```bash
git add static/js/day.js
git commit -m "perf: requestAnimationFrame for timetable drag — reduce repaints"
```

---

### Task 9: Dashboard — reuse Chart.js instances

**Files:**
- Modify: `static/js/dashboard.js:14-56` (renderCategoryChart), `static/js/dashboard.js:58-98` (renderCompletionChart), `static/js/dashboard.js:100-153` (renderTrendChart)

- [ ] **Step 1: Update renderCategoryChart to reuse instance**

Replace `renderCategoryChart` function:
```javascript
function renderCategoryChart(ratioData) {
  const ctx = document.getElementById('categoryChart').getContext('2d');

  if (!ratioData.length) {
    if (categoryChart) { categoryChart.destroy(); categoryChart = null; }
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.font = '14px sans-serif';
    ctx.fillText('데이터 없음', ctx.canvas.width / 2, 100);
    return;
  }

  const data = {
    labels: ratioData.map(d => d.category_name),
    datasets: [{
      data: ratioData.map(d => d.total_minutes),
      backgroundColor: ratioData.map(d => d.category_color),
      borderWidth: 2,
      borderColor: '#fff',
    }],
  };

  if (categoryChart) {
    categoryChart.data = data;
    categoryChart.update();
  } else {
    categoryChart = new Chart(ctx, {
      type: 'doughnut',
      data,
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'right' },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const mins = ctx.parsed;
                const h = Math.floor(mins / 60);
                const m = mins % 60;
                return ` ${ctx.label}: ${h}h ${m}m`;
              }
            }
          }
        }
      }
    });
  }
}
```

- [ ] **Step 2: Update renderCompletionChart to reuse instance**

Replace `renderCompletionChart` function:
```javascript
function renderCompletionChart(completionData) {
  const ctx = document.getElementById('completionChart').getContext('2d');

  const STATUS_LABELS = { done: '✔ 완료', failed: '✖ 미완료', carry: '▲ 이월', pending: '— 미정' };
  const STATUS_COLORS = { done: '#22c55e', failed: '#ef4444', carry: '#f97316', pending: '#94a3b8' };

  if (!completionData.length) {
    if (completionChart) { completionChart.destroy(); completionChart = null; }
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.font = '14px sans-serif';
    ctx.fillText('데이터 없음', ctx.canvas.width / 2, 100);
    return;
  }

  const data = {
    labels: completionData.map(d => STATUS_LABELS[d.status] || d.status),
    datasets: [{
      data: completionData.map(d => d.count),
      backgroundColor: completionData.map(d => STATUS_COLORS[d.status] || '#94a3b8'),
      borderWidth: 2,
      borderColor: '#fff',
    }],
  };

  if (completionChart) {
    completionChart.data = data;
    completionChart.update();
  } else {
    completionChart = new Chart(ctx, {
      type: 'doughnut',
      data,
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'right' },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.parsed}개 (${completionData[ctx.dataIndex]?.percentage}%)`
            }
          }
        }
      }
    });
  }
}
```

- [ ] **Step 3: Update renderTrendChart to reuse instance**

Replace `renderTrendChart` function:
```javascript
function renderTrendChart(trendData) {
  const ctx = document.getElementById('trendChart').getContext('2d');

  if (!trendData.length) {
    if (trendChart) { trendChart.destroy(); trendChart = null; }
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.font = '14px sans-serif';
    ctx.fillText('데이터 없음', ctx.canvas.width / 2, 60);
    return;
  }

  const dates = [...new Set(trendData.map(d => d.date))].sort();
  const categoryNames = [...new Set(trendData.map(d => d.category_name))];
  const colorMap = {};
  for (const d of trendData) colorMap[d.category_name] = d.category_color;

  const datasets = categoryNames.map(name => {
    const dataMap = {};
    for (const d of trendData) {
      if (d.category_name === name) dataMap[d.date] = d.total_minutes;
    }
    return {
      label: name,
      data: dates.map(date => dataMap[date] || 0),
      backgroundColor: colorMap[name],
      stack: 'stack',
    };
  });

  const data = { labels: dates, datasets };

  if (trendChart) {
    trendChart.data = data;
    trendChart.update();
  } else {
    trendChart = new Chart(ctx, {
      type: 'bar',
      data,
      options: {
        responsive: true,
        scales: {
          x: { stacked: true },
          y: {
            stacked: true,
            title: { display: true, text: '분 (minutes)' },
          },
        },
        plugins: {
          legend: { position: 'top' },
        }
      }
    });
  }
}
```

- [ ] **Step 4: Test manually**

Open dashboard, change range selector between week/month:
- Charts should update without flicker
- Data should still be correct
- Empty data should show "데이터 없음"

- [ ] **Step 5: Commit**

```bash
git add static/js/dashboard.js
git commit -m "perf: reuse Chart.js instances instead of destroy+recreate"
```

---

### Task 10: Final verification

- [ ] **Step 1: Run all tests**

Run: `python -m pytest tests/ -v`
Expected: All 16 tests pass

- [ ] **Step 2: Manual smoke test**

Open all three pages and verify:
1. Calendar (`/`) — loads, month navigation works
2. Day page (`/day?date=2026-03-24`) — add task, cycle status, drag timetable, delete time block
3. Dashboard (`/dashboard`) — charts render, range switch works

- [ ] **Step 3: Check DevTools**

- Network tab: verify GZip `Content-Encoding: gzip` on API responses
- Network tab: verify `Cache-Control: public, max-age=86400` on `/static/` resources
- Console: no errors
