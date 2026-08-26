from tests.conftest import AUTH1, SAMPLE

ADMIN = {"Authorization": "Bearer test-admin-token"}
BAD_ADMIN = {"Authorization": "Bearer wrong-token"}


def _mint(client, name="test-key", account_id="acct1"):
    r = client.post(
        "/v1/api-keys", json={"name": name, "account_id": account_id}, headers=ADMIN
    )
    assert r.status_code == 200
    return r.json()


def test_create_key_returns_full_key_once(client):
    data = _mint(client)
    assert data["key"].startswith("stk_")
    assert "id" in data and "created_at" in data
    assert data["account_id"] == "acct1"


def test_minted_key_works_for_charges(client):
    data = _mint(client, account_id="acct_new")
    key_header = {"Authorization": f"Bearer {data['key']}"}

    r = client.post("/v1/charges", json={**SAMPLE, "id": "chg_minted"}, headers=key_header)
    assert r.status_code == 200

    items = client.get("/v1/charges", headers=key_header).json()["items"]
    assert len(items) == 1
    assert items[0]["account_id"] == "acct_new"


def test_list_keys_hides_secret(client):
    _mint(client, name="visible-key")
    rows = client.get("/v1/api-keys", headers=ADMIN).json()
    assert len(rows) == 1
    assert "key" not in rows[0]
    assert "key_hash" not in rows[0]
    assert rows[0]["prefix"].startswith("stk_")


def test_revoke_key(client):
    data = _mint(client)
    key_header = {"Authorization": f"Bearer {data['key']}"}

    # Key works before revocation
    r = client.post("/v1/charges", json={**SAMPLE, "id": "chg_rev"}, headers=key_header)
    assert r.status_code == 200

    # Revoke it
    r = client.delete(f"/v1/api-keys/{data['id']}", headers=ADMIN)
    assert r.json() == {"revoked": data["id"]}

    # Key rejected after revocation
    r = client.get("/v1/charges", headers=key_header)
    assert r.status_code == 401


def test_non_admin_rejected(client):
    r = client.post("/v1/api-keys", json={"name": "x"}, headers=AUTH1)
    assert r.status_code == 401

    r = client.post("/v1/api-keys", json={"name": "x"}, headers=BAD_ADMIN)
    assert r.status_code == 401


def test_revoked_key_not_in_list(client):
    data = _mint(client)
    client.delete(f"/v1/api-keys/{data['id']}", headers=ADMIN)
    rows = client.get("/v1/api-keys", headers=ADMIN).json()
    assert not any(r["id"] == data["id"] for r in rows)


def test_last_used_at_updated(client):
    data = _mint(client)
    key_header = {"Authorization": f"Bearer {data['key']}"}

    # last_used_at starts null
    rows = client.get("/v1/api-keys", headers=ADMIN).json()
    assert rows[0]["last_used_at"] is None

    client.get("/v1/charges", headers=key_header)

    rows = client.get("/v1/api-keys", headers=ADMIN).json()
    assert rows[0]["last_used_at"] is not None
