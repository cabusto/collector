from tests.conftest import AUTH1, SAMPLE


def test_filter_by_status(client):
    client.post("/v1/charges", json=[
        {**SAMPLE, "id": "q_ok", "status": "recorded"},
        {**SAMPLE, "id": "q_err", "status": "error"},
    ], headers=AUTH1)

    items = client.get("/v1/charges?status=recorded", headers=AUTH1).json()["items"]
    assert all(i["status"] == "recorded" for i in items)
    assert len(items) == 1


def test_filter_by_seller_ref(client):
    client.post("/v1/charges", json=[
        {**SAMPLE, "id": "q_s1", "seller_ref": "api.a.com"},
        {**SAMPLE, "id": "q_s2", "seller_ref": "api.b.com"},
    ], headers=AUTH1)

    items = client.get("/v1/charges?seller_ref=api.a.com", headers=AUTH1).json()["items"]
    assert len(items) == 1
    assert items[0]["seller_ref"] == "api.a.com"


def test_filter_by_agent_ref(client):
    client.post("/v1/charges", json=[
        {**SAMPLE, "id": "q_a1", "agent_ref": "bot-alpha"},
        {**SAMPLE, "id": "q_a2", "agent_ref": "bot-beta"},
    ], headers=AUTH1)

    items = client.get("/v1/charges?agent_ref=bot-alpha", headers=AUTH1).json()["items"]
    assert len(items) == 1
    assert items[0]["agent_ref"] == "bot-alpha"


def test_filter_by_time_range(client):
    client.post("/v1/charges", json=[
        {**SAMPLE, "id": "q_t1", "ts": "2026-01-15T00:00:00Z"},
        {**SAMPLE, "id": "q_t2", "ts": "2026-05-15T00:00:00Z"},
        {**SAMPLE, "id": "q_t3", "ts": "2026-09-15T00:00:00Z"},
    ], headers=AUTH1)

    items = client.get(
        "/v1/charges?from=2026-03-01T00:00:00Z&to=2026-07-01T00:00:00Z",
        headers=AUTH1,
    ).json()["items"]
    ids = {i["id"] for i in items}
    assert "q_t2" in ids
    assert "q_t1" not in ids
    assert "q_t3" not in ids


def test_pagination_cursor(client):
    charges = [
        {**SAMPLE, "id": f"q_p{i}", "ts": f"2026-0{i + 1}-01T00:00:00Z"}
        for i in range(5)
    ]
    client.post("/v1/charges", json=charges, headers=AUTH1)

    r1 = client.get("/v1/charges?limit=3", headers=AUTH1).json()
    assert len(r1["items"]) == 3
    assert r1["next_cursor"] is not None

    r2 = client.get(f"/v1/charges?limit=3&cursor={r1['next_cursor']}", headers=AUTH1).json()
    assert len(r2["items"]) == 2
    assert r2["next_cursor"] is None

    # no overlap between pages
    ids1 = {i["id"] for i in r1["items"]}
    ids2 = {i["id"] for i in r2["items"]}
    assert not ids1 & ids2
    assert len(ids1 | ids2) == 5
