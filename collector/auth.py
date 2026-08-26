from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session, select

from .db import get_session
from .models import ApiKey


class _StrictBearer(HTTPBearer):
    """Returns 401 (not 403) when the Authorization header is absent."""

    async def __call__(self, request: Request) -> HTTPAuthorizationCredentials:
        try:
            return await super().__call__(request)
        except HTTPException:
            raise HTTPException(status_code=401, detail="Missing authorization header")


_bearer = _StrictBearer()


def get_account_id(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
    session: Session = Depends(get_session),
) -> str:
    api_key = session.exec(
        select(ApiKey).where(ApiKey.key == creds.credentials)
    ).first()
    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return api_key.account_id
