"""Demo agent showing how to use the repo-local LangGraph middleware.

This file is intentionally self-contained so it can be copied to a LangGraph
instance as `coding_agent.py` and loaded directly by graph specs.
"""

import json
import os
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Optional, TypedDict

try:
    from dotenv import load_dotenv
except ImportError:

    def load_dotenv() -> bool:
        return False

try:
    from .spend_tracker import (
        SupertabMeter,
        collector_sink,
        file_sink,
        langsmith_sink,
        multi_sink,
        price_book,
        print_sink,
    )
except ImportError:
    from spend_tracker import (  # type: ignore[no-redef]
        SupertabMeter,
        collector_sink,
        file_sink,
        langsmith_sink,
        multi_sink,
        price_book,
        print_sink,
    )

load_dotenv()

try:
    from langchain_core.tools import tool
except ImportError:

    def tool(func=None, **kwargs):
        if func is None:
            return lambda inner: inner
        return func


@tool
def run_python(code: str) -> str:
    """Execute a snippet of Python code and return stdout or stderr."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as handle:
        handle.write(code)
        path = Path(handle.name)
    try:
        result = subprocess.run(
            ["python3", str(path)],
            capture_output=True,
            text=True,
            timeout=10,
        )
        output = result.stdout
        if result.stderr:
            output += f"\n--- stderr ---\n{result.stderr}"
        return output.strip() or "(no output)"
    except subprocess.TimeoutExpired:
        return "Error: code timed out after 10 seconds"
    finally:
        path.unlink(missing_ok=True)


@tool
def call_api(
    url: str,
    method: str = "GET",
    params: Optional[dict] = None,
    headers: Optional[dict] = None,
    json_body: Optional[dict] = None,
) -> str:
    """Call an external HTTP API and return the response."""
    if params:
        url = url + ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
    body = None
    request_headers = dict(headers or {})
    if json_body is not None:
        body = json.dumps(json_body).encode()
        request_headers.setdefault("Content-Type", "application/json")
    request = urllib.request.Request(
        url,
        data=body,
        method=method.upper(),
        headers=request_headers,
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return (
                f"{response.status} {response.reason}\n"
                f"{response.read().decode('utf-8', 'replace')[:4000]}"
            )
    except urllib.error.HTTPError as exc:
        return f"{exc.code} {exc.reason}\n{exc.read().decode('utf-8', 'replace')[:4000]}"
    except Exception as exc:
        return f"Error calling {url}: {exc}"


def build_demo_graph():
    if SupertabMeter is None:
        raise RuntimeError(
            "LangChain middleware APIs are unavailable. Install the demo extras first."
        )

    try:
        from langchain.agents import create_agent
        from langchain_openai import ChatOpenAI
    except ImportError as exc:
        raise RuntimeError(
            "LangGraph demo dependencies are unavailable. Install the langgraph-demo extras first."
        ) from exc

    model = ChatOpenAI(
        model=os.environ.get("OPENROUTER_MODEL", "anthropic/claude-sonnet-5"),
        base_url=os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
        api_key=os.environ["OPENROUTER_API_KEY"],
    )

    prices = price_book(
        {
            "api.open-meteo.com": "0.00100000",
        }
    )

    sinks = [
        print_sink,
        langsmith_sink,
        file_sink("spend_log.jsonl"),
    ]
    collector_url = os.environ.get("LANGGRAPH_COLLECTOR_URL")
    collector_api_key = os.environ.get("LANGGRAPH_COLLECTOR_API_KEY")
    if collector_url and collector_api_key:
        sinks.append(
            collector_sink(
                base_url=collector_url,
                api_key=collector_api_key,
                agent_ref=os.environ.get("LANGGRAPH_AGENT_REF", "coding_agent"),
                assistant_name=os.environ.get(
                    "LANGGRAPH_ASSISTANT_NAME", "coding_agent"
                ),
                only_priced=os.environ.get(
                    "LANGGRAPH_COLLECTOR_ONLY_PRICED", "false"
                ).lower()
                in {"1", "true", "yes", "on"},
            )
        )

    sink = multi_sink(*sinks)

    return create_agent(
        model,
        tools=[run_python, call_api],
        system_prompt=(
            "You are a careful coding assistant. When given a task, write "
            "Python code, run it with the run_python tool to confirm it works, "
            "and only give your final answer after you've verified the output. "
            "Use the call_api tool when a task needs live data from a web API."
        ),
        middleware=[SupertabMeter(sink=sink, price_fn=prices)],
    )


class FallbackState(TypedDict, total=False):
    messages: list[Any]
    error: str


class UnavailableGraph:
    def __init__(self, reason: str):
        self.reason = reason

    def invoke(self, *_args, **_kwargs):
        raise RuntimeError(self.reason)

    def stream(self, *_args, **_kwargs):
        raise RuntimeError(self.reason)


def _build_unavailable_graph(reason: str):
    from langgraph.graph import END, START, StateGraph

    def explain_unavailable(state: FallbackState) -> FallbackState:
        messages = state.get("messages")
        next_state: FallbackState = {**state, "error": reason}
        if isinstance(messages, list):
            next_state["messages"] = [*messages, ("assistant", reason)]
        return next_state

    builder = StateGraph(FallbackState)
    builder.add_node("configuration_error", explain_unavailable)
    builder.add_edge(START, "configuration_error")
    builder.add_edge("configuration_error", END)
    return builder.compile()


def _graph_load_error_reason() -> Optional[str]:
    if SupertabMeter is None:
        return (
            "LangChain middleware APIs are unavailable. Install the demo extras first."
        )
    if not os.environ.get("OPENROUTER_API_KEY"):
        return "OPENROUTER_API_KEY is required to run the coding agent demo graph."
    try:
        from langchain.agents import create_agent as _create_agent  # noqa: F401
        from langchain_openai import ChatOpenAI as _chat_openai  # noqa: F401
    except ImportError:
        return (
            "LangGraph demo dependencies are unavailable. Install the "
            "langgraph-demo extras first."
        )
    return None


def load_graph():
    reason = _graph_load_error_reason()
    if reason is None:
        return build_demo_graph()
    try:
        return _build_unavailable_graph(reason)
    except ModuleNotFoundError as exc:
        if exc.name != "langgraph":
            raise
        return UnavailableGraph(reason)


graph = load_graph


if __name__ == "__main__":
    run_graph = build_demo_graph()
    for step in run_graph.stream(
        {"messages": [("user", "What's the 20th Fibonacci number?")]},
        stream_mode="values",
    ):
        step["messages"][-1].pretty_print()