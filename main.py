from fastapi import FastAPI

app = FastAPI(title="Daily Time Tracker")

@app.get("/health")
async def health():
    return {"status": "ok"}
