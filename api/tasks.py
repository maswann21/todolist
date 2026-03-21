from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import get_db
from db.models import DailyPage, Task
from pydantic import BaseModel

router = APIRouter(tags=["tasks"])

VALID_STATUSES = {"done", "failed", "carry", ""}


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

    if body.status is not None and body.status not in VALID_STATUSES:
        raise HTTPException(400, "Invalid status. Must be done, failed, carry, or empty string to clear.")

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
