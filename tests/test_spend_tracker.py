import threading

from middleware.spend_tracker import _record, collector_sink, multi_sink, price_book


class _FakeResponse:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self):
        return b"ok"


def test_record_marks_success_without_price_as_free_candidate():
    rec = _record(
        "tool-success-free",
        "call_api",
        {"url": "https://free.example.com/ping"},
        0.0,
        response="200 OK\n{}",
        price_fn=price_book({"api.open-meteo.com": "0.00100000"}),
    )

    assert rec["status"] == "ok"
    assert rec["seller_ref"] == "free.example.com"
    assert "amount_usd" not in rec


def test_record_marks_http_error_as_failed_without_price():
    rec = _record(
        "tool-failed",
        "call_api",
        {"url": "https://free.example.com/ping"},
        0.0,
        response="503 Service Unavailable\n{}",
        price_fn=price_book({"free.example.com": "0.00500000"}),
    )

    assert rec["status"] == "error"
    assert rec["http_status"] == 503
    assert "amount_usd" not in rec


def test_collector_sink_posts_unpriced_records_when_only_priced_is_false(monkeypatch):
    captured = {}

    class ImmediateThread:
        def __init__(self, *, target, args=(), daemon=None):
            self._target = target
            self._args = args
            self.daemon = daemon

        def start(self):
            self._target(*self._args)

    def fake_urlopen(request, timeout):
        captured["timeout"] = timeout
        captured["url"] = request.full_url
        captured["headers"] = dict(request.header_items())
        captured["body"] = request.data.decode("utf-8")
        return _FakeResponse()

    monkeypatch.setattr(threading, "Thread", ImmediateThread)
    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    sink = collector_sink(
        base_url="https://collector.example.com",
        api_key="secret",
        only_priced=False,
        agent_ref="coding_agent",
    )
    sink(
        {
            "id": "free-call",
            "ts": "2026-09-16T12:00:00+00:00",
            "tool": "call_api",
            "status": "ok",
            "seller_ref": None,
            "duration_ms": 45.2,
        }
    )

    assert captured["url"] == "https://collector.example.com/v1/charges"
    assert captured["timeout"] == 5.0
    assert '"status": "recorded"' in captured["body"]
    assert '"id": "free-call"' in captured["body"]


def test_collector_sink_skips_sellerless_unpriced_records_when_only_priced_is_true(monkeypatch):
    called = False

    class ImmediateThread:
        def __init__(self, *, target, args=(), daemon=None):
            self._target = target
            self._args = args
            self.daemon = daemon

        def start(self):
            self._target(*self._args)

    def fake_urlopen(request, timeout):
        nonlocal called
        called = True
        return _FakeResponse()

    monkeypatch.setattr(threading, "Thread", ImmediateThread)
    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    sink = collector_sink(
        base_url="https://collector.example.com",
        api_key="secret",
        only_priced=True,
    )
    sink(
        {
            "id": "dropped-call",
            "ts": "2026-09-16T12:00:00+00:00",
            "tool": "call_api",
            "status": "ok",
        }
    )

    assert called is False


def test_collector_sink_dispatches_post_on_background_thread(monkeypatch):
    started = {}

    class RecordingThread:
        def __init__(self, *, target, args=(), daemon=None):
            started["target"] = target
            started["args"] = args
            started["daemon"] = daemon
            started["started"] = False

        def start(self):
            started["started"] = True

    monkeypatch.setattr(threading, "Thread", RecordingThread)

    sink = collector_sink(
        base_url="https://collector.example.com",
        api_key="secret",
        only_priced=False,
        agent_ref="coding_agent",
    )
    sink(
        {
            "id": "threaded-call",
            "ts": "2026-09-16T12:00:00+00:00",
            "tool": "call_api",
            "status": "ok",
            "seller_ref": "api.open-meteo.com",
            "amount_usd": "0.00100000",
        }
    )

    assert started["started"] is True
    assert started["daemon"] is True
    assert started["args"][0]["id"] == "threaded-call"


def test_multi_sink_logs_failures_and_continues(capfd):
    seen = []

    def broken_sink(rec):
        raise RuntimeError("collector rejected event")

    def healthy_sink(rec):
        seen.append(rec["id"])

    sink = multi_sink(broken_sink, healthy_sink)
    sink({"id": "rec-123", "tool": "call_api"})

    captured = capfd.readouterr()
    assert seen == ["rec-123"]
    assert "broken_sink failed for record rec-123" in captured.err
    assert "collector rejected event" in captured.err