"""Inspect tools for k8s-mcp.

These tools provide namespace status management capabilities,
including setting and listing namespace active/idle status
based on pod counts from Prometheus.
"""

import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from mcp.types import ToolAnnotations

from k8s_mcp.server.k8s_config import get_k8s_client
from k8s_mcp.server.schemas import (
    GetNamespaceStatusResponse,
    SetNamespaceStatusResponse,
)
from k8s_mcp.server.structured import structured_response
from k8s_mcp.server.tools.prometheus import _query_prometheus_api

logger = logging.getLogger("mcp-server")

ANNOTATION_PREFIX = "kubestar.io/lifecycle-"
STATUS_ACTIVE = "active"
STATUS_IDLE = "idle"


def _build_pod_count_promql(
    cluster: str,
    exclude_namespaces: List[str],
    duration_days: int,
    namespace: Optional[str] = None,
) -> str:
    """Build PromQL for per-namespace running pod counts.

    Uses max_over_time to detect any pod activity in the window.
    """
    if namespace:
        ns_filter = f'namespace="{namespace}"'
    else:
        exclude_pattern = "|".join(exclude_namespaces)
        ns_filter = f'namespace!~"{exclude_pattern}"'

    return (
        'sum by (cluster, namespace) ('
        '  max_over_time('
        '    kube_pod_status_phase{'
        '      phase="Running",'
        f'      {ns_filter},'
        f'      cluster="{cluster}"'
        '    }'
        f'    [{duration_days}d]'
        '  )'
        ')\n'
        'or on (cluster, namespace)\n'
        '(\n'
        '  0 * kube_namespace_status_phase{'
        '    phase="Active",'
        f'    {ns_filter},'
        f'    cluster="{cluster}"'
        '  }'
        ')'
    )


def _parse_pod_counts(data: Dict[str, Any]) -> Dict[str, int]:
    """Parse Prometheus vector result into namespace -> pod_count mapping."""
    result_type = data.get("data", {}).get("resultType", "")
    if result_type != "vector":
        raise ValueError(f"Unexpected result type: {result_type!r}")

    namespaces: Dict[str, int] = {}
    for item in data.get("data", {}).get("result", []):
        metric = item.get("metric", {})
        ns = metric.get("namespace", "")
        if not ns:
            continue
        value = item.get("value", [])
        if len(value) >= 2:
            try:
                count = int(float(value[1]))
            except (ValueError, TypeError):
                count = 0
        else:
            count = 0
        namespaces[ns] = count

    return namespaces


def _compute_status(pod_count: int, idle_threshold: int) -> str:
    return STATUS_IDLE if pod_count <= idle_threshold else STATUS_ACTIVE


def _build_annotations(
    current_annotations: Dict[str, str],
    pod_count: int,
    idle_threshold: int,
    duration_days: int,
    now: datetime,
) -> Dict[str, str]:
    """Compute namespace status annotations for a single namespace.

    Logic:
    - First detection or transition: reset since/duration
    - Same state, small gap: increment duration
    - Same state, large gap: reset (cannot confirm intermediate state)
    """
    now_iso = now.replace(microsecond=0).isoformat()
    since_default = (now - timedelta(days=duration_days)).replace(microsecond=0).isoformat()

    old_status = current_annotations.get(f"{ANNOTATION_PREFIX}status", "")
    old_since_str = current_annotations.get(f"{ANNOTATION_PREFIX}since", "")
    old_duration_str = current_annotations.get(f"{ANNOTATION_PREFIX}duration", "")
    old_last_check_str = current_annotations.get(f"{ANNOTATION_PREFIX}last-check", "")

    new_status = _compute_status(pod_count, idle_threshold)
    annotations: Dict[str, str] = {}
    need_reset = False

    if old_status != new_status:
        need_reset = True
    elif old_status == new_status and old_last_check_str:
        try:
            last_check = datetime.fromisoformat(old_last_check_str)
            if last_check.tzinfo is None:
                last_check = last_check.replace(tzinfo=timezone.utc)
            gap_seconds = int((now - last_check).total_seconds())
            if gap_seconds > duration_days * 86400:
                need_reset = True
        except (ValueError, TypeError):
            need_reset = True
    elif not old_status:
        need_reset = True

    if need_reset:
        annotations[f"{ANNOTATION_PREFIX}status"] = new_status
        annotations[f"{ANNOTATION_PREFIX}since"] = since_default
        annotations[f"{ANNOTATION_PREFIX}duration"] = f"{duration_days}d"
        annotations[f"{ANNOTATION_PREFIX}last-transition"] = now_iso
    else:
        annotations[f"{ANNOTATION_PREFIX}status"] = new_status
        if old_duration_str:
            match = re.match(r"(\d+)d", old_duration_str)
            new_duration = int(match.group(1)) + 1 if match else duration_days
        else:
            new_duration = duration_days
        annotations[f"{ANNOTATION_PREFIX}duration"] = f"{new_duration}d"
        annotations[f"{ANNOTATION_PREFIX}since"] = old_since_str or since_default
        old_transition = current_annotations.get(f"{ANNOTATION_PREFIX}last-transition")
        if old_transition:
            annotations[f"{ANNOTATION_PREFIX}last-transition"] = old_transition

    annotations[f"{ANNOTATION_PREFIX}last-check"] = now_iso
    annotations[f"{ANNOTATION_PREFIX}last-pod-count"] = str(pod_count)

    return annotations


def register_inspect_tools(server: "FastMCP", non_destructive: bool):
    """Register namespace status tools.

    These tools provide namespace status management capabilities,
    including setting and listing namespace active/idle status
    based on pod counts from Prometheus.
    """

    @server.tool(
        output_schema=SetNamespaceStatusResponse.model_json_schema(),
        annotations=ToolAnnotations(
            title="Set Namespace Status",
            readOnlyHint=False,
            destructiveHint=False,
            idempotentHint=True,
            openWorldHint=True,
        ),
    )
    def set_namespace_status(
        cluster: str,
        prometheus_url: str,
        context: str = "",
        namespaces: Optional[List[str]] = None,
        idle_threshold: int = 0,
        duration_days: int = 1,
        dry_run: bool = True,
        exclude: Optional[List[str]] = None,
        timeout: int = 30,
    ) -> Dict[str, Any]:
        """Set namespace status (active/idle) based on Prometheus pod counts.

        Queries Prometheus for running pod counts per namespace, determines active/idle status,
        and applies status annotations. Default dry_run=True for safety.

        Args:
            cluster: Target cluster name (PromQL cluster label)
            prometheus_url: Prometheus/Thanos base URL
            context: Kubernetes context (uses current if empty)
            namespaces: Specific namespaces to process (None = all non-excluded)
            idle_threshold: Pod count at or below which namespace is idle. Default: 0
            duration_days: Prometheus query window in days (1-7). Default: 1
            dry_run: If True, preview only. Default: True
            exclude: Namespaces to exclude. Default: system namespaces
            timeout: Timeout in seconds. Default: 30

        Returns:
            {
                "success": true,
                "cluster": "prod",
                "context": "current",
                "dry_run": true,
                "total": 173,
                "processed": 170,
                "active": 45,
                "idle": 125,
                "errors": 0
            }
        """
        try:
            # Validate
            if not (1 <= duration_days <= 7):
                return {
                    "success": False,
                    "error": f"duration_days must be between 1 and 7, got {duration_days}",
                }

            if not prometheus_url:
                return {
                    "success": False,
                    "error": "prometheus_url is required. Provide the Prometheus/Thanos base URL.",
                }

            # Resolve exclude list
            exclude_list = exclude or ["kube-system", "kube-public", "kube-node-lease", "monitoring"]

            # Step 1: Query Prometheus for pod counts (internal call)
            logger.info(f"Querying Prometheus for cluster={cluster}, window={duration_days}d")
            promql = _build_pod_count_promql(cluster, exclude_list, duration_days)
            raw = _query_prometheus_api(prometheus_url, promql, timeout=timeout)

            status = raw.get("status")
            if status != "success":
                return {
                    "success": False,
                    "error": f"Prometheus query failed: {status!r}",
                    "prometheus_response": raw,
                }

            pod_counts = _parse_pod_counts(raw)

            # Step 2: Filter to target namespaces
            if namespaces:
                wanted = set(namespaces)
                missing = wanted - set(pod_counts.keys())
                if missing:
                    return {
                        "success": False,
                        "error": f"Namespace(s) not found in Prometheus: {', '.join(sorted(missing))}",
                    }
                target_ns = {ns: pod_counts[ns] for ns in wanted}
            else:
                target_ns = dict(pod_counts)

            # Step 3: Fetch all namespaces
            v1 = get_k8s_client(context)
            namespace_list = v1.list_namespace()
            namespace_annotations = {
                ns.metadata.name: ns.metadata.annotations or {}
                for ns in namespace_list.items
            }

            now = datetime.now(timezone.utc)

            # Step 4: Compute and apply annotations
            processed_count = 0
            error_count = 0
            active_count = 0
            idle_count = 0

            for namespace_name, pod_count in sorted(target_ns.items()):
                current_annotations = namespace_annotations.get(namespace_name)
                if current_annotations is None:
                    error_count += 1
                    continue

                annotations = _build_annotations(
                    current_annotations=current_annotations,
                    pod_count=pod_count,
                    idle_threshold=idle_threshold,
                    duration_days=duration_days,
                    now=now,
                )

                new_status = _compute_status(pod_count, idle_threshold)

                if dry_run:
                    processed_count += 1
                else:
                    try:
                        patch = {"metadata": {"annotations": annotations}}
                        v1.patch_namespace(namespace_name, patch)
                        processed_count += 1
                    except Exception:
                        error_count += 1
                        continue

                if new_status == STATUS_ACTIVE:
                    active_count += 1
                else:
                    idle_count += 1

            return structured_response({
                "success": error_count == 0,
                "cluster": cluster,
                "context": context or "current",
                "dry_run": dry_run,
                "total": len(target_ns),
                "processed": processed_count,
                "active": active_count,
                "idle": idle_count,
                "errors": error_count,
            }, SetNamespaceStatusResponse)

        except RuntimeError as e:
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Error setting namespace status: {e}")
            return {"success": False, "error": str(e)}

    @server.tool(
        output_schema=GetNamespaceStatusResponse.model_json_schema(),
        annotations=ToolAnnotations(
            title="List Namespace Status",
            readOnlyHint=True,
            destructiveHint=False,
            idempotentHint=True,
            openWorldHint=True,
        ),
    )
    def list_namespace_status(
        context: str = "",
        namespaces: Optional[List[str]] = None,
        timeout: int = 30,
    ) -> Dict[str, Any]:
        """List namespace status annotations without modifying them.

        Useful for checking current status before running set_namespace_status.

        Args:
            context: kubectl context to use
            namespaces: Specific namespaces to check (None = all)
            timeout: kubectl timeout in seconds. Default: 30

        Returns:
            {
                "success": true,
                "namespaces": [
                    {
                        "name": "app-a",
                        "status": "active",
                        "since": "2024-01-10T08:00:00+00:00",
                        "duration": "5d",
                        "last_check": "2024-01-15T10:00:00+00:00",
                        "last_pod_count": "3"
                    }
                ]
            }
        """
        try:
            v1 = get_k8s_client(context)
            ns_list = v1.list_namespace()

            results = []
            for ns in ns_list.items:
                name = ns.metadata.name
                if not name:
                    continue
                if namespaces and name not in namespaces:
                    continue

                annotations = ns.metadata.annotations or {}
                prefix = ANNOTATION_PREFIX

                status = annotations.get(f"{prefix}status", "")
                if not status:
                    continue  # Skip namespaces without lifecycle annotations

                results.append({
                    "name": name,
                    "status": status,
                    "since": annotations.get(f"{prefix}since"),
                    "duration": annotations.get(f"{prefix}duration"),
                    "last_transition": annotations.get(f"{prefix}last-transition"),
                    "last_check": annotations.get(f"{prefix}last-check"),
                    "last_pod_count": annotations.get(f"{prefix}last-pod-count"),
                })

            return structured_response({
                "success": True,
                "context": context or "current",
                "count": len(results),
                "active": sum(1 for r in results if r["status"] == STATUS_ACTIVE),
                "idle": sum(1 for r in results if r["status"] == STATUS_IDLE),
                "namespaces": results,
            }, GetNamespaceStatusResponse)

        except RuntimeError as e:
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Error listing namespace status: {e}")
            return {"success": False, "error": str(e)}
