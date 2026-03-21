from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from db.database import engine, Base, async_session
from db.seed import seed_categories
from api.categories import router as categories_router
from api.daily_pages import router as daily_pages_router
from api.tasks import router as tasks_router
from api.time_blocks import router as time_blocks_router
from api.analytics import router as analytics_router


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
app.include_router(tasks_router)
app.include_router(time_blocks_router)
app.include_router(analytics_router)

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


@app.get("/health")
async def health():
    return {"status": "ok"}
