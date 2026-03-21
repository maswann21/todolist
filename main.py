from contextlib import asynccontextmanager
from fastapi import FastAPI
from db.database import engine, Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(title="Daily Time Tracker", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok"}
