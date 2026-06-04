from __future__ import annotations

import threading
import time
from collections import defaultdict
from typing import Literal


class _Counter:
    """Thread-safe counter with label support."""

    def __init__(self, name: str, description: str) -> None:
        self.name = name
        self.description = description
        self._lock = threading.Lock()
        self._values: dict[tuple[tuple[str, str], ...], float] = defaultdict(float)

    def inc(self, value: float = 1.0, **labels: str) -> None:
        key = tuple(sorted(labels.items()))
        with self._lock:
            self._values[key] += value

    def collect(self) -> list[tuple[dict[str, str], float]]:
        with self._lock:
            return [(dict(k), v) for k, v in self._values.items()]


class _Gauge:
    """Thread-safe gauge with label support."""

    def __init__(self, name: str, description: str) -> None:
        self.name = name
        self.description = description
        self._lock = threading.Lock()
        self._values: dict[tuple[tuple[str, str], ...], float] = defaultdict(float)

    def set(self, value: float, **labels: str) -> None:
        key = tuple(sorted(labels.items()))
        with self._lock:
            self._values[key] = value

    def inc(self, value: float = 1.0, **labels: str) -> None:
        key = tuple(sorted(labels.items()))
        with self._lock:
            self._values[key] += value

    def dec(self, value: float = 1.0, **labels: str) -> None:
        key = tuple(sorted(labels.items()))
        with self._lock:
            self._values[key] -= value

    def collect(self) -> list[tuple[dict[str, str], float]]:
        with self._lock:
            return [(dict(k), v) for k, v in self._values.items()]


class _Histogram:
    """Thread-safe histogram with configurable buckets and label support."""

    DEFAULT_BUCKETS = (0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0)

    def __init__(
        self,
        name: str,
        description: str,
        buckets: tuple[float, ...] | None = None,
    ) -> None:
        self.name = name
        self.description = description
        self.buckets = buckets or self.DEFAULT_BUCKETS
        self._lock = threading.Lock()
        # Per-label-set: (bucket_counts, sum, count)
        self._data: dict[
            tuple[tuple[str, str], ...],
            tuple[dict[float, int], float, int],
        ] = {}

    def _ensure_key(self, key: tuple[tuple[str, str], ...]) -> None:
        if key not in self._data:
            self._data[key] = ({b: 0 for b in self.buckets}, 0.0, 0)

    def observe(self, value: float, **labels: str) -> None:
        key = tuple(sorted(labels.items()))
        with self._lock:
            self._ensure_key(key)
            bucket_counts, total_sum, total_count = self._data[key]
            for b in self.buckets:
                if value <= b:
                    bucket_counts[b] += 1
            self._data[key] = (bucket_counts, total_sum + value, total_count + 1)

    def collect(
        self,
    ) -> list[tuple[dict[str, str], dict[float, int], float, int]]:
        with self._lock:
            return [
                (dict(k), dict(bc), s, c) for k, (bc, s, c) in self._data.items()
            ]


# ---------------------------------------------------------------------------
# Singleton registry
# ---------------------------------------------------------------------------


class MetricsCollector:
    """Application-wide metrics registry."""

    def __init__(self) -> None:
        # HTTP request metrics
        self.request_count = _Counter(
            "http_requests_total",
            "Total HTTP requests",
        )
        self.request_duration = _Histogram(
            "http_request_duration_seconds",
            "HTTP request duration in seconds",
        )

        # Analysis pipeline
        self.active_analyses = _Gauge(
            "active_analyses",
            "Number of analyses currently in progress",
        )
        self.queued_analyses = _Gauge(
            "queued_analyses",
            "Number of analyses waiting in queue",
        )

        # Agent metrics
        self.agent_execution_count = _Counter(
            "agent_execution_total",
            "Total agent executions",
        )
        self.agent_duration = _Histogram(
            "agent_duration_seconds",
            "Agent execution duration in seconds",
        )

    # ------------------------------------------------------------------
    # Prometheus text exposition
    # ------------------------------------------------------------------

    def render_prometheus(self) -> str:
        """Render all metrics in Prometheus text exposition format."""
        lines: list[str] = []

        # Counters
        for counter in (self.request_count, self.agent_execution_count):
            lines.append(f"# HELP {counter.name} {counter.description}")
            lines.append(f"# TYPE {counter.name} counter")
            for labels, value in counter.collect():
                label_str = self._format_labels(labels)
                lines.append(f"{counter.name}{label_str} {value}")

        # Gauges
        for gauge in (self.active_analyses, self.queued_analyses):
            lines.append(f"# HELP {gauge.name} {gauge.description}")
            lines.append(f"# TYPE {gauge.name} gauge")
            for labels, value in gauge.collect():
                label_str = self._format_labels(labels)
                lines.append(f"{gauge.name}{label_str} {value}")

        # Histograms
        for histogram in (self.request_duration, self.agent_duration):
            lines.append(f"# HELP {histogram.name} {histogram.description}")
            lines.append(f"# TYPE {histogram.name} histogram")
            for labels, buckets, total_sum, total_count in histogram.collect():
                label_str = self._format_labels(labels)
                cumulative = 0
                for bound in sorted(buckets.keys()):
                    cumulative += buckets[bound]
                    le_labels = {**labels, "le": str(bound)}
                    le_str = self._format_labels(le_labels)
                    lines.append(f"{histogram.name}_bucket{le_str} {cumulative}")
                inf_labels = {**labels, "le": "+Inf"}
                inf_str = self._format_labels(inf_labels)
                lines.append(f"{histogram.name}_bucket{inf_str} {total_count}")
                lines.append(f"{histogram.name}_sum{label_str} {total_sum}")
                lines.append(f"{histogram.name}_count{label_str} {total_count}")

        lines.append("")  # trailing newline
        return "\n".join(lines)

    @staticmethod
    def _format_labels(labels: dict[str, str]) -> str:
        if not labels:
            return ""
        pairs = ",".join(f'{k}="{v}"' for k, v in sorted(labels.items()))
        return "{" + pairs + "}"


# Module-level singleton
metrics = MetricsCollector()
