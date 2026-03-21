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
