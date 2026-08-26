import os

# Must be set before any collector imports so db.py picks up the in-memory URL
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("COLLECTOR_API_KEYS", "key1:acct1,key2:acct2")

import sqlmodel
import pytest
from fastapi.testclient import TestClient

from collector.app import app
from collector.db import create_db, engine

AUTH1 = {"Authorization": "Bearer key1"}
AUTH2 = {"Authorization": "Bearer key2"}

SAMPLE = {
    "id": "chg_sample",
    "ts": "2026-08-07T14:22:08Z",
    "tool": "call_api",
    "seller_ref": "api.test.com",
    "agent_ref": "test-bot",
    "status": "recorded",
    "amount_usd": "0.00100000",
    "currency": "USD",
}


@pytest.fixture
def client():
    # Fresh schema for every test
    sqlmodel.SQLModel.metadata.drop_all(engine)
    with TestClient(app) as c:  # lifespan runs create_db + _seed_api_keys
        yield c
