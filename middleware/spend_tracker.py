"""Demo LangGraph middleware that can ship tool-call records to the collector.

This file is intentionally self-contained so it can be copied to a LangGraph
instance as `spend_tracker.py` and imported without package context.
"""

from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any, Callable, Optional
from urllib.parse import urlparse

__all__ = [
	"PREFIX",
	"Sink",
	"SupertabMeter",
	"SupertabMeterCallback",
	"collector_sink",
	"collector_sink_from_env",
	"file_sink",
	"langsmith_sink",
	"multi_sink",
	"price_book",
	"print_sink",
]


PREFIX = "supertab_"

Sink = Callable[[dict[str, Any]], None]
PriceFn = Callable[[dict[str, Any]], Optional[str]]

_URL_RE = re.compile(r"https?://[^\s\"']+")
_STATUS_MAP = {
	"ok": "recorded",
	"error": "failed",
	"recorded": "recorded",
	"failed": "failed",
}


def print_sink(rec: dict[str, Any]) -> None:
	print(json.dumps(rec, default=str))


def file_sink(path: str = "spend_log.jsonl") -> Sink:
	"""Append each record as JSONL for local inspection."""

	def _sink(rec: dict[str, Any]) -> None:
		with open(path, "a", encoding="utf-8") as handle:
			handle.write(json.dumps(rec, default=str) + "\n")

	return _sink


def langsmith_sink(rec: dict[str, Any]) -> None:
	"""Attach the record to the current LangSmith run when available."""
	try:
		from langsmith import get_current_run_tree
	except ImportError:
		return

	run = get_current_run_tree()
	if run is None:
		return

	try:
		run.add_metadata(
			{
				f"{PREFIX}tool": rec.get("tool"),
				f"{PREFIX}seller": rec.get("seller_ref"),
				f"{PREFIX}status": rec.get("status"),
				f"{PREFIX}http_status": rec.get("http_status"),
				f"{PREFIX}duration_ms": rec.get("duration_ms"),
				f"{PREFIX}amount_usd": rec.get("amount_usd"),
			}
		)
	except Exception:
		pass

	try:
		if rec.get("amount_usd") is not None:
			run.set(usage_metadata={"total_cost": float(rec["amount_usd"])})
	except Exception:
		pass


def multi_sink(*sinks: Sink) -> Sink:
	"""Fan one record out to many sinks. Failures stay local to each sink."""

	def _sink(rec: dict[str, Any]) -> None:
		for sink in sinks:
			try:
				sink(rec)
			except Exception:
				pass

	return _sink


def price_book(prices: dict[str, str], default: Optional[str] = None) -> PriceFn:
	"""Build a price function keyed by seller_ref."""

	def _price(rec: dict[str, Any]) -> Optional[str]:
		if rec.get("status") != "ok" or not rec.get("seller_ref"):
			return None
		return prices.get(str(rec["seller_ref"]), default)

	return _price


def _seller_ref(args: Any) -> Optional[str]:
	if isinstance(args, dict):
		url = args.get("url")
		if not url:
			for value in args.values():
				if isinstance(value, str) and value.startswith(("http://", "https://")):
					url = value
					break
	elif isinstance(args, str):
		match = _URL_RE.search(args)
		url = match.group(0) if match else None
	else:
		url = None

	if not url:
		return None

	try:
		return urlparse(url).netloc or None
	except Exception:
		return None


def _truncate(value: Any, limit: int = 2000) -> str:
	serialized = value if isinstance(value, str) else json.dumps(value, default=str)
	if len(serialized) <= limit:
		return serialized
	return serialized[:limit] + f"... (+{len(serialized) - limit} chars)"


def _record(
	call_id: str,
	name: Optional[str],
	args: Any,
	started: float,
	*,
	response: Any = None,
	error: Exception | None = None,
	price_fn: Optional[PriceFn] = None,
) -> dict[str, Any]:
	rec: dict[str, Any] = {
		"id": str(call_id),
		"ts": datetime.now(timezone.utc).isoformat(),
		"tool": name or "unknown_tool",
		"seller_ref": _seller_ref(args),
		"request": _truncate(args),
		"duration_ms": round((time.perf_counter() - started) * 1000, 1),
	}
	if error is None:
		rec["status"] = "ok"
		rec["response"] = _truncate(getattr(response, "content", response))
	else:
		rec["status"] = "error"
		rec["error"] = str(error)

	if rec.get("seller_ref") and isinstance(rec.get("response"), str):
		match = re.match(r"\s*(\d{3})\s+[A-Za-z]", rec["response"])
		if match:
			rec["http_status"] = int(match.group(1))
			if rec["http_status"] >= 400:
				rec["status"] = "error"

	if price_fn is not None:
		try:
			amount = price_fn(rec)
			if amount is not None:
				rec["amount_usd"] = f"{float(amount):.8f}"
		except Exception:
			pass
	return rec


def _normalize_status(status: Optional[str]) -> str:
	if status is None:
		return "failed"
	return _STATUS_MAP.get(status, status)


def _collector_metadata(
	rec: dict[str, Any],
	default_metadata: Optional[dict[str, Any]],
	assistant_name: Optional[str],
) -> Optional[dict[str, Any]]:
	metadata = dict(default_metadata or {})
	if assistant_name and "assistant_name" not in metadata:
		metadata["assistant_name"] = assistant_name

	top_level = {
		"request",
		"response",
		"error",
		"agent_ref",
		"resource",
		"rail",
		"currency",
	}
	for key in top_level:
		if rec.get(key) is not None and key not in metadata:
			metadata[key] = rec[key]

	extra_keys = set(rec) - {
		"id",
		"ts",
		"tool",
		"status",
		"seller_ref",
		"agent_ref",
		"resource",
		"rail",
		"http_status",
		"amount_usd",
		"currency",
		"duration_ms",
	}
	for key in extra_keys:
		if rec.get(key) is not None and key not in metadata:
			metadata[key] = rec[key]

	return metadata or None


def _collector_payload(
	rec: dict[str, Any],
	*,
	agent_ref: Optional[str],
	assistant_name: Optional[str],
	default_metadata: Optional[dict[str, Any]],
) -> dict[str, Any]:
	payload: dict[str, Any] = {
		"id": str(rec["id"]),
		"ts": rec.get("ts") or datetime.now(timezone.utc).isoformat(),
		"tool": rec.get("tool") or "unknown_tool",
		"status": _normalize_status(rec.get("status")),
		"seller_ref": rec.get("seller_ref"),
		"agent_ref": agent_ref or rec.get("agent_ref") or assistant_name,
		"resource": rec.get("resource"),
		"rail": rec.get("rail"),
		"http_status": rec.get("http_status"),
		"amount_usd": rec.get("amount_usd"),
		"currency": rec.get("currency") or ("USD" if rec.get("amount_usd") else None),
		"duration_ms": rec.get("duration_ms"),
		"metadata": _collector_metadata(rec, default_metadata, assistant_name),
	}
	return {key: value for key, value in payload.items() if value is not None}


def collector_sink(
	base_url: str,
	api_key: str,
	*,
	agent_ref: Optional[str] = None,
	assistant_name: Optional[str] = None,
	only_priced: bool = False,
	default_metadata: Optional[dict[str, Any]] = None,
	timeout_s: float = 5.0,
) -> Sink:
	"""Build a sink that posts each record to the collector charge endpoint."""

	endpoint = base_url.rstrip("/") + "/v1/charges"

	def _sink(rec: dict[str, Any]) -> None:
		if only_priced and not (rec.get("seller_ref") or rec.get("amount_usd")):
			return

		payload = _collector_payload(
			rec,
			agent_ref=agent_ref,
			assistant_name=assistant_name,
			default_metadata=default_metadata,
		)
		request = urllib.request.Request(
			endpoint,
			data=json.dumps(payload).encode("utf-8"),
			headers={
				"Authorization": f"Bearer {api_key}",
				"Content-Type": "application/json",
			},
			method="POST",
		)
		try:
			with urllib.request.urlopen(request, timeout=timeout_s) as response:
				response.read()
		except urllib.error.HTTPError as exc:
			detail = exc.read().decode("utf-8", "replace")[:1000]
			raise RuntimeError(
				f"collector rejected event {payload['id']}: {exc.code} {detail}"
			) from exc

	return _sink


def collector_sink_from_env(
	*,
	agent_ref: Optional[str] = None,
	assistant_name: Optional[str] = None,
	only_priced: Optional[bool] = None,
	default_metadata: Optional[dict[str, Any]] = None,
	timeout_s: float = 5.0,
) -> Sink:
	"""Build a collector sink from environment variables."""

	base_url = os.environ["LANGGRAPH_COLLECTOR_URL"]
	api_key = os.environ["LANGGRAPH_COLLECTOR_API_KEY"]
	resolved_only_priced = only_priced
	if resolved_only_priced is None:
		raw_flag = os.environ.get("LANGGRAPH_COLLECTOR_ONLY_PRICED", "false")
		resolved_only_priced = raw_flag.lower() in {"1", "true", "yes", "on"}

	return collector_sink(
		base_url=base_url,
		api_key=api_key,
		agent_ref=agent_ref or os.environ.get("LANGGRAPH_AGENT_REF"),
		assistant_name=assistant_name or os.environ.get("LANGGRAPH_ASSISTANT_NAME"),
		only_priced=resolved_only_priced,
		default_metadata=default_metadata,
		timeout_s=timeout_s,
	)


try:
	from langchain.agents.middleware import AgentMiddleware
	from langchain.tools.tool_node import ToolCallRequest

	class SupertabMeter(AgentMiddleware):
		"""Logs a charge-shaped record for every tool call."""

		def __init__(self, sink: Sink = print_sink, price_fn: Optional[PriceFn] = None):
			super().__init__()
			self.sink = sink
			self.price_fn = price_fn

		def wrap_tool_call(self, request: "ToolCallRequest", handler):
			call = request.tool_call
			started = time.perf_counter()
			try:
				response = handler(request)
				self.sink(
					_record(
						str(call["id"]),
						call.get("name"),
						call.get("args"),
						started,
						response=response,
						price_fn=self.price_fn,
					)
				)
				return response
			except Exception as exc:
				self.sink(
					_record(
						str(call["id"]),
						call.get("name"),
						call.get("args"),
						started,
						error=exc,
						price_fn=self.price_fn,
					)
				)
				raise

		async def awrap_tool_call(self, request: "ToolCallRequest", handler):
			call = request.tool_call
			started = time.perf_counter()
			try:
				response = await handler(request)
				self.sink(
					_record(
						str(call["id"]),
						call.get("name"),
						call.get("args"),
						started,
						response=response,
						price_fn=self.price_fn,
					)
				)
				return response
			except Exception as exc:
				self.sink(
					_record(
						str(call["id"]),
						call.get("name"),
						call.get("args"),
						started,
						error=exc,
						price_fn=self.price_fn,
					)
				)
				raise

except ImportError:
	SupertabMeter = None  # type: ignore[assignment]
	ToolCallRequest = Any  # type: ignore[assignment]


try:
	from langchain_core.callbacks import BaseCallbackHandler

except ImportError:

	class BaseCallbackHandler:  # type: ignore[no-redef]
		pass


class SupertabMeterCallback(BaseCallbackHandler):
	"""Callback version of the same tracker for non-create_agent graphs."""

	def __init__(self, sink: Sink = print_sink, price_fn: Optional[PriceFn] = None):
		self.sink = sink
		self.price_fn = price_fn
		self._open: dict[Any, tuple[float, Optional[str], Any]] = {}

	def on_tool_start(self, serialized, input_str, *, run_id, **kwargs):
		self._open[run_id] = (
			time.perf_counter(),
			(serialized or {}).get("name"),
			input_str,
		)

	def on_tool_end(self, output, *, run_id, **kwargs):
		started, name, args = self._open.pop(
			run_id,
			(time.perf_counter(), None, None),
		)
		self.sink(
			_record(
				str(run_id),
				name,
				args,
				started,
				response=output,
				price_fn=self.price_fn,
			)
		)

	def on_tool_error(self, error, *, run_id, **kwargs):
		started, name, args = self._open.pop(
			run_id,
			(time.perf_counter(), None, None),
		)
		self.sink(
			_record(
				str(run_id),
				name,
				args,
				started,
				error=error,
				price_fn=self.price_fn,
			)
		)