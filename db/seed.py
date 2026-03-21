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
