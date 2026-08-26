from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import JSON as SAJSON
from sqlalchemy import Column
from sqlmodel import Field, SQLModel


class Charge(SQLModel, table=True):
    __tablename__ = "charges"

    id: str = Field(primary_key=True)
    account_id: str = Field(primary_key=True, index=True)
    ts: datetime = Field(index=True)
    received_at: datetime
    tool: str = Field(index=True)
    seller_ref: Optional[str] = Field(default=None, index=True)
    agent_ref: Optional[str] = Field(default=None, index=True)
    resource: Optional[str] = Field(default=None)
    rail: Optional[str] = Field(default=None)
    status: str = Field(index=True)
    http_status: Optional[int] = Field(default=None)
    # stored as decimal string — never float
    amount_usd: Optional[str] = Field(default=None)
    currency: Optional[str] = Field(default="USD")
    duration_ms: Optional[float] = Field(default=None)
    # Python name avoids SQLAlchemy's reserved 'metadata' class attribute
    extra_metadata: Optional[dict[str, Any]] = Field(
        default=None, sa_column=Column("metadata", SAJSON)
    )
    raw: Optional[dict[str, Any]] = Field(default=None, sa_column=Column("raw", SAJSON))


class ApiKey(SQLModel, table=True):
    __tablename__ = "api_keys"

    id: str = Field(primary_key=True)
    account_id: str = Field(index=True)
    name: str = Field(default="")
    prefix: str = Field(default="")
    # SHA-256 of the raw key — plaintext is never stored
    key_hash: str = Field(index=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    last_used_at: Optional[datetime] = Field(default=None)
    revoked_at: Optional[datetime] = Field(default=None)
