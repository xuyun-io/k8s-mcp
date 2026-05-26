"""Prometheus/Thanos query tools for k8s-mcp.

These tools provide generic, stateless PromQL query capabilities.
The Prometheus URL must be provided as a parameter on each call.
"""

import logging
from typing import Any, Dict

import requests
from mcp.types import ToolAnnotations

logger = logging.getLogger("mcp-server")


def _query_prometheus_api(
    prometheus_url: str,
    query: str,
    timeout: int = 30,
) -> Dict[str, Any]:
    """Query Prometheus/Thanos instant query API.

    Internal helper - can be called directly by other tools.
    """
    url = prometheus_url.rstrip("/") + "/api/v1/query"
    params = {"query": query}

    response = requests.get(url, params=params, timeout=timeout)
    response.raise_for_status()
    return response.json()


def register_prometheus_tools(server: "FastMCP", non_destructive: bool):
    """Register Prometheus/Thanos query tools.

    These tools are stateless and generic - they only execute PromQL queries
    and return raw results. Business logic (like namespace lifecycle) should
    be handled by specialized tools that call these internally.
    """

    @server.tool(
        annotations=ToolAnnotations(
            title="Query Prometheus",
            readOnlyHint=True,
            destructiveHint=False,
            idempotentHint=True,
            openWorldHint=True,
        ),
    )
    def query_prometheus(
        query: str,
        prometheus_url: str,
        timeout: int = 30,
    ) -> Dict[str, Any]:
        """Execute a PromQL instant query against Prometheus/Thanos.

        This is a generic, stateless query tool. It does not interpret results
        or modify cluster state. Use it for:
        - Custom metrics exploration
        - Building specialized tools that need Prometheus data
        - Ad-hoc monitoring queries

        For common queries (pod counts, node metrics), prefer specialized tools
        that handle the PromQL construction for you.

        Args:
            query: PromQL query string. Must be a valid instant query.
                   Examples:
                   - 'sum by (namespace) (kube_pod_status_phase{phase="Running"})'
                   - 'node_cpu_seconds_total{mode="idle"}'
                   - 'up{job="kubelet"}'
            prometheus_url: Prometheus/Thanos base URL.
                            Example: 'http://prometheus.monitoring.svc.cluster.local:9090'
            timeout: HTTP request timeout in seconds. Default: 30

        Returns:
            {
                "success": true,
                "prometheus_url": "http://prometheus:9090",
                "query": "sum by (namespace) (...)",
                "result_type": "vector",
                "result": [
                    {
                        "metric": {"namespace": "default"},
                        "value": [1234567890.123, "5"]
                    }
                ]
            }
        """
        try:
            if not prometheus_url:
                return {
                    "success": False,
                    "error": "prometheus_url is required. Provide the Prometheus/Thanos base URL.",
                }

            raw = _query_prometheus_api(prometheus_url, query, timeout=timeout)

            status = raw.get("status")
            if status != "success":
                return {
                    "success": False,
                    "error": f"Prometheus query returned non-success status: {status!r}",
                    "prometheus_response": raw,
                }

            data = raw.get("data", {})
            return {
                "success": True,
                "prometheus_url": prometheus_url,
                "query": query,
                "result_type": data.get("resultType", "unknown"),
                "result": data.get("result", []),
            }

        except requests.exceptions.Timeout:
            logger.error("Prometheus query timed out")
            return {
                "success": False,
                "error": f"Prometheus query timed out after {timeout}s",
            }
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Failed to connect to Prometheus: {e}")
            return {
                "success": False,
                "error": f"Failed to connect to Prometheus: {e}",
            }
        except Exception as e:
            logger.error(f"Error querying Prometheus: {e}")
            return {"success": False, "error": str(e)}

    @server.tool(
        annotations=ToolAnnotations(
            title="Query Prometheus Range",
            readOnlyHint=True,
            destructiveHint=False,
            idempotentHint=True,
            openWorldHint=True,
        ),
    )
    def query_prometheus_range(
        query: str,
        start: str,
        end: str,
        step: str,
        prometheus_url: str,
        timeout: int = 30,
    ) -> Dict[str, Any]:
        """Execute a PromQL range query against Prometheus/Thanos.

        Range queries return time-series data over a period. Use for:
        - Historical trends
        - Capacity planning
        - Alert investigation

        Args:
            query: PromQL query string
            start: Start time (RFC3339 or Unix timestamp)
            end: End time (RFC3339 or Unix timestamp)
            step: Query resolution step width (e.g., "1m", "5m", "1h")
            prometheus_url: Prometheus/Thanos base URL
            timeout: HTTP request timeout in seconds. Default: 30

        Returns:
            {
                "success": true,
                "result_type": "matrix",
                "result": [
                    {
                        "metric": {"pod": "app-1"},
                        "values": [[1234567890, "5"], [1234567950, "6"]]
                    }
                ]
            }
        """
        try:
            if not prometheus_url:
                return {
                    "success": False,
                    "error": "prometheus_url is required. Provide the Prometheus/Thanos base URL.",
                }

            query_url = prometheus_url.rstrip("/") + "/api/v1/query_range"
            params = {
                "query": query,
                "start": start,
                "end": end,
                "step": step,
            }

            response = requests.get(query_url, params=params, timeout=timeout)
            response.raise_for_status()
            raw = response.json()

            status = raw.get("status")
            if status != "success":
                return {
                    "success": False,
                    "error": f"Prometheus query returned non-success status: {status!r}",
                    "prometheus_response": raw,
                }

            data = raw.get("data", {})
            return {
                "success": True,
                "prometheus_url": prometheus_url,
                "query": query,
                "start": start,
                "end": end,
                "step": step,
                "result_type": data.get("resultType", "unknown"),
                "result": data.get("result", []),
            }

        except requests.exceptions.Timeout:
            return {
                "success": False,
                "error": f"Prometheus range query timed out after {timeout}s",
            }
        except requests.exceptions.ConnectionError as e:
            return {
                "success": False,
                "error": f"Failed to connect to Prometheus: {e}",
            }
        except Exception as e:
            logger.error(f"Error executing Prometheus range query: {e}")
            return {"success": False, "error": str(e)}
