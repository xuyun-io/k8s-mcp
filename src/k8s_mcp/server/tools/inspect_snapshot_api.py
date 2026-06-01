"""Kubernetes API-based cluster snapshot collection for inspection reports.

Collects cluster resources using the official Kubernetes Python client.
For ConfigMap and Secret, uses PartialObjectMetadataList to avoid
downloading sensitive data fields over the network.
"""

from __future__ import annotations

import json
import logging
import urllib3
import warnings
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from k8s_mcp.server.k8s_config import (
    get_k8s_client,
    get_apps_client,
    get_batch_client,
    get_networking_client,
)

logger = logging.getLogger("mcp-server")

# Suppress urllib3 warnings about unverified HTTPS (handled by CA certs)
warnings.filterwarnings("ignore", category=urllib3.exceptions.InsecureRequestWarning)


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def list_metadata_only(api_client, path: str) -> List[Dict[str, Any]]:
    """List resources with only metadata using PartialObjectMetadataList.

    This avoids downloading spec/status/data fields over the network.
    Returns items compatible with the normal list format.
    """
    config = api_client.configuration
    http = urllib3.PoolManager(
        cert_reqs="CERT_REQUIRED" if config.ssl_ca_cert else "CERT_NONE",
        ca_certs=config.ssl_ca_cert,
    )

    headers = {
        "Accept": "application/json;as=PartialObjectMetadataList;v=v1;g=meta.k8s.io",
        "Authorization": config.api_key.get("authorization", ""),
    }

    resp = http.request("GET", f"{config.host}{path}", headers=headers)
    if resp.status != 200:
        raise RuntimeError(f"API error {resp.status}: {resp.data.decode()}")

    data = json.loads(resp.data)
    items = data.get("items", [])

    # Normalize PartialObjectMetadata items to match normal list format
    # Each item has: kind, apiVersion, metadata (no data/spec/status)
    normalized: List[Dict[str, Any]] = []
    for item in items:
        normalized.append({
            "apiVersion": item.get("apiVersion", "v1"),
            "kind": item.get("kind", "").replace("List", ""),
            "metadata": item.get("metadata", {}),
        })
    return normalized


def _k8s_obj_to_dict(obj: Any) -> Dict[str, Any]:
    """Convert a Kubernetes API object to a plain dict."""
    if hasattr(obj, "to_dict"):
        return obj.to_dict()
    if isinstance(obj, dict):
        return obj
    return {}


def _sanitize_name(value: str) -> str:
    """Sanitize a string for use as a filename."""
    import re
    sanitized = re.sub(r"[^a-zA-Z0-9_.-]", "-", value)
    sanitized = re.sub(r"-+", "-", sanitized).strip("-.")
    return sanitized or "unnamed"


# ── Collection functions ──


def collect_nodes(context: str = "", timeout: int = 60) -> List[Dict[str, Any]]:
    """Collect all nodes."""
    v1 = get_k8s_client(context)
    return [_k8s_obj_to_dict(n) for n in v1.list_node(_request_timeout=timeout).items]


def collect_namespaces(context: str = "", timeout: int = 60) -> List[Dict[str, Any]]:
    """Collect all namespaces."""
    v1 = get_k8s_client(context)
    return [_k8s_obj_to_dict(ns) for ns in v1.list_namespace(_request_timeout=timeout).items]


def collect_pods(context: str = "", timeout: int = 60) -> List[Dict[str, Any]]:
    """Collect all pods across all namespaces."""
    v1 = get_k8s_client(context)
    return [_k8s_obj_to_dict(p) for p in v1.list_pod_for_all_namespaces(_request_timeout=timeout).items]


def collect_pvcs(context: str = "", timeout: int = 60) -> List[Dict[str, Any]]:
    """Collect all PVCs across all namespaces."""
    v1 = get_k8s_client(context)
    return [_k8s_obj_to_dict(p) for p in v1.list_persistent_volume_claim_for_all_namespaces(_request_timeout=timeout).items]


def collect_services(context: str = "", timeout: int = 60) -> List[Dict[str, Any]]:
    """Collect all services across all namespaces."""
    v1 = get_k8s_client(context)
    return [_k8s_obj_to_dict(s) for s in v1.list_service_for_all_namespaces(_request_timeout=timeout).items]


def collect_ingresses(context: str = "", timeout: int = 60) -> List[Dict[str, Any]]:
    """Collect all ingresses across all namespaces."""
    net = get_networking_client(context)
    return [_k8s_obj_to_dict(i) for i in net.list_ingress_for_all_namespaces(_request_timeout=timeout).items]


def collect_cronjobs(context: str = "", timeout: int = 60) -> List[Dict[str, Any]]:
    """Collect all cronjobs across all namespaces."""
    batch = get_batch_client(context)
    return [_k8s_obj_to_dict(c) for c in batch.list_cron_job_for_all_namespaces(_request_timeout=timeout).items]


def collect_configmaps(context: str = "", timeout: int = 60) -> List[Dict[str, Any]]:
    """Collect all ConfigMaps across all namespaces (metadata only)."""
    v1 = get_k8s_client(context)
    return list_metadata_only(v1.api_client, "/api/v1/configmaps")


def collect_secrets(context: str = "", timeout: int = 60) -> List[Dict[str, Any]]:
    """Collect all Secrets across all namespaces (metadata only)."""
    v1 = get_k8s_client(context)
    return list_metadata_only(v1.api_client, "/api/v1/secrets")


# ── Main collection ──


def collect_cluster_snapshot_api(
    context: str = "",
    namespaces: Optional[List[str]] = None,
    timeout: int = 60,
) -> Dict[str, Any]:
    """Collect a full cluster snapshot using Kubernetes API.

    Returns a dict compatible with build_report_data:
    {
        "cluster": "...",
        "generated_at": "...",
        "namespaces": {
            "ns-name": {
                "namespace_object": {...},
                "resources": {
                    "pods": {"items": [...]},
                    "persistentvolumeclaims": {"items": [...]},
                    ...
                }
            }
        },
        "nodes": {"items": [...]},
    }
    """
    logger.info("Starting cluster snapshot collection via K8s API (context=%s)", context or "default")

    # 1. Collect namespaces
    ns_items = collect_namespaces(context, timeout)
    all_ns_names = {ns.get("metadata", {}).get("name", "") for ns in ns_items if ns.get("metadata", {}).get("name")}

    if namespaces:
        target_ns = {ns for ns in namespaces if ns in all_ns_names}
        invalid = set(namespaces) - all_ns_names
        if invalid:
            logger.warning("Ignoring non-existent namespaces: %s", ", ".join(sorted(invalid)))
    else:
        target_ns = all_ns_names

    # 2. Collect all resources
    logger.debug("Collecting nodes...")
    node_items = collect_nodes(context, timeout)

    logger.debug("Collecting pods...")
    pod_items = collect_pods(context, timeout)

    logger.debug("Collecting pvcs...")
    pvc_items = collect_pvcs(context, timeout)

    logger.debug("Collecting services...")
    svc_items = collect_services(context, timeout)

    logger.debug("Collecting ingresses...")
    ing_items = collect_ingresses(context, timeout)

    logger.debug("Collecting cronjobs...")
    cj_items = collect_cronjobs(context, timeout)

    logger.debug("Collecting configmaps (metadata only)...")
    cm_items = collect_configmaps(context, timeout)

    logger.debug("Collecting secrets (metadata only)...")
    secret_items = collect_secrets(context, timeout)

    # 3. Group by namespace
    def group_by_namespace(items: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        groups: Dict[str, List[Dict[str, Any]]] = {}
        for item in items:
            ns = item.get("metadata", {}).get("namespace", "")
            if ns and ns in target_ns:
                groups.setdefault(ns, []).append(item)
        return groups

    pod_groups = group_by_namespace(pod_items)
    pvc_groups = group_by_namespace(pvc_items)
    svc_groups = group_by_namespace(svc_items)
    ing_groups = group_by_namespace(ing_items)
    cj_groups = group_by_namespace(cj_items)
    cm_groups = group_by_namespace(cm_items)
    secret_groups = group_by_namespace(secret_items)

    # 4. Build namespace snapshots
    ns_snapshots: Dict[str, Dict[str, Any]] = {}
    for ns_name in target_ns:
        ns_obj = next(
            (ns for ns in ns_items if ns.get("metadata", {}).get("name") == ns_name),
            None,
        )
        ns_snapshots[ns_name] = {
            "namespace_object": ns_obj,
            "resources": {
                "pods": {"items": pod_groups.get(ns_name, [])},
                "persistentvolumeclaims": {"items": pvc_groups.get(ns_name, [])},
                "services": {"items": svc_groups.get(ns_name, [])},
                "ingresses": {"items": ing_groups.get(ns_name, [])},
                "cronjobs": {"items": cj_groups.get(ns_name, [])},
                "configmaps": {"items": cm_groups.get(ns_name, [])},
                "secrets": {"items": secret_groups.get(ns_name, [])},
            },
        }

    # 5. Build cluster snapshot
    cluster_name = context or "unknown"
    try:
        from k8s_mcp.server.k8s_config import get_active_context
        cluster_name = get_active_context() or cluster_name
    except Exception:
        pass

    return {
        "apiVersion": "dutty/v1alpha1",
        "kind": "ClusterInspectionSnapshot",
        "cluster": cluster_name,
        "generated_at": _utc_now(),
        "collector": "inspect_snapshot_api.py",
        "namespaces": ns_snapshots,
        "nodes": {"items": node_items},
    }
