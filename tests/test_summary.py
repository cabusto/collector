from tests.conftest import AUTH1, SAMPLE


def test_summary_by_seller_ref(client):
    client.post(
        "/v1/charges",
        json=[
            {
                **SAMPLE,
                "id": "su_1",
                "seller_ref": "api.a.com",
                "amount_usd": "0.00100000",
            },
            {
                **SAMPLE,
                "id": "su_2",
                "seller_ref": "api.a.com",
                "amount_usd": "0.00200000",
            },
            {
                **SAMPLE,
                "id": "su_3",
                "seller_ref": "api.b.com",
                "amount_usd": "1.00000000",
            },
        ],
        headers=AUTH1,
    )

    rows = {
        r["key"]: r
        for r in client.get(
            "/v1/charges/summary?group_by=seller_ref", headers=AUTH1
        ).json()
    }
    assert rows["api.a.com"]["count"] == 2
    assert rows["api.a.com"]["amount_usd"] == "0.00300000"
    assert rows["api.b.com"]["count"] == 1
    assert rows["api.b.com"]["amount_usd"] == "1.00000000"


def test_summary_decimal_accuracy(client):
    # Float addition of 0.1 * 3 is not exactly 0.3; decimal must be exact
    charges = [
        {**SAMPLE, "id": f"su_d{i}", "amount_usd": "0.00000001"} for i in range(3)
    ]
    client.post("/v1/charges", json=charges, headers=AUTH1)

    rows = client.get("/v1/charges/summary?group_by=tool", headers=AUTH1).json()
    assert rows[0]["amount_usd"] == "0.00000003"


def test_summary_status_filter(client):
    client.post(
        "/v1/charges",
        json=[
            {**SAMPLE, "id": "su_f1", "status": "recorded", "amount_usd": "1.00000000"},
            {**SAMPLE, "id": "su_f2", "status": "error", "amount_usd": "2.00000000"},
        ],
        headers=AUTH1,
    )

    rows = client.get(
        "/v1/charges/summary?group_by=status&status=recorded", headers=AUTH1
    ).json()
    assert len(rows) == 1
    assert rows[0]["key"] == "recorded"
    assert rows[0]["amount_usd"] == "1.00000000"


def test_summary_sorted_by_amount_desc(client):
    client.post(
        "/v1/charges",
        json=[
            {
                **SAMPLE,
                "id": "su_o1",
                "seller_ref": "cheap.com",
                "amount_usd": "0.00100000",
            },
            {
                **SAMPLE,
                "id": "su_o2",
                "seller_ref": "expensive.com",
                "amount_usd": "9.99000000",
            },
        ],
        headers=AUTH1,
    )

    rows = client.get("/v1/charges/summary?group_by=seller_ref", headers=AUTH1).json()
    assert rows[0]["key"] == "expensive.com"
    assert rows[1]["key"] == "cheap.com"


def test_summary_includes_failure_and_latency_metrics(client):
    client.post(
        "/v1/charges",
        json=[
            {
                **SAMPLE,
                "id": "su_perf1",
                "seller_ref": "slow-fail.com",
                "status": "failed",
                "duration_ms": 1200,
                "amount_usd": "2.00000000",
            },
            {
                **SAMPLE,
                "id": "su_perf2",
                "seller_ref": "slow-fail.com",
                "status": "recorded",
                "duration_ms": 800,
                "amount_usd": "1.00000000",
            },
            {
                **SAMPLE,
                "id": "su_perf3",
                "seller_ref": "healthy.com",
                "status": "recorded",
                "duration_ms": 100,
                "amount_usd": "5.00000000",
            },
        ],
        headers=AUTH1,
    )

    rows = {
        r["key"]: r
        for r in client.get(
            "/v1/charges/summary?group_by=seller_ref", headers=AUTH1
        ).json()
    }

    assert rows["slow-fail.com"]["failure_count"] == 1
    assert rows["slow-fail.com"]["failure_rate"] == 0.5
    assert rows["slow-fail.com"]["timed_count"] == 2
    assert rows["slow-fail.com"]["avg_duration_ms"] == 1000.0
    assert rows["healthy.com"]["failure_count"] == 0
    assert rows["healthy.com"]["failure_rate"] == 0
