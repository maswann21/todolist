from contextlib import asynccontextmanager
from fastapi import FastAPI
from db.database import engine, Base, async_session
from db.seed import seed_categories
from api.categories import router as categories_router
from api.daily_pages import router as daily_pages_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_session() as session:
        await seed_categories(session)
    yield


app = FastAPI(title="Daily Time Tracker", lifespan=lifespan)
app.include_router(categories_router)
app.include_router(daily_pages_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
