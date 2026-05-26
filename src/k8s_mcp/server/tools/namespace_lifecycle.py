"""Namespace lifecycle management tools for k8s-mcp.

These tools manage namespace lifecycle annotations (active/idle status)
based on pod counts from Prometheus.
"""

import logging
import os
import re
import subprocess
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from mcp.types import ToolAnnotations

from ..k8s_config import get_k8s_client, _get_kubectl_context_args
from .prometheus import _query_prometheus_api

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


def _run_kubectl(
    args: List[str],
    timeout: int,
    context: str = "",
) -> subprocess.CompletedProcess[str]:
    """Run kubectl command with optional context."""
    kubectl = os.environ.get("KUBECTL", "kubectl")
    cmd = [kubectl]
    if context:
        cmd += ["--context", context]
    cmd += args
    return subprocess.run(cmd, check=False, capture_output=True, text=True, timeout=timeout)


def _get_all_namespaces(context: str = "", timeout: int = 30) -> List[Dict[str, Any]]:
    """Fetch all namespace objects with their annotations."""
    import json

    proc = _run_kubectl(["get", "namespaces", "-o", "json"], timeout=timeout, context=context)
    if proc.returncode != 0:
        raise RuntimeError(f"Failed to list namespaces: {proc.stderr}")
    data = json.loads(proc.stdout)
    return data.get("items", [])


def _annotate_namespace(
    namespace: str,
    annotations: Dict[str, str],
    timeout: int,
    context: str = "",
    dry_run: bool = False,
) -> tuple[bool, str]:
    """Apply annotations to a namespace. Returns (success, message)."""
    if not annotations:
        return True, "No annotations to apply."

    kv_pairs = [f"{k}={v}" for k, v in annotations.items()]
    cmd = ["annotate", "namespace", namespace, "--overwrite"] + kv_pairs

    if dry_run:
        prefix = ["--context", context] if context else []
        return True, f"[DRY-RUN] kubectl {' '.join(prefix + cmd)}"

    proc = _run_kubectl(cmd, timeout=timeout, context=context)
    if proc.returncode != 0:
        return False, proc.stderr.strip() or proc.stdout.strip()
    return True, proc.stdout.strip()


def _compute_status(pod_count: int, idle_threshold: int) -> str:
    return STATUS_IDLE if pod_count <= idle_threshold else STATUS_ACTIVE


def _build_annotations(
    namespace_obj: Dict[str, Any],
    pod_count: int,
    idle_threshold: int,
    duration_days: int,
    now: datetime,
) -> Dict[str, str]:
    """Compute lifecycle annotations for a single namespace.

    Logic:
    - First detection or transition: reset since/duration
    - Same state, small gap: increment duration
    - Same state, large gap: reset (cannot confirm intermediate state)
    """
    now_iso = now.replace(microsecond=0).isoformat()
    since_default = (now - timedelta(days=duration_days)).replace(microsecond=0).isoformat()

    metadata = namespace_obj.get("metadata", {})
    current_annotations = metadata.get("annotations", {}) or {}

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


def register_namespace_lifecycle_tools(server: "FastMCP", non_destructive: bool):
    """Register namespace lifecycle management tools.

    These tools manage namespace lifecycle annotations (active/idle status)
    based on pod counts from Prometheus.
    """

    @server.tool(
        annotations=ToolAnnotations(
            title="Manage Namespace Lifecycle",
            readOnlyHint=False,
            destructiveHint=False,
            idempotentHint=True,
            openWorldHint=True,
        ),
    )
    def manage_namespace_lifecycle(
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
        """Batch manage namespace lifecycle annotations (active/idle status).

        This tool queries Prometheus for per-namespace running pod counts,
        computes lifecycle status, and applies annotations via kubectl.
        All processing happens server-side to minimize LLM token usage.

        Safety:
        - Only writes via kubectl annotate (never delete, scale, etc.)
        - Default dry_run=True - must explicitly set dry_run=False to apply
        - Excludes system namespaces by default

        Args:
            cluster: Target cluster name (PromQL cluster label and output metadata)
            prometheus_url: Prometheus/Thanos base URL.
                            Example: 'http://prometheus.monitoring.svc.cluster.local:9090'
            context: kubectl context to use (uses current if empty)
            namespaces: Specific namespaces to process (None = all non-excluded)
            idle_threshold: Pod count at or below which namespace is idle. Default: 0
            duration_days: Prometheus query window in days (1-7). Default: 1
            dry_run: If True, preview changes without applying. Default: True
            exclude: Namespaces to exclude from query. Default: system namespaces
            timeout: Timeout per operation in seconds. Default: 30

        Returns:
            {
                "success": true,
                "dry_run": true,
                "summary": {
                    "total": 173,
                    "active": 45,
                    "idle": 128,
                    "transitions": 3,
                    "errors": 0
                },
                "changes": [...]  // limited to first 20 for token efficiency
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

            # Step 3: Fetch all namespace annotations (ONE kubectl call)
            all_ns_items = _get_all_namespaces(context=context, timeout=timeout)
            ns_map = {item["metadata"]["name"]: item for item in all_ns_items if "metadata" in item}

            now = datetime.now(timezone.utc)
            now_iso = now.replace(microsecond=0).isoformat()

            # Step 4: Compute and apply annotations
            results: List[Dict[str, Any]] = []
            transition_count = 0
            error_count = 0

            for ns_name, pod_count in sorted(target_ns.items()):
                ns_obj = ns_map.get(ns_name)
                if not ns_obj:
                    results.append({
                        "namespace": ns_name,
                        "pod_count": pod_count,
                        "status": _compute_status(pod_count, idle_threshold),
                        "error": "Namespace not found in cluster",
                        "success": False,
                    })
                    error_count += 1
                    continue

                annotations = _build_annotations(
                    namespace_obj=ns_obj,
                    pod_count=pod_count,
                    idle_threshold=idle_threshold,
                    duration_days=duration_days,
                    now=now,
                )

                old_status = (ns_obj.get("metadata", {}).get("annotations", {}) or {}).get(
                    f"{ANNOTATION_PREFIX}status", ""
                )
                new_status = _compute_status(pod_count, idle_threshold)
                transition_occurred = old_status != new_status

                success, message = _annotate_namespace(
                    ns_name,
                    annotations,
                    timeout=timeout,
                    context=context,
                    dry_run=dry_run,
                )

                results.append({
                    "namespace": ns_name,
                    "pod_count": pod_count,
                    "status": new_status,
                    "previous_status": old_status or None,
                    "transition": transition_occurred,
                    "success": success,
                    "message": message if not success else None,
                })

                if transition_occurred:
                    transition_count += 1
                if not success:
                    error_count += 1

            # Build response - limit details to prevent token explosion
            active_count = sum(1 for r in results if r["status"] == STATUS_ACTIVE)
            idle_count = sum(1 for r in results if r["status"] == STATUS_IDLE)

            return {
                "success": error_count == 0,
                "cluster": cluster,
                "context": context or "current",
                "dry_run": dry_run,
                "processed_at": now_iso,
                "summary": {
                    "total": len(results),
                    "active": active_count,
                    "idle": idle_count,
                    "transitions": transition_count,
                    "errors": error_count,
                },
                "changes": results[:20],  # Limit for token efficiency
                "has_more_changes": len(results) > 20,
            }

        except subprocess.TimeoutExpired:
            return {"success": False, "error": "kubectl operation timed out"}
        except RuntimeError as e:
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Error managing namespace lifecycle: {e}")
            return {"success": False, "error": str(e)}

    @server.tool(
        annotations=ToolAnnotations(
            title="Get Namespace Lifecycle Status",
            readOnlyHint=True,
            destructiveHint=False,
            idempotentHint=True,
            openWorldHint=True,
        ),
    )
    def get_namespace_lifecycle_status(
        context: str = "",
        namespaces: Optional[List[str]] = None,
        timeout: int = 30,
    ) -> Dict[str, Any]:
        """Read lifecycle annotations from namespaces without modifying them.

        Useful for checking current status before running manage_namespace_lifecycle.

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
            all_ns_items = _get_all_namespaces(context=context, timeout=timeout)

            results = []
            for item in all_ns_items:
                name = item.get("metadata", {}).get("name", "")
                if not name:
                    continue
                if namespaces and name not in namespaces:
                    continue

                annotations = item.get("metadata", {}).get("annotations", {}) or {}
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

            return {
                "success": True,
                "context": context or "current",
                "count": len(results),
                "active": sum(1 for r in results if r["status"] == STATUS_ACTIVE),
                "idle": sum(1 for r in results if r["status"] == STATUS_IDLE),
                "namespaces": results,
            }

        except subprocess.TimeoutExpired:
            return {"success": False, "error": "kubectl operation timed out"}
        except RuntimeError as e:
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Error getting namespace lifecycle status: {e}")
            return {"success": False, "error": str(e)}
