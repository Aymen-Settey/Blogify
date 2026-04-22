"""Prometheus metrics — minimal but actionable.

Exposed at /metrics via `PrometheusMiddleware` + `metrics_endpoint`. Also used
as decorators around Celery tasks so task latency/outcome is scraped for free.
"""
from __future__ import annotations

import time
from functools import wraps
from typing import Callable

from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Counter,
    Histogram,
    generate_latest,
)
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp, Receive, Scope, Send

# HTTP metrics
HTTP_REQUESTS = Counter(
    "blogify_http_requests_total",
    "Count of HTTP requests",
    ["method", "path", "status"],
)
HTTP_LATENCY = Histogram(
    "blogify_http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "path"],
)

# Celery / ML task metrics
TASK_DURATION = Histogram(
    "blogify_task_duration_seconds",
    "Celery task duration in seconds",
    ["task"],
)
TASK_OUTCOME = Counter(
    "blogify_task_total",
    "Celery task outcomes",
    ["task", "outcome"],
)

# Qdrant / LLM call metrics (optional, populated opportunistically)
QDRANT_QUERY_LATENCY = Histogram(
    "blogify_qdrant_query_duration_seconds",
    "Qdrant query latency in seconds",
    ["operation"],
)
LLM_CALL_LATENCY = Histogram(
    "blogify_llm_call_duration_seconds",
    "Local LLM call latency in seconds",
    ["outcome"],
)


class PrometheusMiddleware:
    """Starlette middleware that records per-request latency and status."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "GET")
        raw_path = scope.get("path", "")
        # Collapse IDs/slugs to keep label cardinality bounded.
        path = _normalize_path(raw_path)
        start = time.perf_counter()
        status_holder = {"status": 500}

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                status_holder["status"] = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            duration = time.perf_counter() - start
            HTTP_LATENCY.labels(method=method, path=path).observe(duration)
            HTTP_REQUESTS.labels(
                method=method, path=path, status=str(status_holder["status"])
            ).inc()


def _normalize_path(path: str) -> str:
    """Replace UUIDs / numeric IDs / slugs with a placeholder to cap cardinality."""
    parts = path.split("/")
    out: list[str] = []
    for p in parts:
        if not p:
            out.append(p)
            continue
        # UUID-ish or long hex
        if len(p) >= 12 and all(c.isalnum() or c == "-" for c in p) and any(c.isdigit() for c in p):
            out.append(":id")
        elif p.isdigit():
            out.append(":id")
        else:
            out.append(p)
    return "/".join(out)


async def metrics_endpoint(request: Request) -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


def track_task(task_name: str) -> Callable:
    """Decorator for Celery tasks to record duration and outcome."""

    def decorator(fn: Callable) -> Callable:
        @wraps(fn)
        def wrapper(*args, **kwargs):
            start = time.perf_counter()
            try:
                result = fn(*args, **kwargs)
                TASK_OUTCOME.labels(task=task_name, outcome="success").inc()
                return result
            except Exception:
                TASK_OUTCOME.labels(task=task_name, outcome="failure").inc()
                raise
            finally:
                TASK_DURATION.labels(task=task_name).observe(time.perf_counter() - start)

        return wrapper

    return decorator
