from datetime import date, time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, extract
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, attributes
from db.database import get_db
from db.models import DailyPage, Task, TimeBlock
from pydantic import BaseModel, model_validator

router = APIRouter(prefix="/api/daily-pages", tags=["daily_pages"])


class TimeBlockOut(BaseModel):
    id: int
    task_id: int
    start_at: str
    end_at: str
    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def coerce_times(cls, values):
        if hasattr(values, "__dict__"):
            # ORM object — convert time fields to str
            obj = values
            data = {}
            for field in ("id", "task_id", "start_at", "end_at"):
                val = getattr(obj, field, None)
                if isinstance(val, time):
                    val = val.strftime("%H:%M:%S")
                data[field] = val
            return data
        # dict path
        for field in ("start_at", "end_at"):
            val = values.get(field)
            if isinstance(val, time):
                values[field] = val.strftime("%H:%M:%S")
        return values


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
        await db.refresh(page)
        attributes.set_committed_value(page, "tasks", [])
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
    # Reload with relationships (single query, no redundant refresh)
    result = await db.execute(stmt)
    page = result.scalar_one_or_none()
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
