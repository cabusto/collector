from __future__ import annotations

import hashlib
import os
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session, select

from .db import get_session
from .models import ApiKey


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class _StrictBearer(HTTPBearer):
    """Returns 401 (not 403) when the Authorization header is absent."""

    async def __call__(self, request: Request) -> HTTPAuthorizationCredentials:
        try:
            return await super().__call__(request)
        except HTTPException:
            raise HTTPException(status_code=401, detail="Missing authorization header")


_bearer = _StrictBearer()


def resolve_account(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
    session: Session = Depends(get_session),
) -> str:
    token = creds.credentials

    # Env-seeded plaintext keys take priority (backward compat for existing middleware)
    for pair in filter(None, os.environ.get("COLLECTOR_API_KEYS", "").split(",")):
        k, _, acct = pair.partition(":")
        if k == token:
            return acct

    # Hash lookup against DB-minted keys; stamp last_used_at on hit
    row = session.exec(
        select(ApiKey).where(
            ApiKey.key_hash == _hash(token),
            ApiKey.revoked_at == None,  # noqa: E711
        )
    ).first()
    if row:
        row.last_used_at = datetime.now(timezone.utc)
        session.add(row)
        session.commit()
        return row.account_id

    raise HTTPException(status_code=401, detail="Invalid API key")
