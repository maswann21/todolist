from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, extract, func
from sqlalchemy.ext.asyncio import AsyncSession
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
        next_month = today.replace(day=28) + timedelta(days=4)
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


class CategoryRatioItem(BaseModel):
    category_name: str
    category_color: str
    total_minutes: int


class CompletionRateItem(BaseModel):
    status: str
    count: int
    percentage: float


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
