from tests.conftest import AUTH1, SAMPLE


def test_post_single_roundtrip(client):
    r = client.post("/v1/charges", json=SAMPLE, headers=AUTH1)
    assert r.status_code == 200
    assert r.json() == {"accepted": 1, "duplicates": 0}

    r = client.get("/v1/charges", headers=AUTH1)
    items = r.json()["items"]
    assert len(items) == 1
    item = items[0]
    assert item["id"] == SAMPLE["id"]
    assert item["tool"] == SAMPLE["tool"]
    assert item["amount_usd"] == SAMPLE["amount_usd"]
    assert item["seller_ref"] == SAMPLE["seller_ref"]
    assert item["received_at"] is not None


def test_idempotency(client):
    client.post("/v1/charges", json=SAMPLE, headers=AUTH1)
    r = client.post("/v1/charges", json=SAMPLE, headers=AUTH1)
    assert r.json() == {"accepted": 0, "duplicates": 1}

    r = client.get("/v1/charges", headers=AUTH1)
    assert len(r.json()["items"]) == 1


def test_batch(client):
    charges = [{**SAMPLE, "id": f"chg_b{i}"} for i in range(3)]
    r = client.post("/v1/charges", json=charges, headers=AUTH1)
    assert r.json() == {"accepted": 3, "duplicates": 0}

    r = client.get("/v1/charges", headers=AUTH1)
    assert len(r.json()["items"]) == 3


def test_unknown_field_stored_in_metadata(client):
    charge = {**SAMPLE, "id": "chg_extra", "my_custom_key": "my_value"}
    r = client.post("/v1/charges", json=charge, headers=AUTH1)
    assert r.status_code == 200

    r = client.get("/v1/charges", headers=AUTH1)
    item = r.json()["items"][0]
    assert item["metadata"]["my_custom_key"] == "my_value"


def test_post_free_call_roundtrip(client):
    free_call = {
        **SAMPLE,
        "id": "chg_free",
        "amount_usd": None,
        "currency": None,
    }

    r = client.post("/v1/charges", json=free_call, headers=AUTH1)
    assert r.status_code == 200

    items = client.get("/v1/charges", headers=AUTH1).json()["items"]
    assert len(items) == 1
    item = items[0]
    assert item["id"] == "chg_free"
    assert item["status"] == "recorded"
    assert item["amount_usd"] is None
    assert item["currency"] == "USD"


def test_post_failed_call_without_amount_roundtrip(client):
    failed_call = {
        **SAMPLE,
        "id": "chg_failed",
        "status": "failed",
        "amount_usd": None,
        "http_status": 503,
        "currency": None,
    }

    r = client.post("/v1/charges", json=failed_call, headers=AUTH1)
    assert r.status_code == 200

    items = client.get("/v1/charges", headers=AUTH1).json()["items"]
    assert len(items) == 1
    item = items[0]
    assert item["id"] == "chg_failed"
    assert item["status"] == "failed"
    assert item["amount_usd"] is None
    assert item["http_status"] == 503
