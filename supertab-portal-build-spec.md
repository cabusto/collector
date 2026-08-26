# Build spec: Charges Portal + API-key management

Two deliverables that ship together:

- **Part A** — add key-management endpoints to the existing Charge Collector (so keys can be minted).
- **Part B** — build a minimal portal that generates keys and lists charges with filtering, plus a few charts.

Target the live collector at `https://collector-dun.vercel.app`. Charges are read-only in the portal; key management is the only write. Deploy on Vercel. Build Part A first (the portal's key feature depends on it).

---

# Part A — Collector addition: `/v1/api-keys`

## Goal

Add endpoints so the portal can mint the **ingest keys** the middleware uses. Match the existing FastAPI + HTTP-bearer setup. Adapt the reference code to your actual ORM/db, the contract and security rules are what matter.

## Security rules (non-negotiable)

- Store only a **hash** of the key (SHA-256) plus a short display `prefix`. Never store or log plaintext.
- Return the full key **once**, at creation. List/GET returns prefix + metadata only.
- Guard these endpoints with a **separate admin token** (`COLLECTOR_ADMIN_TOKEN`), not an ingest key.
- Every minted key maps to an `account_id`; charge reads/writes stay scoped to that account.

## Endpoints

- `POST /v1/api-keys` body `{ "name": str, "account_id": str = "default" }` → `{ id, key, name, account_id, created_at }` (`key` shown once).
- `GET /v1/api-keys` → `[ { id, name, prefix, created_at, last_used_at } ]`.
- `DELETE /v1/api-keys/{id}` → `{ revoked: id }`.

## Data model

`api_keys(id PK, account_id idx, name, prefix, key_hash idx, created_at, last_used_at, revoked_at)`.

## Reference implementation (SQLModel + FastAPI; adapt to your app)

```python
# keys.py
import hashlib, secrets, os, datetime as dt
from fastapi import APIRouter, Header, HTTPException, Depends
from pydantic import BaseModel
from sqlmodel import SQLModel, Field, Session, select
from .db import engine  # reuse your existing engine

ADMIN_TOKEN = os.environ["COLLECTOR_ADMIN_TOKEN"]

def _hash(k: str) -> str:
    return hashlib.sha256(k.encode()).hexdigest()

class ApiKey(SQLModel, table=True):
    __tablename__ = "api_keys"
    id: str = Field(primary_key=True)
    account_id: str = Field(index=True)
    name: str = ""
    prefix: str = ""
    key_hash: str = Field(index=True)
    created_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.timezone.utc))
    last_used_at: dt.datetime | None = None
    revoked_at: dt.datetime | None = None

def require_admin(authorization: str = Header(None)):
    if authorization != f"Bearer {ADMIN_TOKEN}":
        raise HTTPException(401, "admin token required")

router = APIRouter(prefix="/v1/api-keys", tags=["keys"])

class CreateKey(BaseModel):
    name: str = ""
    account_id: str = "default"

@router.post("")
def create_key(body: CreateKey, _=Depends(require_admin)):
    raw = "stk_" + secrets.token_urlsafe(32)
    rec = ApiKey(id="key_" + secrets.token_hex(8), account_id=body.account_id,
                 name=body.name, prefix=raw[:12], key_hash=_hash(raw))
    with Session(engine) as s:
        s.add(rec); s.commit(); s.refresh(rec)
    return {"id": rec.id, "key": raw, "name": rec.name,
            "account_id": rec.account_id, "created_at": rec.created_at}

@router.get("")
def list_keys(_=Depends(require_admin)):
    with Session(engine) as s:
        rows = s.exec(select(ApiKey).where(ApiKey.revoked_at == None)).all()
    return [{"id": r.id, "name": r.name, "prefix": r.prefix,
             "created_at": r.created_at, "last_used_at": r.last_used_at} for r in rows]

@router.delete("/{key_id}")
def revoke_key(key_id: str, _=Depends(require_admin)):
    with Session(engine) as s:
        r = s.get(ApiKey, key_id)
        if not r:
            raise HTTPException(404, "not found")
        r.revoked_at = dt.datetime.now(dt.timezone.utc)
        s.add(r); s.commit()
    return {"revoked": key_id}
```

Register with `app.include_router(router)` and ensure the table is created.

## Wire minted keys into the existing charge auth

`POST/GET /v1/charges` must accept newly minted keys. Resolve the token by hash, fall back to env-seeded keys, return `account_id`:

```python
def resolve_account(authorization: str = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "missing bearer")
    token = authorization.split(" ", 1)[1]
    for pair in filter(None, os.environ.get("COLLECTOR_API_KEYS", "").split(",")):
        k, _, acct = pair.partition(":")
        if k == token:
            return acct
    with Session(engine) as s:
        r = s.exec(select(ApiKey).where(ApiKey.key_hash == _hash(token),
                                        ApiKey.revoked_at == None)).first()
        if r:
            r.last_used_at = dt.datetime.now(dt.timezone.utc); s.add(r); s.commit()
            return r.account_id
    raise HTTPException(401, "invalid key")
```

Use `account_id = Depends(resolve_account)` in the charge routes and scope queries to it.

## ⚠ Vercel persistence

SQLite does **not** persist on Vercel (ephemeral serverless filesystem). `api_keys` must live in the same **persistent** database as charges (Postgres via Supabase/Neon). If charges already persist in production, point this at that same DB.

## Part A tests / DoD

- `POST` with the admin token → returns a full key once; that key immediately works for `POST/GET /v1/charges`, scoped to its `account_id`.
- `GET` lists keys **without** the secret; `DELETE` revokes; a revoked key → 401 on use.
- Non-admin token on `/v1/api-keys` → 401.
- DB rows store `key_hash`, never plaintext.

---

# Part B — Portal MVP

## Target API

Base URL: `https://collector-dun.vercel.app`. Auth: **HTTP Bearer**. Endpoints:

- `GET /healthz` → `{ ok }`. No auth.
- `GET /v1/charges` — list. Params: `agent_ref`, `seller_ref`, `status`, `tool`, `from`, `to` (date-time), `limit` (1–1000, default 100), `cursor`. Bearer.
- `GET /v1/charges/summary` — params: `group_by` (**required**: `seller_ref|agent_ref|status|tool|day`), `from`, `to`, `status`. Bearer.
- `POST/GET/DELETE /v1/api-keys` — from Part A.

Response schemas aren't declared in the openapi, confirm by calling live once. Expected:
- `GET /v1/charges` → `{ "items": Charge[], "next_cursor": string|null }`
- `Charge` → `{ id, ts, tool, seller_ref, agent_ref, resource, rail, status, http_status, amount_usd (string), currency, duration_ms, metadata }`
- `GET /v1/charges/summary` → `[ { "key": string, "count": number, "amount_usd": string } ]`

## Tech

- **Next.js (App Router) + TypeScript**, on **Vercel**.
- UI: **MUI** — `@mui/material`, `@mui/x-data-grid` (table), `@mui/x-charts` (graphs). Alternative: shadcn/ui + TanStack Table + Recharts.
- React Query (or SWR).
- **All collector calls go through Next.js Route Handlers** (`/api/*`) server-side; the bearer token never reaches the browser.

## Auth / login

Two separate things: how the portal authenticates to the *collector* (a server-side token, see Config) and how a *person* logs into the *portal*.

- **MVP (now): gate the deployment, no login code.** Turn on **Vercel Authentication** (only your Vercel team can view) or add basic-auth/password middleware. Everyone who gets in sees the single configured account. Right for an internal demo.
- **Real login (when needed): a drop-in provider.** Clerk, Auth0, WorkOS, or Auth.js (NextAuth) / Supabase Auth, email + Google/SSO, gate the app routes.
- **Enterprise (later): SSO + RBAC.** SAML/OIDC + viewer/admin roles, rides with the paid audit/govern tier.
- **Person → account mapping:** login identifies the person; the portal must resolve person → account and scope every collector call to that account. MVP = one account, one token (trivial). Multi-tenant = map the logged-in user to an account and call the collector with that account's key. The collector already scopes by `account_id` per key. Keep token/account resolution in one server-side module so swapping in a provider later is a small change.

## Config / env

- `COLLECTOR_URL` = `https://collector-dun.vercel.app`
- `COLLECTOR_ADMIN_TOKEN` = admin token for `/api/keys` route handlers (mint/list/revoke).
- `COLLECTOR_TOKEN` = a token that can read charges (for single-account MVP, the admin token can double for reads; otherwise a dedicated account key).
- All server-side only.

## Architecture

Browser → Next.js Route Handlers (`/api/charges`, `/api/summary`, `/api/keys`) → collector, adding `Authorization: Bearer …`. No secret in the client bundle.

## Pages

### Charges (default route)

- **Filter bar:** `agent_ref` (text), `seller_ref` (text), `status` (select), `tool` (text), `from` + `to` (date pickers) → `GET /v1/charges`.
- **Table (DataGrid):** `ts`, `agent_ref`, `seller_ref`, `tool`, `status`, `http_status`, `amount_usd`, `duration_ms`, `id`. Sortable; row click opens a drawer with the full raw charge JSON.
- **Pagination:** cursor-based via `cursor` / `next_cursor` ("Load more" is fine).
- **Charts (from `/summary`, respect the date range):** spend by seller (bar, `group_by=seller_ref&status=recorded`), calls by status (pie/bar, `group_by=status`, count), spend over time (line, `group_by=day&status=recorded`).
- Refresh; loading / empty / error states.

### API Keys

- "Generate key" → name input → `POST /v1/api-keys` → show the full key **once** in a copy box with a "won't be shown again" warning.
- Table of keys (`name`, `prefix`, `created_at`, `last_used_at`) with revoke (DELETE).

## Money handling

`amount_usd` is a decimal **string**. Display as USD. Prefer the server `/summary` for totals; never sum with native float.

## Part B tests / DoD

- Charges page loads live charges; each filter narrows results; "Load more" pages via cursor; row shows raw JSON.
- Three charts render from `/summary` and update with the date range.
- Keys page creates a key (shown once), lists keys, revoke works.
- The bearer token never appears in any browser network request.
- Deploys to Vercel behind Vercel Authentication; `README` documents env vars.
- Empty / loading / error states handled.

## Non-goals (MVP)

No budgets/policy editing, no payments, no CSV export. Read charges + manage keys, gated by a deployment-level login.
