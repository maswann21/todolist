import pytest

pytestmark = pytest.mark.asyncio


async def test_create_task(client):
    await client.get("/api/daily-pages/2026-04-01")
    cats = (await client.get("/api/categories")).json()
    cat_id = cats[0]["id"]

    resp = await client.post("/api/daily-pages/2026-04-01/tasks", json={
        "title": "알고리즘 공부",
        "category_id": cat_id,
        "priority": 1
    })
    assert resp.status_code == 200
    assert resp.json()["title"] == "알고리즘 공부"
    assert resp.json()["status"] is None


async def test_update_task_status(client):
    await client.get("/api/daily-pages/2026-04-02")
    cats = (await client.get("/api/categories")).json()
    task = (await client.post("/api/daily-pages/2026-04-02/tasks", json={
        "title": "운동", "category_id": cats[0]["id"], "priority": 1
    })).json()

    resp = await client.put(f"/api/tasks/{task['id']}", json={"status": "done"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "done"


async def test_clear_task_status(client):
    await client.get("/api/daily-pages/2026-04-03")
    cats = (await client.get("/api/categories")).json()
    task = (await client.post("/api/daily-pages/2026-04-03/tasks", json={
        "title": "청소", "category_id": cats[0]["id"], "priority": 1
    })).json()

    await client.put(f"/api/tasks/{task['id']}", json={"status": "done"})
    resp = await client.put(f"/api/tasks/{task['id']}", json={"status": ""})
    assert resp.status_code == 200
    assert resp.json()["status"] is None


async def test_delete_task(client):
    await client.get("/api/daily-pages/2026-04-04")
    cats = (await client.get("/api/categories")).json()
    task = (await client.post("/api/daily-pages/2026-04-04/tasks", json={
        "title": "삭제 대상", "category_id": cats[0]["id"], "priority": 1
    })).json()

    resp = await client.delete(f"/api/tasks/{task['id']}")
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


async def test_invalid_status_rejected(client):
    await client.get("/api/daily-pages/2026-04-05")
    cats = (await client.get("/api/categories")).json()
    task = (await client.post("/api/daily-pages/2026-04-05/tasks", json={
        "title": "test", "category_id": cats[0]["id"], "priority": 1
    })).json()

    resp = await client.put(f"/api/tasks/{task['id']}", json={"status": "invalid_status"})
    assert resp.status_code == 400
