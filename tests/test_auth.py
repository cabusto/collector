from tests.conftest import AUTH1, AUTH2, SAMPLE


def test_missing_auth_returns_401(client):
    r = client.post("/v1/charges", json=SAMPLE)
    assert r.status_code == 401


def test_invalid_key_returns_401(client):
    r = client.post(
        "/v1/charges", json=SAMPLE, headers={"Authorization": "Bearer badkey"}
    )
    assert r.status_code == 401


def test_missing_required_fields_return_400(client):
    for field in ("id", "ts", "tool", "status"):
        charge = {k: v for k, v in SAMPLE.items() if k != field}
        r = client.post("/v1/charges", json=charge, headers=AUTH1)
        assert r.status_code == 400, f"expected 400 when {field!r} is missing"


def test_malformed_json_returns_400(client):
    r = client.post(
        "/v1/charges",
        content="not-json",
        headers={**AUTH1, "Content-Type": "application/json"},
    )
    assert r.status_code == 400


def test_account_isolation(client):
    charge_a = {**SAMPLE, "id": "chg_a"}
    charge_b = {**SAMPLE, "id": "chg_b"}
    client.post("/v1/charges", json=charge_a, headers=AUTH1)
    client.post("/v1/charges", json=charge_b, headers=AUTH2)

    ids1 = {i["id"] for i in client.get("/v1/charges", headers=AUTH1).json()["items"]}
    ids2 = {i["id"] for i in client.get("/v1/charges", headers=AUTH2).json()["items"]}

    assert "chg_a" in ids1 and "chg_b" not in ids1
    assert "chg_b" in ids2 and "chg_a" not in ids2


def test_account_isolation_on_write(client):
    # key2 should not be able to overwrite key1's charge
    client.post("/v1/charges", json={**SAMPLE, "id": "chg_shared"}, headers=AUTH1)
    client.post(
        "/v1/charges",
        json={**SAMPLE, "id": "chg_shared", "tool": "hacked"},
        headers=AUTH2,
    )

    items = client.get("/v1/charges", headers=AUTH1).json()["items"]
    assert items[0]["tool"] == SAMPLE["tool"]
