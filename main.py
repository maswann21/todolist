from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.middleware.gzip import GZipMiddleware
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


class CacheControlMiddleware:
    """Pure ASGI middleware that adds Cache-Control headers for static assets."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope["path"].startswith("/static/"):
            async def send_with_cache(message):
                if message["type"] == "http.response.start":
                    headers = list(message.get("headers", []))
                    headers.append((b"cache-control", b"public, max-age=86400"))
                    message["headers"] = headers
                await send(message)
            await self.app(scope, receive, send_with_cache)
        else:
            await self.app(scope, receive, send)


app = FastAPI(title="Daily Time Tracker", lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(CacheControlMiddleware)

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
