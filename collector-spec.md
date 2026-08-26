# Build spec: Charge Collector service (v0)

## Task

Build a small HTTP service ("the collector") that ingests **charge** records emitted by an agent-spend middleware (one record per agent tool/API call), stores them, and exposes read + rollup endpoints for a dashboard. This is v0: **capture and query only**. No pricing/rating, no payments, no UI.

Deliver a runnable service, tests, a Dockerfile, and a README.

## Context (enough to build against)

An upstream middleware fires one JSON `charge` per tool/API call to `POST /v1/charges` (fire-and-forget, may batch). The service must accept them fast, store them idempotently, and let a separate dashboard read and aggregate them. Treat the middleware as untrusted input: tolerate missing optional fields and preserve unknown ones.

## Tech

- Python 3.11+, **FastAPI** + **Uvicorn**.
- **SQLModel** (SQLAlchemy under the hood). **SQLite by default**, switchable to **Postgres** via `DATABASE_URL` with no code change.
- Config via environment variables; `.env` supported.
- Package/deps via `pyproject.toml`. Provide a `Dockerfile`.

## Data model: `Charge`

One row per charge. Store the indexed columns below **plus** the full original payload in `raw` (JSON). Any field the payload contains that isn't a column goes into `metadata` (JSON), nothing is dropped.

| Column | Type | Req | Notes |
|---|---|---|---|
| `id` | str, PK | yes | Idempotency key. Upsert on this. |
| `account_id` | str, indexed | yes | Derived from the API key, **not** trusted from the body. |
| `ts` | datetime (ISO 8601), indexed | yes | Client event time. |
| `received_at` | datetime | server | Server-stamped on ingest. |
| `tool` | str, indexed | yes | e.g. `call_api`, `run_python`. |
| `seller_ref` | str, indexed | no | API host, null for local tools. |
| `agent_ref` | str, indexed | no | Acting agent, when supplied. |
| `resource` | str | no | e.g. `POST /v1/enrich`. |
| `rail` | str | no | `x402` / `mpp` / null. |
| `status` | str, indexed | yes | `recorded` / `blocked` / `error` / etc. |
| `http_status` | int | no | Underlying API status when present. |
| `amount_usd` | str (decimal, 8dp) | no | **String, never float.** Null if unpriced. |
| `currency` | str | no | Default `USD`. |
| `duration_ms` | float | no | |
| `metadata` | JSON | no | Caller context + any unknown fields. |
| `raw` | JSON | server | The full original payload, verbatim. |

Money rule: `amount_usd` is a decimal string; sum it with decimal precision, never floating point.

## API

All endpoints require `Authorization: Bearer <key>`. Missing/invalid key → `401`. All reads and writes are scoped to the key's `account_id`; never return another account's data.

### `POST /v1/charges`
- Body: a single `Charge` object **or** a JSON array of them (batch).
- Required in body: `id`, `ts`, `tool`, `status`. All other fields optional. Unknown fields preserved in `metadata`/`raw`.
- Idempotent **upsert on `id`**: re-posting the same `id` replaces/no-ops, never errors or duplicates.
- Malformed JSON or missing required field → `400` with a clear message. Well-formed but unexpected extra fields → accept and store.
- Response: `{ "accepted": <n>, "duplicates": <n> }`.
- Must return quickly (client is fire-and-forget); do the minimum synchronously.

### `GET /v1/charges`
- Query filters: `agent_ref`, `seller_ref`, `status`, `tool`, `from` / `to` (on `ts`), `limit` (default 100, max 1000), `cursor`.
- Response: `{ "items": [<charge>...], "next_cursor": <str|null> }`, newest first.

### `GET /v1/charges/summary`
- Query: `group_by` = `seller_ref` | `agent_ref` | `status` | `tool` | `day`; `from`/`to`; optional `status` filter.
- Response: array of `{ "key": <str>, "count": <int>, "amount_usd": "<decimal>" }`, sorted by `amount_usd` desc. This powers the dashboard (spend by seller/agent, calls by status, spend over time).
- By default include all rows; when the caller wants spend only, they pass `status=recorded`. Do not silently exclude failed calls.

### `GET /healthz`
- Returns `{ "ok": true }`. No auth.

## Auth

- Bearer token. A key maps to exactly one `account_id`.
- v0 storage of keys: a simple table `api_keys(key, account_id, created_at)` seeded from an env var (`COLLECTOR_API_KEYS` = comma-separated `key:account_id` pairs) or a small admin insert. Keep it swappable.
- Derive `account_id` from the key on every request; ignore any `account_id` in the request body.

## Behavior & edge cases

- **Idempotency** on `id` (SQLite `INSERT OR REPLACE` / Postgres `ON CONFLICT (id) DO UPDATE`).
- **Account isolation:** queries always filter by the key's `account_id`.
- **Timestamps:** parse `ts` as ISO 8601; stamp `received_at` server-side.
- **Tolerant ingest:** never 5xx on a well-formed record with extra/unknown fields.
- **CORS:** allow configured dashboard origins (`ALLOWED_ORIGINS` env).
- **Large payloads:** `request`/`response` strings may be a few KB; cap stored size (e.g. 8 KB each) and note truncation.

## Non-functional

- Fast, non-blocking ingest; modest throughput target (hundreds of records/sec on SQLite dev, more on Postgres).
- Structured JSON logging.
- 12-factor config via env: `DATABASE_URL`, `COLLECTOR_API_KEYS`, `ALLOWED_ORIGINS`, `PORT`.
- Dockerfile + `README` with run instructions.

## Project layout

```
collector/
  app.py         # FastAPI app + routes
  models.py      # SQLModel Charge, ApiKey
  db.py          # engine/session, create tables
  auth.py        # bearer -> account_id
  config.py      # env settings
tests/
  test_ingest.py
  test_query.py
  test_summary.py
  test_auth.py
pyproject.toml
Dockerfile
README.md
.env.example
```

## Tests (must pass)

1. POST one charge → 200; `GET /v1/charges` returns it; fields round-trip.
2. POST the same `id` twice → exactly one row; `duplicates` reported.
3. POST a batch array → all stored, count correct.
4. POST with an unknown field → stored; the field appears in `metadata`.
5. Missing required field (`id`/`ts`/`tool`/`status`) → 400. Malformed JSON → 400. Missing/wrong key → 401.
6. `GET /v1/charges` filters by `seller_ref`, `agent_ref`, `status`, and `from`/`to`; pagination cursor works.
7. `GET /v1/charges/summary?group_by=seller_ref` returns correct counts and decimal-accurate `amount_usd` sums; `status=recorded` filter excludes failed calls.
8. Account isolation: key A cannot read or overwrite key B's charges.

## Definition of done

- All tests pass; `uvicorn collector.app:app` runs; `docker build` + run works.
- Switching `DATABASE_URL` from SQLite to a Postgres URL requires no code change.
- README shows: run locally, seed a key, POST a charge with curl, read it back, hit summary.

## Explicit non-goals (do NOT build in v0)

- No pricing/rating engine, `amount_usd` is supplied by the client.
- No payments, settlement, or money movement.
- No UI / dashboard (a separate app reads these endpoints).
- No conformance to any external "UsageEvent" / commerce-engine schema yet. **But** keep the ingest contract generic and stable so records can later be forwarded to, or replaced by, a canonical endpoint. Non-binding future mapping for reference only: `seller_ref → external_creditor_id`, `account_id → external_debtor_id`, `agent_ref → external_subject_id`, `tool → event_type`. Do not implement this now.

## Example ingest payload

```json
{
  "id": "chg_8f2a91",
  "ts": "2026-08-07T14:22:08Z",
  "tool": "call_api",
  "seller_ref": "api.open-meteo.com",
  "agent_ref": "research-bot",
  "resource": "GET /v1/forecast",
  "rail": "mpp",
  "status": "recorded",
  "http_status": 200,
  "amount_usd": "0.00100000",
  "currency": "USD",
  "duration_ms": 141.3,
  "metadata": { "run_id": "run_8c1f" }
}
```

## Example summary response

`GET /v1/charges/summary?group_by=seller_ref&status=recorded`
```json
[
  { "key": "api.open-meteo.com", "count": 812, "amount_usd": "0.81200000" },
  { "key": "clearbit.mpp.paywithlocus.com", "count": 143, "amount_usd": "2.86000000" }
]
```
