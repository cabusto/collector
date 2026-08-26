from __future__ import annotations

import base64
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from sqlalchemy import Numeric, cast, func
from sqlmodel import Session, col, select

from .auth import get_account_id
from .config import settings
from .db import create_db, engine, get_session
from .models import ApiKey, Charge

logging.basicConfig(
    level=logging.INFO,
    format='{"ts":"%(asctime)s","level":"%(levelname)s","msg":%(message)s}',
)
logger = logging.getLogger("collector")

_KNOWN_FIELDS = frozenset({
    "id", "ts", "tool", "status", "seller_ref", "agent_ref", "resource",
    "rail", "http_status", "amount_usd", "currency", "duration_ms", "metadata",
})
_MAX_STR_BYTES = 8 * 1024


def _truncate(v: Any) -> Any:
    """Cap large strings so the raw blob stays bounded."""
    if isinstance(v, str) and len(v.encode()) > _MAX_STR_BYTES:
        return v.encode()[:_MAX_STR_BYTES].decode(errors="ignore") + "...[truncated]"
    if isinstance(v, dict):
        return {k: _truncate(val) for k, val in v.items()}
    return v


def _fmt_decimal(val: Any) -> str:
    if val is None:
        return "0.00000000"
    return f"{Decimal(str(val)):.8f}"


class ChargeIn(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    ts: datetime
    tool: str
    status: str
    seller_ref: Optional[str] = None
    agent_ref: Optional[str] = None
    resource: Optional[str] = None
    rail: Optional[str] = None
    http_status: Optional[int] = None
    amount_usd: Optional[str] = None
    currency: Optional[str] = "USD"
    duration_ms: Optional[float] = None
    metadata: Optional[dict[str, Any]] = None


def _charge_dict(c: Charge) -> dict:
    """Serialize a Charge, remapping extra_metadata → metadata for the API."""
    d = c.model_dump()
    d["metadata"] = d.pop("extra_metadata", None)
    return d


def _build_charge(validated: ChargeIn, raw_payload: dict, account_id: str, now: datetime) -> Charge:
    extra = validated.model_extra or {}
    merged_meta = {**(validated.metadata or {}), **extra}
    return Charge(
        id=validated.id,
        account_id=account_id,
        ts=validated.ts,
        received_at=now,
        tool=validated.tool,
        status=validated.status,
        seller_ref=validated.seller_ref,
        agent_ref=validated.agent_ref,
        resource=validated.resource,
        rail=validated.rail,
        http_status=validated.http_status,
        amount_usd=validated.amount_usd,
        currency=validated.currency or "USD",
        duration_ms=validated.duration_ms,
        extra_metadata=merged_meta or None,
        raw=_truncate(raw_payload),
    )


def _seed_api_keys() -> None:
    raw = settings.COLLECTOR_API_KEYS.strip()
    if not raw:
        return
    with Session(engine) as session:
        for pair in raw.split(","):
            pair = pair.strip()
            if ":" not in pair:
                continue
            k, acct = pair.split(":", 1)
            if not session.get(ApiKey, k.strip()):
                session.add(ApiKey(key=k.strip(), account_id=acct.strip()))
        session.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    create_db()
    _seed_api_keys()
    yield


app = FastAPI(title="Charge Collector", version="0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS.split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.post("/v1/charges")
async def ingest(
    request: Request,
    account_id: str = Depends(get_account_id),
    session: Session = Depends(get_session),
):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Malformed JSON")

    raw_items: list[dict] = body if isinstance(body, list) else [body]
    now = datetime.now(timezone.utc)

    charges: list[Charge] = []
    for raw_item in raw_items:
        if not isinstance(raw_item, dict):
            raise HTTPException(status_code=400, detail="Each charge must be a JSON object")
        try:
            validated = ChargeIn.model_validate(raw_item)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        charges.append(_build_charge(validated, raw_item, account_id, now))

    incoming_ids = [c.id for c in charges]
    existing_ids: set[str] = set(
        session.exec(
            select(Charge.id).where(
                col(Charge.id).in_(incoming_ids),
                col(Charge.account_id) == account_id,
            )
        ).all()
    )

    for charge in charges:
        session.merge(charge)
    session.commit()

    dups = len(existing_ids & set(incoming_ids))
    logger.info(
        '"account=%s accepted=%d duplicates=%d"', account_id, len(charges) - dups, dups
    )
    return {"accepted": len(charges) - dups, "duplicates": dups}


@app.get("/v1/charges")
def list_charges(
    account_id: str = Depends(get_account_id),
    session: Session = Depends(get_session),
    agent_ref: Optional[str] = Query(default=None),
    seller_ref: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    tool: Optional[str] = Query(default=None),
    from_: Optional[datetime] = Query(default=None, alias="from"),
    to: Optional[datetime] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
    cursor: Optional[str] = Query(default=None),
):
    stmt = select(Charge).where(col(Charge.account_id) == account_id)

    if agent_ref is not None:
        stmt = stmt.where(col(Charge.agent_ref) == agent_ref)
    if seller_ref is not None:
        stmt = stmt.where(col(Charge.seller_ref) == seller_ref)
    if status is not None:
        stmt = stmt.where(col(Charge.status) == status)
    if tool is not None:
        stmt = stmt.where(col(Charge.tool) == tool)
    if from_ is not None:
        stmt = stmt.where(col(Charge.ts) >= from_)
    if to is not None:
        stmt = stmt.where(col(Charge.ts) <= to)

    if cursor is not None:
        try:
            decoded = base64.urlsafe_b64decode(cursor.encode()).decode()
            cursor_ts_str, cursor_id = decoded.rsplit("|", 1)
            cursor_ts = datetime.fromisoformat(cursor_ts_str)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid cursor")
        stmt = stmt.where(
            (col(Charge.ts) < cursor_ts)
            | ((col(Charge.ts) == cursor_ts) & (col(Charge.id) < cursor_id))
        )

    stmt = stmt.order_by(col(Charge.ts).desc(), col(Charge.id).desc()).limit(limit + 1)
    items = list(session.exec(stmt).all())

    next_cursor: Optional[str] = None
    if len(items) > limit:
        items = items[:limit]
        last = items[-1]
        raw_cursor = f"{last.ts.isoformat()}|{last.id}"
        next_cursor = base64.urlsafe_b64encode(raw_cursor.encode()).decode()

    return {"items": [_charge_dict(c) for c in items], "next_cursor": next_cursor}


@app.get("/v1/charges/summary")
def summary(
    account_id: str = Depends(get_account_id),
    session: Session = Depends(get_session),
    group_by: str = Query(..., pattern="^(seller_ref|agent_ref|status|tool|day)$"),
    from_: Optional[datetime] = Query(default=None, alias="from"),
    to: Optional[datetime] = Query(default=None),
    status: Optional[str] = Query(default=None),
):
    dialect = session.get_bind().dialect.name

    if group_by == "day":
        raw_key = (
            func.date_trunc("day", Charge.ts)
            if dialect == "postgresql"
            else func.date(Charge.ts)
        )
    else:
        raw_key = col(getattr(Charge, group_by))

    key_expr = raw_key.label("key_val")
    cnt_expr = func.count(Charge.id).label("cnt")
    # Cast string to numeric for exact decimal summation
    sum_expr = func.sum(cast(Charge.amount_usd, Numeric(20, 8))).label("total")

    stmt = (
        select(key_expr, cnt_expr, sum_expr)
        .where(col(Charge.account_id) == account_id)
        .group_by(raw_key)
        .order_by(sum_expr.desc().nulls_last())
    )

    if from_ is not None:
        stmt = stmt.where(col(Charge.ts) >= from_)
    if to is not None:
        stmt = stmt.where(col(Charge.ts) <= to)
    if status is not None:
        stmt = stmt.where(col(Charge.status) == status)

    rows = session.execute(stmt).all()

    return [
        {
            "key": str(row.key_val) if row.key_val is not None else None,
            "count": row.cnt,
            "amount_usd": _fmt_decimal(row.total),
        }
        for row in rows
    ]
