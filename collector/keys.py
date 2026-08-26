from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from .config import settings
from .db import get_session
from .models import ApiKey


def require_admin(authorization: Optional[str] = Header(default=None)) -> None:
    if not settings.COLLECTOR_ADMIN_TOKEN:
        raise HTTPException(status_code=503, detail="Admin token not configured")
    if authorization != f"Bearer {settings.COLLECTOR_ADMIN_TOKEN}":
        raise HTTPException(status_code=401, detail="Admin token required")


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


router = APIRouter(prefix="/v1/api-keys", tags=["keys"])


class CreateKeyBody(BaseModel):
    name: str = ""
    account_id: str = "default"


@router.post("")
def create_key(
    body: CreateKeyBody,
    _: None = Depends(require_admin),
    session: Session = Depends(get_session),
):
    raw = "stk_" + secrets.token_urlsafe(32)
    rec = ApiKey(
        id="key_" + secrets.token_hex(8),
        account_id=body.account_id,
        name=body.name,
        prefix=raw[:12],
        key_hash=_hash(raw),
    )
    session.add(rec)
    session.commit()
    session.refresh(rec)
    # full key returned once — not stored anywhere
    return {
        "id": rec.id,
        "key": raw,
        "name": rec.name,
        "account_id": rec.account_id,
        "created_at": rec.created_at,
    }


@router.get("")
def list_keys(
    _: None = Depends(require_admin),
    session: Session = Depends(get_session),
):
    rows = session.exec(
        select(ApiKey).where(ApiKey.revoked_at == None)  # noqa: E711
    ).all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "prefix": r.prefix,
            "created_at": r.created_at,
            "last_used_at": r.last_used_at,
        }
        for r in rows
    ]


@router.delete("/{key_id}")
def revoke_key(
    key_id: str,
    _: None = Depends(require_admin),
    session: Session = Depends(get_session),
):
    r = session.get(ApiKey, key_id)
    if not r:
        raise HTTPException(status_code=404, detail="Key not found")
    r.revoked_at = datetime.now(timezone.utc)
    session.add(r)
    session.commit()
    return {"revoked": key_id}
