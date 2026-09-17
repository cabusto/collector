# Charge Collector

HTTP service that ingests per-call charge records from agent middleware, stores them, and exposes read + rollup endpoints for a dashboard.

## LangGraph demo middleware

This repo now includes a repo-local demo middleware under [middleware](middleware) that can emit LangGraph tool-call records to the collector. It is intentionally a demo surface for now, but the file layout separates record shaping, sinks, and LangGraph wrappers so it can be promoted into a proper reusable package later.

Install the optional demo dependencies with:

```bash
pip install -e '.[langgraph-demo]'
```

Then set these optional environment variables in your root `.env`:

```bash
LANGGRAPH_COLLECTOR_URL=http://localhost:8000
LANGGRAPH_COLLECTOR_API_KEY=mykey123
LANGGRAPH_AGENT_REF=coding_agent
LANGGRAPH_COLLECTOR_ONLY_PRICED=false
OPENROUTER_API_KEY=...
```

Run the example agent from the repo root:

```bash
python -m middleware.coding_agent
```

If the LangGraph collector variables are unset, the demo still runs but only writes to stdout, LangSmith, and `spend_log.jsonl`.

If you want to keep the file names already on your LangGraph box, copy [middleware/coding_agent.py](middleware/coding_agent.py) and [middleware/spend_tracker.py](middleware/spend_tracker.py). Those are the canonical standalone files for remote use.

Set `LANGGRAPH_COLLECTOR_ONLY_PRICED=false` if you want the collector and portal to capture successful free API calls and failed API calls even when they have no assigned price.

Important: use a writer key for the same collector `account_id` that the portal reads, or the collector will ingest rows that never show up in the dashboard.

### Remote LangGraph checklist

If you are copying files onto a remote LangGraph box, use this checklist:

1. Copy [middleware/coding_agent.py](middleware/coding_agent.py) to the remote project root as `coding_agent.py`.
2. Copy [middleware/spend_tracker.py](middleware/spend_tracker.py) to the remote project root as `spend_tracker.py`.
3. Install the required runtime packages on the box. At minimum, the deployed agent needs the LangGraph demo extras and whatever model provider package you are using.

```bash
pip install -e '.[langgraph-demo]'
```

4. Set the required model env vars for the agent itself, including `OPENROUTER_API_KEY` if you are using the demo as written.
5. Set the optional collector env vars if you want charge rows to land in this collector:

```bash
LANGGRAPH_COLLECTOR_URL=http://localhost:8000
LANGGRAPH_COLLECTOR_API_KEY=mykey123
LANGGRAPH_AGENT_REF=coding_agent
LANGGRAPH_COLLECTOR_ONLY_PRICED=false
```

6. Make sure the collector writer key belongs to the same collector `account_id` that the portal reads, or the portal will remain empty even though ingestion succeeds.
7. Configure your LangGraph graph spec to load `./coding_agent.py` with the exported `graph` variable.
8. Restart the LangGraph server.
9. If the server fails during import, verify the remote box has both copied files side by side and that the required env vars and packages are installed.

The standalone files are designed to work both in this repo and when copied directly to a remote box without package context.

### Local LangGraph client

If you already have a local LangGraph server exposing the `coding_agent` graph, this repo also includes a thin launcher script so you can talk to it from the repo root:

```bash
./agent-langgraph-demo --url 'https://...trycloudflare.com' 'say hello'
```

The launcher also accepts the full LangSmith Studio URL and will extract `baseUrl` and `assistantId` automatically. For repeat use, set these optional values in `.env`:

```bash
AGENT_LANGGRAPH_BASE_URL=https://...trycloudflare.com
AGENT_LANGGRAPH_ASSISTANT=coding_agent
```

Run `./agent-langgraph-demo --list-assistants` to confirm what the local server is serving without sending a model prompt.

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
source .venv/bin/activate
python -m pytest -v
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
