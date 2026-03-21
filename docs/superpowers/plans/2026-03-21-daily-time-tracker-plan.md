# Daily Time Tracker + Todolist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web app that replicates the Excel "Daily Time Tracker" format — calendar view, daily checklist + timetable, and analytics dashboard.

**Architecture:** FastAPI serves a REST API and static HTML/CSS/JS files. SQLAlchemy (async) connects to Neon PostgreSQL. Frontend uses vanilla JS with Chart.js for analytics.

**Tech Stack:** Python 3.10+, FastAPI, SQLAlchemy 2.0 (async), asyncpg, Neon PostgreSQL, vanilla HTML/CSS/JS, Chart.js

**Spec:** `docs/superpowers/specs/2026-03-21-daily-time-tracker-design.md`

---

## File Map

| File | Responsibility |
|------|---------------|
| `main.py` | FastAPI app entry, mount routers + static files |
| `requirements.txt` | Python dependencies |
| `.env` | `DATABASE_URL` for Neon PostgreSQL |
| `.gitignore` | Ignore `.env`, `__pycache__`, `.venv` |
| `db/database.py` | Async SQLAlchemy engine + session factory |
| `db/models.py` | SQLAlchemy ORM models (Category, DailyPage, Task, TimeBlock) |
| `db/seed.py` | Insert 6 default categories |
| `api/daily_pages.py` | CRUD for daily pages (get-or-create by date, update comment/memo/d_day) |
| `api/tasks.py` | CRUD for tasks (create, update status/priority/title, delete) |
| `api/time_blocks.py` | CRUD for time blocks (create with overlap check, update, delete) |
| `api/analytics.py` | Aggregation queries (time trend, category ratio, completion rate) |
| `static/index.html` | Calendar page shell |
| `static/day.html` | Daily detail page shell |
| `static/dashboard.html` | Dashboard page shell |
| `static/css/style.css` | All styles |
| `static/js/calendar.js` | Calendar rendering + navigation |
| `static/js/day.js` | Checklist + timetable interaction |
| `static/js/dashboard.js` | Chart.js charts |
| `tests/test_models.py` | DB model tests |
| `tests/test_api_daily_pages.py` | Daily pages API tests |
| `tests/test_api_tasks.py` | Tasks API tests |
| `tests/test_api_time_blocks.py` | Time blocks API tests |
| `tests/conftest.py` | Shared fixtures (test DB, async client) |

---

## Task 1: Project Reset & Setup

**Files:**
- Delete: `src/`, `data/`, `WBS.md`, old `main.py`, old `requirements.txt`
- Create: `requirements.txt`, `.env`, `.gitignore`, `main.py` (placeholder)

- [ ] **Step 1: Remove old code**

```bash
rm -rf src/ data/ WBS.md main.py requirements.txt
```

- [ ] **Step 2: Create `.gitignore`**

```gitignore
.env
__pycache__/
*.pyc
.venv/
.pytest_cache/
```

- [ ] **Step 3: Create `requirements.txt`**

```
fastapi==0.115.0
uvicorn[standard]==0.32.0
sqlalchemy[asyncio]==2.0.36
asyncpg==0.30.0
pydantic==2.10.0
pydantic-settings==2.6.0
python-dotenv==1.0.1
httpx==0.28.0
pytest==8.3.0
pytest-asyncio==0.24.0
aiosqlite==0.20.0
```

- [ ] **Step 4: Create `.env` (template — user fills in real URL)**

```
DATABASE_URL=postgresql+asyncpg://user:pass@host/dbname
```

- [ ] **Step 5: Create placeholder `main.py`**

```python
from fastapi import FastAPI

app = FastAPI(title="Daily Time Tracker")

@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 6: Install dependencies and verify**

```bash
pip install -r requirements.txt
uvicorn main:app --reload
# Visit http://127.0.0.1:8000/health -> {"status": "ok"}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: reset project and scaffold FastAPI app"
```

---

## Task 2: Database Connection & ORM Models

**Files:**
- Create: `db/__init__.py`, `db/database.py`, `db/models.py`
- Create: `tests/conftest.py`, `tests/test_models.py`

- [ ] **Step 1: Create `db/__init__.py`** (empty file)

- [ ] **Step 2: Create `db/database.py`**

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str

    class Config:
        env_file = ".env"


settings = Settings()
engine = create_async_engine(settings.DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        yield session
```

- [ ] **Step 3: Create `db/models.py`**

```python
from datetime import datetime, date, time
from sqlalchemy import String, Integer, Text, Date, Time, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.database import Base


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    color: Mapped[str] = mapped_column(String(7), nullable=False)

    tasks: Mapped[list["Task"]] = relationship(back_populates="category")


class DailyPage(Base):
    __tablename__ = "daily_pages"

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[date] = mapped_column(Date, unique=True, nullable=False)
    d_day_label: Mapped[str | None] = mapped_column(String(20), nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    tasks: Mapped[list["Task"]] = relationship(back_populates="daily_page", cascade="all, delete-orphan")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    daily_page_id: Mapped[int] = mapped_column(ForeignKey("daily_pages.id"), nullable=False)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str | None] = mapped_column(String(10), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    daily_page: Mapped["DailyPage"] = relationship(back_populates="tasks")
    category: Mapped["Category"] = relationship(back_populates="tasks")
    time_blocks: Mapped[list["TimeBlock"]] = relationship(back_populates="task", cascade="all, delete-orphan")


class TimeBlock(Base):
    __tablename__ = "time_blocks"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), nullable=False)
    start_at: Mapped[time] = mapped_column(Time, nullable=False)
    end_at: Mapped[time] = mapped_column(Time, nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    task: Mapped["Task"] = relationship(back_populates="time_blocks")
```

- [ ] **Step 4: Write test for model creation**

Create `tests/__init__.py` (empty) and `tests/conftest.py`:

```python
import asyncio
import pytest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from db.database import Base

TEST_DB_URL = "sqlite+aiosqlite:///test.db"

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def test_engine():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest.fixture
async def db(test_engine):
    session_factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()

@pytest.fixture
async def client(test_engine):
    from db.database import get_db, Base
    from db.seed import seed_categories
    from main import app

    session_factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    # Seed categories for tests
    async with session_factory() as session:
        await seed_categories(session)

    from httpx import AsyncClient, ASGITransport
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()
```

Add `aiosqlite==0.20.0` to `requirements.txt` (for tests only).

Create `tests/test_models.py`:

```python
import pytest
from datetime import date, time
from db.models import Category, DailyPage, Task, TimeBlock

pytestmark = pytest.mark.asyncio

async def test_create_category(db):
    cat = Category(name="공부", color="#22C55E")
    db.add(cat)
    await db.commit()
    assert cat.id is not None
    assert cat.name == "공부"

async def test_create_daily_page(db):
    page = DailyPage(date=date(2026, 3, 21))
    db.add(page)
    await db.commit()
    assert page.id is not None

async def test_create_task_with_time_block(db):
    cat = Category(name="업무", color="#3B82F6")
    db.add(cat)
    await db.flush()

    page = DailyPage(date=date(2026, 3, 22))
    db.add(page)
    await db.flush()

    task = Task(daily_page_id=page.id, category_id=cat.id, title="회의", priority=1)
    db.add(task)
    await db.flush()

    block = TimeBlock(task_id=task.id, start_at=time(9, 0), end_at=time(10, 30))
    db.add(block)
    await db.commit()

    assert block.id is not None
    assert block.start_at == time(9, 0)
    assert block.end_at == time(10, 30)
```

- [ ] **Step 5: Run tests**

```bash
pip install aiosqlite
pytest tests/test_models.py -v
```

Expected: 3 tests PASS.

- [ ] **Step 6: Add table creation to `main.py`**

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from db.database import engine, Base

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(title="Daily Time Tracker", lifespan=lifespan)

@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add database connection and ORM models"
```

---

## Task 3: Category Seed & Categories API

**Files:**
- Create: `db/seed.py`, `api/__init__.py`, `api/categories.py`

- [ ] **Step 1: Create `db/seed.py`**

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from db.models import Category

DEFAULTS = [
    ("업무", "#3B82F6"),
    ("공부", "#22C55E"),
    ("운동", "#F97316"),
    ("수면", "#6366F1"),
    ("생활", "#9CA3AF"),
    ("여가", "#EAB308"),
]

async def seed_categories(session: AsyncSession):
    result = await session.execute(select(Category))
    if result.scalars().first() is not None:
        return
    for name, color in DEFAULTS:
        session.add(Category(name=name, color=color))
    await session.commit()
```

- [ ] **Step 2: Call seed in `main.py` lifespan**

```python
from db.database import engine, Base, async_session
from db.seed import seed_categories

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_session() as session:
        await seed_categories(session)
    yield
```

- [ ] **Step 3: Create `api/__init__.py`** (empty)

- [ ] **Step 4: Create `api/categories.py`**

```python
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import get_db
from db.models import Category
from pydantic import BaseModel

router = APIRouter(prefix="/api/categories", tags=["categories"])

class CategoryOut(BaseModel):
    id: int
    name: str
    color: str
    model_config = {"from_attributes": True}

@router.get("", response_model=list[CategoryOut])
async def list_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Category).order_by(Category.id))
    return result.scalars().all()
```

- [ ] **Step 5: Mount router in `main.py`**

```python
from api.categories import router as categories_router
app.include_router(categories_router)
```

- [ ] **Step 6: Test manually**

```bash
uvicorn main:app --reload
# GET http://127.0.0.1:8000/api/categories -> 6 categories
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add category seed data and categories API"
```

---

## Task 4: Daily Pages API

**Files:**
- Create: `api/daily_pages.py`
- Create: `tests/test_api_daily_pages.py`

- [ ] **Step 1: Write test**

Create `tests/test_api_daily_pages.py` (uses shared `client` fixture from `conftest.py`):

```python
import pytest

pytestmark = pytest.mark.asyncio

async def test_get_or_create_daily_page(client):
    resp = await client.get("/api/daily-pages/2026-03-21")
    assert resp.status_code == 200
    data = resp.json()
    assert data["date"] == "2026-03-21"
    assert data["tasks"] == []

async def test_update_daily_page(client):
    await client.get("/api/daily-pages/2026-03-22")
    resp = await client.put("/api/daily-pages/2026-03-22", json={
        "comment": "test comment",
        "memo": "test memo",
        "d_day_label": "D-30"
    })
    assert resp.status_code == 200
    assert resp.json()["comment"] == "test comment"

async def test_monthly_summary(client):
    resp = await client.get("/api/daily-pages?month=2026-03")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_api_daily_pages.py -v
```

Expected: FAIL (routes don't exist yet).

- [ ] **Step 3: Implement `api/daily_pages.py`**

```python
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, extract
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from db.database import get_db
from db.models import DailyPage, Task, TimeBlock
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/daily-pages", tags=["daily_pages"])


class TimeBlockOut(BaseModel):
    id: int
    task_id: int
    start_at: str
    end_at: str
    model_config = {"from_attributes": True}


class TaskOut(BaseModel):
    id: int
    category_id: int
    title: str
    priority: int
    status: Optional[str]
    time_blocks: list[TimeBlockOut]
    model_config = {"from_attributes": True}


class DailyPageOut(BaseModel):
    id: int
    date: date
    d_day_label: Optional[str]
    comment: Optional[str]
    memo: Optional[str]
    tasks: list[TaskOut]
    model_config = {"from_attributes": True}


class DailyPageUpdate(BaseModel):
    comment: Optional[str] = None
    memo: Optional[str] = None
    d_day_label: Optional[str] = None


class DailyPageSummary(BaseModel):
    date: date
    task_count: int
    done_count: int
    model_config = {"from_attributes": True}


@router.get("/{date_str}", response_model=DailyPageOut)
async def get_or_create(date_str: str, db: AsyncSession = Depends(get_db)):
    d = date.fromisoformat(date_str)
    stmt = (
        select(DailyPage)
        .where(DailyPage.date == d)
        .options(selectinload(DailyPage.tasks).selectinload(Task.time_blocks))
    )
    result = await db.execute(stmt)
    page = result.scalar_one_or_none()
    if page is None:
        page = DailyPage(date=d)
        db.add(page)
        await db.commit()
        await db.refresh(page, ["tasks"])
    return page


@router.put("/{date_str}", response_model=DailyPageOut)
async def update_page(date_str: str, body: DailyPageUpdate, db: AsyncSession = Depends(get_db)):
    d = date.fromisoformat(date_str)
    stmt = (
        select(DailyPage)
        .where(DailyPage.date == d)
        .options(selectinload(DailyPage.tasks).selectinload(Task.time_blocks))
    )
    result = await db.execute(stmt)
    page = result.scalar_one_or_none()
    if page is None:
        raise HTTPException(404, "Daily page not found")
    if body.comment is not None:
        page.comment = body.comment
    if body.memo is not None:
        page.memo = body.memo
    if body.d_day_label is not None:
        page.d_day_label = body.d_day_label
    await db.commit()
    await db.refresh(page, ["tasks"])
    return page


@router.get("", response_model=list[DailyPageSummary])
async def monthly_summary(month: str, db: AsyncSession = Depends(get_db)):
    year, mon = map(int, month.split("-"))
    stmt = (
        select(DailyPage)
        .where(extract("year", DailyPage.date) == year)
        .where(extract("month", DailyPage.date) == mon)
        .options(selectinload(DailyPage.tasks))
    )
    result = await db.execute(stmt)
    pages = result.scalars().all()
    summaries = []
    for p in pages:
        task_count = len(p.tasks)
        done_count = sum(1 for t in p.tasks if t.status == "done")
        summaries.append(DailyPageSummary(date=p.date, task_count=task_count, done_count=done_count))
    return summaries
```

- [ ] **Step 4: Mount router in `main.py`**

```python
from api.daily_pages import router as daily_pages_router
app.include_router(daily_pages_router)
```

- [ ] **Step 5: Run tests**

```bash
pytest tests/test_api_daily_pages.py -v
```

Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add daily pages API with get-or-create and monthly summary"
```

---

## Task 5: Tasks API

**Files:**
- Create: `api/tasks.py`
- Create: `tests/test_api_tasks.py`

- [ ] **Step 1: Write test**

Create `tests/test_api_tasks.py` (uses shared `client` fixture from `conftest.py`):

```python
import pytest

pytestmark = pytest.mark.asyncio

async def test_create_task(client):
    await client.get("/api/daily-pages/2026-04-01")
    cats = (await client.get("/api/categories")).json()
    cat_id = cats[0]["id"]

    resp = await client.post("/api/daily-pages/2026-04-01/tasks", json={
        "title": "알고리즘 공부",
        "category_id": cat_id,
        "priority": 1
    })
    assert resp.status_code == 200
    assert resp.json()["title"] == "알고리즘 공부"

async def test_update_task_status(client):
    await client.get("/api/daily-pages/2026-04-02")
    cats = (await client.get("/api/categories")).json()
    task = (await client.post("/api/daily-pages/2026-04-02/tasks", json={
        "title": "운동", "category_id": cats[0]["id"], "priority": 1
    })).json()

    resp = await client.put(f"/api/tasks/{task['id']}", json={"status": "done"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "done"

async def test_delete_task(client):
    await client.get("/api/daily-pages/2026-04-03")
    cats = (await client.get("/api/categories")).json()
    task = (await client.post("/api/daily-pages/2026-04-03/tasks", json={
        "title": "삭제 대상", "category_id": cats[0]["id"], "priority": 1
    })).json()

    resp = await client.delete(f"/api/tasks/{task['id']}")
    assert resp.status_code == 200
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_api_tasks.py -v
```

- [ ] **Step 3: Implement `api/tasks.py`**

```python
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from db.database import get_db
from db.models import DailyPage, Task
from pydantic import BaseModel
from typing import Optional

router = APIRouter(tags=["tasks"])


class TaskCreate(BaseModel):
    title: str
    category_id: int
    priority: int = 0


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    category_id: Optional[int] = None
    priority: Optional[int] = None
    status: Optional[str] = None


class TaskOut(BaseModel):
    id: int
    daily_page_id: int
    category_id: int
    title: str
    priority: int
    status: Optional[str]
    model_config = {"from_attributes": True}


@router.post("/api/daily-pages/{date_str}/tasks", response_model=TaskOut)
async def create_task(date_str: str, body: TaskCreate, db: AsyncSession = Depends(get_db)):
    d = date.fromisoformat(date_str)
    result = await db.execute(select(DailyPage).where(DailyPage.date == d))
    page = result.scalar_one_or_none()
    if page is None:
        raise HTTPException(404, "Daily page not found. GET the page first to create it.")

    task = Task(
        daily_page_id=page.id,
        category_id=body.category_id,
        title=body.title,
        priority=body.priority,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.put("/api/tasks/{task_id}", response_model=TaskOut)
async def update_task(task_id: int, body: TaskUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(404, "Task not found")

    if body.status is not None and body.status not in ("done", "failed", "carry", ""):
        raise HTTPException(400, "Invalid status. Must be done, failed, carry, or empty to clear.")

    if body.title is not None:
        task.title = body.title
    if body.category_id is not None:
        task.category_id = body.category_id
    if body.priority is not None:
        task.priority = body.priority
    if body.status is not None:
        task.status = body.status if body.status != "" else None
    await db.commit()
    await db.refresh(task)
    return task


@router.delete("/api/tasks/{task_id}")
async def delete_task(task_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(404, "Task not found")
    await db.delete(task)
    await db.commit()
    return {"ok": True}
```

- [ ] **Step 4: Mount router in `main.py`**

```python
from api.tasks import router as tasks_router
app.include_router(tasks_router)
```

- [ ] **Step 5: Run tests**

```bash
pytest tests/test_api_tasks.py -v
```

Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add tasks API with CRUD operations"
```

---

## Task 6: Time Blocks API (with overlap check)

**Files:**
- Create: `api/time_blocks.py`
- Create: `tests/test_api_time_blocks.py`

- [ ] **Step 1: Write tests**

Create `tests/test_api_time_blocks.py` (uses shared `client` fixture from `conftest.py`):

```python
import pytest

pytestmark = pytest.mark.asyncio

async def _setup_task(client, date_str):
    await client.get(f"/api/daily-pages/{date_str}")
    cats = (await client.get("/api/categories")).json()
    task = (await client.post(f"/api/daily-pages/{date_str}/tasks", json={
        "title": "test task", "category_id": cats[0]["id"], "priority": 1
    })).json()
    return task

async def test_create_time_block(client):
    task = await _setup_task(client, "2026-05-01")
    resp = await client.post(f"/api/tasks/{task['id']}/time-blocks", json={
        "start_at": "09:00", "end_at": "10:30"
    })
    assert resp.status_code == 200
    assert resp.json()["start_at"] == "09:00:00"

async def test_overlap_rejected(client):
    task = await _setup_task(client, "2026-05-02")
    await client.post(f"/api/tasks/{task['id']}/time-blocks", json={
        "start_at": "09:00", "end_at": "10:00"
    })
    resp = await client.post(f"/api/tasks/{task['id']}/time-blocks", json={
        "start_at": "09:30", "end_at": "11:00"
    })
    assert resp.status_code == 409

async def test_10min_snap(client):
    task = await _setup_task(client, "2026-05-03")
    resp = await client.post(f"/api/tasks/{task['id']}/time-blocks", json={
        "start_at": "09:07", "end_at": "10:23"
    })
    assert resp.status_code == 200
    assert resp.json()["start_at"] == "09:00:00"
    assert resp.json()["end_at"] == "10:20:00"

async def test_delete_time_block(client):
    task = await _setup_task(client, "2026-05-04")
    block = (await client.post(f"/api/tasks/{task['id']}/time-blocks", json={
        "start_at": "14:00", "end_at": "15:00"
    })).json()
    resp = await client.delete(f"/api/time-blocks/{block['id']}")
    assert resp.status_code == 200
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_api_time_blocks.py -v
```

- [ ] **Step 3: Implement `api/time_blocks.py`**

```python
from datetime import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from db.database import get_db
from db.models import Task, TimeBlock, DailyPage
from pydantic import BaseModel

router = APIRouter(tags=["time_blocks"])


class TimeBlockCreate(BaseModel):
    start_at: str  # "HH:MM"
    end_at: str    # "HH:MM"


class TimeBlockOut(BaseModel):
    id: int
    task_id: int
    start_at: str
    end_at: str
    model_config = {"from_attributes": True}


def _snap_10min(t: time) -> time:
    return t.replace(minute=(t.minute // 10) * 10, second=0)


def _parse_time(s: str) -> time:
    parts = s.split(":")
    return time(int(parts[0]), int(parts[1]))


async def _check_overlap(db: AsyncSession, daily_page_id: int, start: time, end: time, exclude_id: int | None = None):
    stmt = (
        select(TimeBlock)
        .join(Task)
        .where(Task.daily_page_id == daily_page_id)
        .where(TimeBlock.start_at < end)
        .where(TimeBlock.end_at > start)
    )
    if exclude_id:
        stmt = stmt.where(TimeBlock.id != exclude_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none() is not None


@router.post("/api/tasks/{task_id}/time-blocks", response_model=TimeBlockOut)
async def create_time_block(task_id: int, body: TimeBlockCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(404, "Task not found")

    start = _snap_10min(_parse_time(body.start_at))
    end = _snap_10min(_parse_time(body.end_at))

    if end <= start:
        raise HTTPException(400, "end_at must be after start_at")

    if await _check_overlap(db, task.daily_page_id, start, end):
        raise HTTPException(409, "Time block overlaps with existing block")

    block = TimeBlock(task_id=task_id, start_at=start, end_at=end)
    db.add(block)
    await db.commit()
    await db.refresh(block)
    return block


@router.put("/api/time-blocks/{block_id}", response_model=TimeBlockOut)
async def update_time_block(block_id: int, body: TimeBlockCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TimeBlock).where(TimeBlock.id == block_id).options(selectinload(TimeBlock.task)))
    block = result.scalar_one_or_none()
    if block is None:
        raise HTTPException(404, "Time block not found")

    start = _snap_10min(_parse_time(body.start_at))
    end = _snap_10min(_parse_time(body.end_at))

    if end <= start:
        raise HTTPException(400, "end_at must be after start_at")

    if await _check_overlap(db, block.task.daily_page_id, start, end, exclude_id=block_id):
        raise HTTPException(409, "Time block overlaps with existing block")

    block.start_at = start
    block.end_at = end
    await db.commit()
    await db.refresh(block)
    return block


@router.delete("/api/time-blocks/{block_id}")
async def delete_time_block(block_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TimeBlock).where(TimeBlock.id == block_id))
    block = result.scalar_one_or_none()
    if block is None:
        raise HTTPException(404, "Time block not found")
    await db.delete(block)
    await db.commit()
    return {"ok": True}
```

- [ ] **Step 4: Mount router in `main.py`**

```python
from api.time_blocks import router as time_blocks_router
app.include_router(time_blocks_router)
```

- [ ] **Step 5: Run tests**

```bash
pytest tests/test_api_time_blocks.py -v
```

Expected: 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add time blocks API with overlap prevention and 10-min snap"
```

---

## Task 7: Analytics API

**Files:**
- Create: `api/analytics.py`

- [ ] **Step 1: Implement `api/analytics.py`**

```python
from datetime import date, timedelta, time
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, extract, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from db.database import get_db
from db.models import DailyPage, Task, TimeBlock, Category
from pydantic import BaseModel

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _parse_range(range_str: str) -> tuple[date, date]:
    today = date.today()
    if range_str == "week":
        start = today - timedelta(days=today.weekday())
        end = start + timedelta(days=6)
    elif range_str == "month":
        start = today.replace(day=1)
        next_month = (today.replace(day=28) + timedelta(days=4))
        end = next_month.replace(day=1) - timedelta(days=1)
    else:
        parts = range_str.split(":")
        start = date.fromisoformat(parts[0])
        end = date.fromisoformat(parts[1])
    return start, end


class TimeTrendItem(BaseModel):
    date: date
    category_name: str
    category_color: str
    total_minutes: int


@router.get("/time-trend", response_model=list[TimeTrendItem])
async def time_trend(range: str = Query("week"), db: AsyncSession = Depends(get_db)):
    start, end = _parse_range(range)
    stmt = (
        select(
            DailyPage.date,
            Category.name,
            Category.color,
            func.sum(
                extract("epoch", TimeBlock.end_at - TimeBlock.start_at)
            ).label("total_seconds"),
        )
        .join(Task, Task.daily_page_id == DailyPage.id)
        .join(TimeBlock, TimeBlock.task_id == Task.id)
        .join(Category, Category.id == Task.category_id)
        .where(DailyPage.date >= start)
        .where(DailyPage.date <= end)
        .group_by(DailyPage.date, Category.name, Category.color)
        .order_by(DailyPage.date)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        TimeTrendItem(
            date=r.date,
            category_name=r.name,
            category_color=r.color,
            total_minutes=int((r.total_seconds or 0) / 60),
        )
        for r in rows
    ]


class CategoryRatioItem(BaseModel):
    category_name: str
    category_color: str
    total_minutes: int


@router.get("/category-ratio", response_model=list[CategoryRatioItem])
async def category_ratio(range: str = Query("week"), db: AsyncSession = Depends(get_db)):
    start, end = _parse_range(range)
    stmt = (
        select(
            Category.name,
            Category.color,
            func.sum(
                extract("epoch", TimeBlock.end_at - TimeBlock.start_at)
            ).label("total_seconds"),
        )
        .join(Task, Task.category_id == Category.id)
        .join(TimeBlock, TimeBlock.task_id == Task.id)
        .join(DailyPage, DailyPage.id == Task.daily_page_id)
        .where(DailyPage.date >= start)
        .where(DailyPage.date <= end)
        .group_by(Category.name, Category.color)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        CategoryRatioItem(
            category_name=r.name,
            category_color=r.color,
            total_minutes=int((r.total_seconds or 0) / 60),
        )
        for r in rows
    ]


class CompletionRateItem(BaseModel):
    status: str
    count: int
    percentage: float


@router.get("/completion-rate", response_model=list[CompletionRateItem])
async def completion_rate(range: str = Query("week"), db: AsyncSession = Depends(get_db)):
    start, end = _parse_range(range)
    stmt = (
        select(Task.status, func.count().label("cnt"))
        .join(DailyPage, DailyPage.id == Task.daily_page_id)
        .where(DailyPage.date >= start)
        .where(DailyPage.date <= end)
        .group_by(Task.status)
    )
    result = await db.execute(stmt)
    rows = result.all()
    total = sum(r.cnt for r in rows) or 1
    return [
        CompletionRateItem(
            status=r.status or "pending",
            count=r.cnt,
            percentage=round(r.cnt / total * 100, 1),
        )
        for r in rows
    ]
```

Note: The time duration query uses PostgreSQL-specific `extract(epoch ...)`. For the actual Neon PostgreSQL deployment, use this approach. The exact SQL may need adjustment during implementation — the key logic is: sum up `(end_at - start_at)` for each time block, grouped by date and category.

- [ ] **Step 2: Mount router in `main.py`**

```python
from api.analytics import router as analytics_router
app.include_router(analytics_router)
```

- [ ] **Step 3: Test manually with sample data**

```bash
uvicorn main:app --reload
# Insert some test data via the API, then:
# GET http://127.0.0.1:8000/api/analytics/completion-rate?range=week
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add analytics API (time trend, category ratio, completion rate)"
```

---

## Task 8: Static File Serving & Calendar Page

**Files:**
- Create: `static/index.html`, `static/css/style.css`, `static/js/calendar.js`
- Modify: `main.py` (mount static files)

- [ ] **Step 1: Add static file serving to `main.py`**

```python
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def root():
    return FileResponse("static/index.html")

@app.get("/day")
async def day_page():
    return FileResponse("static/day.html")

@app.get("/dashboard")
async def dashboard_page():
    return FileResponse("static/dashboard.html")
```

- [ ] **Step 2: Create `static/css/style.css`**

Base styles: clean layout, calendar grid, responsive. Use CSS Grid for the calendar (7 columns). Style the calendar cells with hover effects. Keep it minimal — functional first.

Key CSS classes needed:
- `.calendar-grid` — 7-column grid for the month
- `.calendar-cell` — individual day cell with hover/click styles
- `.calendar-header` — month navigation bar
- Colors: white background, subtle borders, category colors from DB

- [ ] **Step 3: Create `static/index.html`**

HTML shell with:
- Month navigation header (◀ 2026년 3월 ▶)
- Dashboard link button
- Calendar grid container (populated by JS)
- Script tag linking to `calendar.js`

- [ ] **Step 4: Create `static/js/calendar.js`**

Implement:
- `currentYear`, `currentMonth` state variables
- `renderCalendar(year, month)` — fetch `/api/daily-pages?month=YYYY-MM`, build grid
- Each cell shows: date number + completion rate (done/total)
- Cell click → `window.location = /day?date=YYYY-MM-DD`
- ◀/▶ buttons change month and re-render
- Dashboard button → `window.location = /dashboard`

- [ ] **Step 5: Test in browser**

```bash
uvicorn main:app --reload
# Visit http://127.0.0.1:8000/ -> calendar should render
# Click a date -> should navigate to /day?date=...
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add calendar page with monthly view and navigation"
```

---

## Task 9: Daily Detail Page — Checklist

**Files:**
- Create: `static/day.html`, `static/js/day.js`

- [ ] **Step 1: Create `static/day.html`**

HTML shell matching the spec wireframe:
- Header: ◀ date (요일) ▶ + D-DAY display
- Comment input field
- Total time display
- Left panel: checklist
- Right panel: timetable (placeholder for now)
- Bottom: memo textarea
- Script tag linking to `day.js`

- [ ] **Step 2: Implement checklist in `static/js/day.js`**

Read `date` from URL query param. On load:
1. `GET /api/daily-pages/{date}` — get page data with tasks
2. `GET /api/categories` — get category list for colors and dropdown
3. Render checklist: each task shows `[color dot] priority. title [status icon]`
4. Status click cycles: null → ✔ → ✖ → ▲ → null (calls `PUT /api/tasks/{id}`)
5. "Add task" form: title input + category dropdown + submit (calls `POST`)
6. Delete button on each task (calls `DELETE /api/tasks/{id}`)
7. Comment/memo fields: on blur, call `PUT /api/daily-pages/{date}`
8. ◀/▶ buttons: change date in URL and reload

- [ ] **Step 3: Test in browser**

```bash
# Visit http://127.0.0.1:8000/day?date=2026-03-21
# Add tasks, toggle status, edit comment/memo
# Refresh page — data should persist
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add daily detail page with checklist functionality"
```

---

## Task 10: Daily Detail Page — Timetable

**Files:**
- Modify: `static/js/day.js`, `static/css/style.css`

- [ ] **Step 1: Build timetable grid in HTML/CSS**

CSS:
- `.timetable` container: 144 columns (24h x 6 slots per hour), scrollable horizontally
- `.timetable-row`: one row = one hour label
- `.timetable-cell`: one 10-min slot, clickable/draggable
- Filled cells get background color from task's category

Hour labels on top: 0, 1, 2, ... 23.

- [ ] **Step 2: Implement timetable interaction in JS**

1. Render 144 cells (0:00 to 23:50 in 10-min steps)
2. Fill cells that have existing time blocks (from page data) with category color
3. **Task selection**: clicking a task in checklist marks it as "active" (highlighted)
4. **Drag to paint**: mousedown on timetable → drag across cells → mouseup creates time block
   - Snaps to 10-min grid automatically
   - Uses active task's category color
   - On mouseup: `POST /api/tasks/{active_task_id}/time-blocks` with start/end
   - If 409 (overlap), show alert and undo visual paint
5. **Click existing block to delete**: click a filled cell → confirm → `DELETE /api/time-blocks/{id}`
6. **Total time**: recalculate on every add/delete, display in header

- [ ] **Step 3: Test in browser**

```bash
# Select a task in checklist
# Drag across timetable cells to paint time
# Verify color matches category
# Verify overlap is rejected
# Verify total time updates
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add timetable with drag-to-paint and 10-min snap"
```

---

## Task 11: Dashboard Page

**Files:**
- Create: `static/dashboard.html`, `static/js/dashboard.js`

- [ ] **Step 1: Create `static/dashboard.html`**

HTML shell:
- Header: "Dashboard" + range selector dropdown (이번 주 / 이번 달 / custom)
- Two chart containers side by side (time trend bar chart, category donut chart)
- One chart container below (completion rate horizontal bar)
- Include Chart.js via CDN: `https://cdn.jsdelivr.net/npm/chart.js`
- Script tag linking to `dashboard.js`

- [ ] **Step 2: Implement `static/js/dashboard.js`**

On load + on range change:
1. Fetch all three analytics endpoints with selected range
2. **Time trend** (stacked bar chart):
   - X axis: dates
   - Y axis: minutes
   - Stacked by category, using category colors
3. **Category ratio** (donut chart):
   - Each slice = one category
   - Colors from API response
4. **Completion rate** (horizontal stacked bar):
   - Three segments: done (green), carry (orange), failed (red)
   - Show percentage labels

- [ ] **Step 3: Test in browser**

```bash
# Add some test data across multiple days
# Visit http://127.0.0.1:8000/dashboard
# Switch between week/month ranges
# Verify charts update
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add analytics dashboard with Chart.js visualizations"
```

---

## Task 12: Polish & Final Integration

**Files:**
- Modify: `static/css/style.css`, various HTML/JS files

- [ ] **Step 1: Consistent styling pass**

- Ensure all three pages share consistent fonts, colors, spacing
- Calendar cells: subtle background color change for days that have data
- Day page: proper layout for checklist + timetable side by side
- Dashboard: charts sized properly, responsive layout
- Mobile considerations: stack calendar cells, scroll timetable

- [ ] **Step 2: D-DAY label editing**

Add input field in day page header for D-DAY label. On blur → `PUT /api/daily-pages/{date}`.

- [ ] **Step 3: Task priority drag-to-reorder**

Add drag handle to checklist items. On drop → `PUT /api/tasks/{id}` with new priority value for each reordered task.

- [ ] **Step 4: Navigation links on all pages**

- Calendar → link to Dashboard
- Day page → back to Calendar link
- Dashboard → back to Calendar link

- [ ] **Step 5: End-to-end manual test**

Full flow:
1. Open calendar → see month view
2. Click a date → see empty day page
3. Add tasks with different categories
4. Paint time blocks on timetable
5. Toggle task statuses
6. Go back to calendar → see completion rates
7. Open dashboard → see charts
8. Change range → charts update

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: polish UI styling and add final integration touches"
```
