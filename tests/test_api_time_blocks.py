import pytest

pytestmark = pytest.mark.asyncio


async def _setup_task(client, date_str):
    await client.get(f"/api/daily-pages/{date_str}")
    cats = (await client.get("/api/categories")).json()
    task = (await client.post(f"/api/daily-pages/{date_str}/tasks", json={
        "title": "test task", "category_id": cats[0]["id"], "priority": 1
    })).json()
    return task


async def test_create_time_block(client):
    task = await _setup_task(client, "2026-05-01")
    resp = await client.post(f"/api/tasks/{task['id']}/time-blocks", json={
        "start_at": "09:00", "end_at": "10:30"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "09:00" in data["start_at"]
    assert "10:30" in data["end_at"]


async def test_overlap_rejected(client):
    task = await _setup_task(client, "2026-05-02")
    await client.post(f"/api/tasks/{task['id']}/time-blocks", json={
        "start_at": "09:00", "end_at": "10:00"
    })
    resp = await client.post(f"/api/tasks/{task['id']}/time-blocks", json={
        "start_at": "09:30", "end_at": "11:00"
    })
    assert resp.status_code == 409


async def test_10min_snap(client):
    task = await _setup_task(client, "2026-05-03")
    resp = await client.post(f"/api/tasks/{task['id']}/time-blocks", json={
        "start_at": "09:07", "end_at": "10:23"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "09:00" in data["start_at"]
    assert "10:20" in data["end_at"]


async def test_delete_time_block(client):
    task = await _setup_task(client, "2026-05-04")
    block = (await client.post(f"/api/tasks/{task['id']}/time-blocks", json={
        "start_at": "14:00", "end_at": "15:00"
    })).json()
    resp = await client.delete(f"/api/time-blocks/{block['id']}")
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


async def test_end_before_start_rejected(client):
    task = await _setup_task(client, "2026-05-05")
    resp = await client.post(f"/api/tasks/{task['id']}/time-blocks", json={
        "start_at": "10:00", "end_at": "09:00"
    })
    assert resp.status_code == 400
