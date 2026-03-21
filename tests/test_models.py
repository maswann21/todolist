import pytest
from datetime import date, time
from db.models import Category, DailyPage, Task, TimeBlock

pytestmark = pytest.mark.asyncio


async def test_create_category(db):
    cat = Category(name="공부_model_test", color="#22C55E")
    db.add(cat)
    await db.commit()
    assert cat.id is not None
    assert cat.name == "공부_model_test"


async def test_create_daily_page(db):
    page = DailyPage(date=date(2025, 1, 1))
    db.add(page)
    await db.commit()
    assert page.id is not None


async def test_create_task_with_time_block(db):
    cat = Category(name="업무_model_test", color="#3B82F6")
    db.add(cat)
    await db.flush()

    page = DailyPage(date=date(2025, 1, 2))
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
