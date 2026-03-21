import pytest

pytestmark = pytest.mark.asyncio


async def test_get_or_create_daily_page(client):
    resp = await client.get("/api/daily-pages/2026-03-21")
    assert resp.status_code == 200
    data = resp.json()
    assert data["date"] == "2026-03-21"
    assert data["tasks"] == []


async def test_update_daily_page(client):
    await client.get("/api/daily-pages/2026-03-22")
    resp = await client.put("/api/daily-pages/2026-03-22", json={
        "comment": "test comment",
        "memo": "test memo",
        "d_day_label": "D-30"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["comment"] == "test comment"
    assert data["memo"] == "test memo"
    assert data["d_day_label"] == "D-30"


async def test_monthly_summary(client):
    await client.get("/api/daily-pages/2026-03-23")
    resp = await client.get("/api/daily-pages?month=2026-03")
    assert resp.status_code == 200
    items = resp.json()
    assert isinstance(items, list)
    dates = [i["date"] for i in items]
    assert "2026-03-23" in dates
