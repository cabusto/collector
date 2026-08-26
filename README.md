# Charge Collector

HTTP service that ingests per-call charge records from agent middleware, stores them, and exposes read + rollup endpoints for a dashboard.

## Local dev

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env   # edit as needed
uvicorn collector.app:app --reload
```

Default database is SQLite (`dev.db`). Switch to Postgres by setting `DATABASE_URL` — no code changes required.

## Seed an API key

Add a `key:account_id` pair to `COLLECTOR_API_KEYS` in `.env`:

```
COLLECTOR_API_KEYS=mykey123:acct_abc
```

Restart the server — keys are upserted into the `api_keys` table on startup.

## Try it

**POST a charge:**
```bash
curl -X POST http://localhost:8000/v1/charges \
  -H "Authorization: Bearer mykey123" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "chg_001",
    "ts": "2026-08-26T10:00:00Z",
    "tool": "call_api",
    "seller_ref": "api.open-meteo.com",
    "agent_ref": "research-bot",
    "status": "recorded",
    "amount_usd": "0.00100000"
  }'
```

**Read it back:**
```bash
curl "http://localhost:8000/v1/charges" \
  -H "Authorization: Bearer mykey123"
```

**Spend summary by seller:**
```bash
curl "http://localhost:8000/v1/charges/summary?group_by=seller_ref&status=recorded" \
  -H "Authorization: Bearer mykey123"
```

## Tests

```bash
pytest -v
```

## Deploy to Vercel + Neon

1. Create a [Neon](https://neon.tech) project and copy the **pooled** connection string.
2. Set environment variables in Vercel:
   - `DATABASE_URL` — the Neon pooled URL (`...pooler...neon.tech/...?sslmode=require`)
   - `COLLECTOR_API_KEYS` — `key1:acct1,key2:acct2`
   - `ALLOWED_ORIGINS` — your dashboard origin(s)
3. `vercel deploy`

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./dev.db` | SQLite locally; Neon pooled URL in prod |
| `COLLECTOR_API_KEYS` | — | Comma-separated `key:account_id` pairs |
| `ALLOWED_ORIGINS` | `*` | CORS origins for the dashboard |
| `PORT` | `8000` | Local uvicorn port |
