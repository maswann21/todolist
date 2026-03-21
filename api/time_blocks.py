from datetime import time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from db.database import get_db
from db.models import Task, TimeBlock

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

    @field_validator("start_at", "end_at", mode="before")
    @classmethod
    def coerce_time(cls, v):
        if hasattr(v, "strftime"):
            return v.strftime("%H:%M:%S")
        return str(v)


def _snap_10min(t: time) -> time:
    """Snap time to nearest 10-minute boundary (floor)."""
    return t.replace(minute=(t.minute // 10) * 10, second=0, microsecond=0)


def _parse_hhmm(s: str) -> time:
    parts = s.split(":")
    return time(int(parts[0]), int(parts[1]))


async def _check_overlap(
    db: AsyncSession,
    daily_page_id: int,
    start: time,
    end: time,
    exclude_id: Optional[int] = None,
) -> bool:
    """Return True if there is an overlapping time block for the given day."""
    stmt = (
        select(TimeBlock)
        .join(Task)
        .where(Task.daily_page_id == daily_page_id)
        .where(TimeBlock.start_at < end)
        .where(TimeBlock.end_at > start)
    )
    if exclude_id is not None:
        stmt = stmt.where(TimeBlock.id != exclude_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none() is not None


@router.post("/api/tasks/{task_id}/time-blocks", response_model=TimeBlockOut)
async def create_time_block(
    task_id: int, body: TimeBlockCreate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Task).where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(404, "Task not found")

    start = _snap_10min(_parse_hhmm(body.start_at))
    end = _snap_10min(_parse_hhmm(body.end_at))

    if end <= start:
        raise HTTPException(400, "end_at must be after start_at")

    if await _check_overlap(db, task.daily_page_id, start, end):
        raise HTTPException(409, "Time block overlaps with an existing block for this day")

    block = TimeBlock(task_id=task_id, start_at=start, end_at=end)
    db.add(block)
    await db.commit()
    await db.refresh(block)
    return block


@router.put("/api/time-blocks/{block_id}", response_model=TimeBlockOut)
async def update_time_block(
    block_id: int, body: TimeBlockCreate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(TimeBlock).where(TimeBlock.id == block_id).options(selectinload(TimeBlock.task))
    )
    block = result.scalar_one_or_none()
    if block is None:
        raise HTTPException(404, "Time block not found")

    start = _snap_10min(_parse_hhmm(body.start_at))
    end = _snap_10min(_parse_hhmm(body.end_at))

    if end <= start:
        raise HTTPException(400, "end_at must be after start_at")

    if await _check_overlap(db, block.task.daily_page_id, start, end, exclude_id=block_id):
        raise HTTPException(409, "Time block overlaps with an existing block for this day")

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
