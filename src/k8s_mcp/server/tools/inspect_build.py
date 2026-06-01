"""Build inspection report data from a cluster snapshot.

Computes namespace-level metrics, orphan resource detection,
and aggregates totals. Output matches the InspectReport schema.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Set

logger = logging.getLogger("mcp-server")


def _safe_get(obj: Any, key: str, default: Any = None) -> Any:
    """Safely get a key from a dict, handling None values."""
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return default


def _safe_chain(obj: Any, *keys: str, default: Any = None) -> Any:
    """Safely chain dict gets, handling None at any step."""
    current = obj
    for key in keys:
        if current is None:
            return default
        if isinstance(current, dict):
            current = current.get(key)
        else:
            return default
    return current if current is not None else default


def parse_cpu_millicores(value: Any) -> int:
    text = str(value or "").strip()
    if not text:
        return 0
    try:
        if text.endswith("m"):
            return int(float(text[:-1]))
        return int(float(text) * 1000)
    except ValueError:
        return 0


def parse_bytes(value: Any) -> int:
    text = str(value or "").strip()
    if not text:
        return 0
    units = {
        "Ki": 1024,
        "Mi": 1024**2,
        "Gi": 1024**3,
        "Ti": 1024**4,
        "K": 1000,
        "M": 1000**2,
        "G": 1000**3,
        "T": 1000**4,
    }
    for suffix, factor in units.items():
        if text.endswith(suffix):
            try:
                return int(float(text[: -len(suffix)]) * factor)
            except ValueError:
                return 0
    try:
        return int(float(text))
    except ValueError:
        return 0


def format_cpu(millicores: int) -> str:
    if millicores == 0:
        return "0"
    if millicores >= 1000:
        cores = millicores / 1000
        if cores == int(cores):
            return f"{int(cores)} core"
        return f"{cores:.2f} core"
    return f"{millicores}m"


def format_bytes(value: int) -> str:
    if value == 0:
        return "0"
    gib = value / (1024**3)
    if gib >= 1:
        return f"{gib:.2f} Gi"
    mib = value / (1024**2)
    if mib >= 1:
        return f"{mib:.0f} Mi"
    kib = value / 1024
    if kib >= 1:
        return f"{kib:.0f} Ki"
    return f"{value} B"


# ── Orphan detection ──


def _pod_is_active(pod: Dict[str, Any]) -> bool:
    phase = _safe_chain(pod, "status", "phase", default="")
    return phase not in {"Succeeded", "Failed"}


def _pod_is_running(pod: Dict[str, Any]) -> bool:
    return _safe_chain(pod, "status", "phase", default="") == "Running"


def analyze_pvcs(pvcs: List[Dict[str, Any]], pods: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Find PVCs not referenced by any active pod."""
    referenced: Set[str] = set()
    for pod in pods:
        if not _pod_is_active(pod):
            continue
        for volume in _safe_chain(pod, "spec", "volumes", default=[]) or []:
            claim = _safe_get(volume, "persistentVolumeClaim", {}) or {}
            claim_name = _safe_get(claim, "claimName", "")
            if claim_name:
                referenced.add(str(claim_name))

    orphan_items: List[Dict[str, Any]] = []
    for pvc in pvcs:
        name = str(_safe_chain(pvc, "metadata", "name", default=""))
        if not name or name in referenced:
            continue
        spec = _safe_get(pvc, "spec", {}) or {}
        resources = _safe_get(spec, "resources", {}) or {}
        requests = _safe_get(resources, "requests", {}) or {}
        orphan_items.append({
            "name": name,
            "storage_class": _safe_get(spec, "storageClassName", ""),
            "capacity": _safe_get(requests, "storage", ""),
            "reason": "未被任何活跃 Pod 引用",
        })

    return {"total": len(pvcs), "orphan_count": len(orphan_items), "orphan_names": [i["name"] for i in orphan_items], "orphan_items": orphan_items}


def _backend_service_names(ingress: Dict[str, Any]) -> Set[str]:
    names: Set[str] = set()
    spec = _safe_get(ingress, "spec", {}) or {}

    def add_backend(backend: Dict[str, Any]) -> None:
        service = _safe_get(backend, "service", {}) or {}
        name = _safe_get(service, "name") or _safe_get(backend, "serviceName") or ""
        if name:
            names.add(str(name))

    for rule in _safe_get(spec, "rules", []) or []:
        http = _safe_get(rule, "http", {}) or {}
        for path in _safe_get(http, "paths", []) or []:
            add_backend(_safe_get(path, "backend", {}) or {})

    add_backend(_safe_get(spec, "defaultBackend", {}) or {})
    return names


def _service_running_pods(service_name: str, services: List[Dict[str, Any]], pods: List[Dict[str, Any]]) -> int:
    service = next(
        (svc for svc in services if _safe_chain(svc, "metadata", "name") == service_name),
        None,
    )
    if service is None:
        return 0

    selector = _safe_chain(service, "spec", "selector", default={}) or {}
    if not selector:
        return 0

    count = 0
    for pod in pods:
        if not _pod_is_running(pod):
            continue
        labels = _safe_chain(pod, "metadata", "labels", default={}) or {}
        if all(labels.get(key) == value for key, value in selector.items()):
            count += 1
    return count


def analyze_ingresses(ingresses: List[Dict[str, Any]], services: List[Dict[str, Any]], pods: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Find ingresses with no running backend pods."""
    orphan_items: List[Dict[str, Any]] = []

    for ingress in ingresses:
        name = _safe_chain(ingress, "metadata", "name", default="")
        service_names = _backend_service_names(ingress)
        hosts: List[str] = []
        for rule in _safe_get(_safe_get(ingress, "spec", {}) or {}, "rules", []) or []:
            host = _safe_get(rule, "host", "")
            if host:
                hosts.append(host)

        if not service_names:
            orphan_items.append({
                "name": name,
                "hosts": hosts,
                "reason": "无后端 Service 配置",
            })
            continue

        has_running_backend = any(
            _service_running_pods(service_name, services, pods) > 0
            for service_name in service_names
        )
        if not has_running_backend:
            orphan_items.append({
                "name": name,
                "hosts": hosts,
                "reason": "后端 Service 无运行 Pod",
            })

    return {"total": len(ingresses), "orphan_count": len(orphan_items), "orphan_names": [i["name"] for i in orphan_items], "orphan_items": orphan_items}


def analyze_configmaps(configmaps: List[Dict[str, Any]], pods: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Find ConfigMaps not referenced by any active pod."""
    referenced: Set[str] = set()

    for pod in pods:
        if not _pod_is_active(pod):
            continue
        spec = _safe_get(pod, "spec", {}) or {}

        # volumes[].configMap
        for volume in _safe_get(spec, "volumes", []) or []:
            cm = _safe_get(volume, "configMap", {}) or {}
            if _safe_get(cm, "name"):
                referenced.add(str(cm["name"]))
            # projected volumes
            projected = _safe_get(volume, "projected", {}) or {}
            for source in _safe_get(projected, "sources", []) or []:
                proj_cm = _safe_get(source, "configMap", {}) or {}
                if _safe_get(proj_cm, "name"):
                    referenced.add(str(proj_cm["name"]))

        # containers + initContainers
        for container in (_safe_get(spec, "containers", []) or []) + (_safe_get(spec, "initContainers", []) or []):
            # env[].valueFrom.configMapKeyRef
            for env in _safe_get(container, "env", []) or []:
                value_from = _safe_get(env, "valueFrom", {}) or {}
                cm_ref = _safe_get(value_from, "configMapKeyRef", {}) or {}
                if _safe_get(cm_ref, "name"):
                    referenced.add(str(cm_ref["name"]))
            # envFrom[].configMapRef
            for env_from in _safe_get(container, "envFrom", []) or []:
                cm_ref = _safe_get(env_from, "configMapRef", {}) or {}
                if _safe_get(cm_ref, "name"):
                    referenced.add(str(cm_ref["name"]))

    orphan_items: List[Dict[str, Any]] = []
    for cm in configmaps:
        name = str(_safe_chain(cm, "metadata", "name", default=""))
        if not name or name in referenced:
            continue
        orphan_items.append({
            "name": name,
            "reason": "未被任何活跃 Pod 引用",
        })

    return {"total": len(configmaps), "orphan_count": len(orphan_items), "orphan_names": [i["name"] for i in orphan_items], "orphan_items": orphan_items}


def analyze_secrets(secrets: List[Dict[str, Any]], pods: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Find Secrets not referenced by any active pod."""
    referenced: Set[str] = set()

    for pod in pods:
        if not _pod_is_active(pod):
            continue
        spec = _safe_get(pod, "spec", {}) or {}

        # imagePullSecrets
        for ips in _safe_get(spec, "imagePullSecrets", []) or []:
            if _safe_get(ips, "name"):
                referenced.add(str(ips["name"]))

        # volumes[].secret
        for volume in _safe_get(spec, "volumes", []) or []:
            secret = _safe_get(volume, "secret", {}) or {}
            if _safe_get(secret, "secretName"):
                referenced.add(str(secret["secretName"]))
            # projected volumes
            projected = _safe_get(volume, "projected", {}) or {}
            for source in _safe_get(projected, "sources", []) or []:
                proj_secret = _safe_get(source, "secret", {}) or {}
                if _safe_get(proj_secret, "name"):
                    referenced.add(str(proj_secret["name"]))

        # containers + initContainers
        for container in (_safe_get(spec, "containers", []) or []) + (_safe_get(spec, "initContainers", []) or []):
            # env[].valueFrom.secretKeyRef
            for env in _safe_get(container, "env", []) or []:
                value_from = _safe_get(env, "valueFrom", {}) or {}
                secret_ref = _safe_get(value_from, "secretKeyRef", {}) or {}
                if _safe_get(secret_ref, "name"):
                    referenced.add(str(secret_ref["name"]))
            # envFrom[].secretRef
            for env_from in _safe_get(container, "envFrom", []) or []:
                secret_ref = _safe_get(env_from, "secretRef", {}) or {}
                if _safe_get(secret_ref, "name"):
                    referenced.add(str(secret_ref["name"]))

    orphan_items: List[Dict[str, Any]] = []
    for s in secrets:
        name = str(_safe_chain(s, "metadata", "name", default=""))
        if not name or name in referenced:
            continue
        orphan_items.append({
            "name": name,
            "reason": "未被任何活跃 Pod 引用",
        })

    return {"total": len(secrets), "orphan_count": len(orphan_items), "orphan_names": [i["name"] for i in orphan_items], "orphan_items": orphan_items}


# ── Namespace calculation ──


def _resource_items(ns_snapshot: Dict[str, Any], kind: str) -> List[Dict[str, Any]]:
    return _safe_chain(ns_snapshot, "resources", kind, "items", default=[]) or []


def _namespace_labels(ns_snapshot: Dict[str, Any]) -> Dict[str, str]:
    ns_obj = _safe_get(ns_snapshot, "namespace_object", {}) or {}
    labels = _safe_chain(ns_obj, "metadata", "labels", default={}) or {}
    return {str(k): str(v) for k, v in labels.items()}


def _namespace_lifecycle_status(ns_snapshot: Dict[str, Any]) -> Dict[str, str]:
    """Extract kubestar.io/lifecycle annotations from namespace object."""
    ns_obj = _safe_get(ns_snapshot, "namespace_object", {}) or {}
    annotations = _safe_chain(ns_obj, "metadata", "annotations", default={}) or {}
    prefix = "kubestar.io/lifecycle-"

    status = annotations.get(f"{prefix}status", "")
    if not status:
        return {}

    return {
        "status": status,
        "since": annotations.get(f"{prefix}since", ""),
        "duration": annotations.get(f"{prefix}duration", ""),
        "last_transition": annotations.get(f"{prefix}last-transition", ""),
        "last_check": annotations.get(f"{prefix}last-check", ""),
        "last_pod_count": annotations.get(f"{prefix}last-pod-count", ""),
    }


def cronjob_summary(cronjobs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    for cronjob in cronjobs:
        metadata = _safe_get(cronjob, "metadata", {}) or {}
        spec = _safe_get(cronjob, "spec", {}) or {}
        items.append({
            "name": _safe_get(metadata, "name", ""),
            "schedule": _safe_get(spec, "schedule", ""),
            "suspend": bool(_safe_get(spec, "suspend", False)),
        })
    return items


def calculate_namespace(ns_name: str, ns_snapshot: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate metrics and orphan counts for a single namespace."""
    labels = _namespace_labels(ns_snapshot)
    lifecycle = _namespace_lifecycle_status(ns_snapshot)
    pods = _resource_items(ns_snapshot, "pods")
    pvcs = _resource_items(ns_snapshot, "persistentvolumeclaims")
    ingresses = _resource_items(ns_snapshot, "ingresses")
    services = _resource_items(ns_snapshot, "services")
    cronjobs = cronjob_summary(_resource_items(ns_snapshot, "cronjobs"))
    configmaps = _resource_items(ns_snapshot, "configmaps")
    secrets = _resource_items(ns_snapshot, "secrets")

    cpu_millicores = 0
    memory_bytes = 0
    storage_bytes = 0

    for pod in pods:
        spec = _safe_get(pod, "spec", {}) or {}
        for container in (_safe_get(spec, "containers", []) or []) + (_safe_get(spec, "initContainers", []) or []):
            resources = _safe_get(container, "resources", {}) or {}
            requests = _safe_get(resources, "requests", {}) or {}
            cpu_millicores += parse_cpu_millicores(_safe_get(requests, "cpu", "0"))
            memory_bytes += parse_bytes(_safe_get(requests, "memory", "0"))

    for pvc in pvcs:
        spec = _safe_get(pvc, "spec", {}) or {}
        resources = _safe_get(spec, "resources", {}) or {}
        requests = _safe_get(resources, "requests", {}) or {}
        storage_bytes += parse_bytes(_safe_get(requests, "storage", "0"))

    ingress_stats = analyze_ingresses(ingresses, services, pods)
    pvc_stats = analyze_pvcs(pvcs, pods)
    cm_stats = analyze_configmaps(configmaps, pods)
    secret_stats = analyze_secrets(secrets, pods)

    return {
        "name": ns_name,
        "labels": labels,
        "ivs": labels.get("kubestar.io/ivs", "") or "",
        "product": labels.get("kubestar.io/product", "") or "",
        "env": labels.get("kubestar.io/env", "") or "",
        "status": lifecycle.get("status", ""),
        "since": lifecycle.get("since", ""),
        "duration": lifecycle.get("duration", ""),
        "last_transition": lifecycle.get("last_transition", ""),
        "last_check": lifecycle.get("last_check", ""),
        "last_pod_count": lifecycle.get("last_pod_count", ""),
        "cpu": cpu_millicores,
        "memory": memory_bytes,
        "storage": storage_bytes,
        "pods": len(pods),
        "pvcs": len(pvcs),
        "orphan_pvcs": pvc_stats["orphan_count"],
        "orphan_pvc_names": pvc_stats["orphan_names"],
        "orphan_pvc_items": pvc_stats.get("orphan_items", []),
        "ingresses": ingress_stats["total"],
        "orphanIngresses": ingress_stats["orphan_count"],
        "orphan_ingress_names": ingress_stats["orphan_names"],
        "orphan_ingress_items": ingress_stats.get("orphan_items", []),
        "configmaps": len(configmaps),
        "orphan_configmaps": cm_stats["orphan_count"],
        "orphan_configmap_names": cm_stats["orphan_names"],
        "orphan_configmap_items": cm_stats.get("orphan_items", []),
        "secrets": len(secrets),
        "orphan_secrets": secret_stats["orphan_count"],
        "orphan_secret_names": secret_stats["orphan_names"],
        "orphan_secret_items": secret_stats.get("orphan_items", []),
        "cronjobs": cronjobs,
        # Compatibility fields
        "cpu_millicores": cpu_millicores,
        "cpu_cores": round(cpu_millicores / 1000, 3),
        "cpu_formatted": format_cpu(cpu_millicores),
        "memory_bytes": memory_bytes,
        "memory_gib": round(memory_bytes / (1024**3), 3),
        "memory_formatted": format_bytes(memory_bytes),
        "storage_bytes": storage_bytes,
        "storage_gib": round(storage_bytes / (1024**3), 3),
        "storage_formatted": format_bytes(storage_bytes),
        "pod_count": len(pods),
        "pvc_count": len(pvcs),
        "ingress_count": ingress_stats["total"],
        "orphan_ingress_count": ingress_stats["orphan_count"],
    }


# ── Report builder ──


def build_report_data(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    """Build the final report-data.json from a cluster snapshot."""
    cluster = snapshot.get("cluster", "unknown")
    ns_snapshots = snapshot.get("namespaces", {})
    node_items = _safe_chain(snapshot, "nodes", "items", default=[])
    generated_at = snapshot.get("generated_at", "")

    rows: List[Dict[str, Any]] = []
    totals = {
        "cpu_millicores": 0,
        "memory_bytes": 0,
        "storage_bytes": 0,
        "pod_count": 0,
        "pvc_count": 0,
        "orphan_pvc_count": 0,
        "ingress_count": 0,
        "orphan_ingress_count": 0,
        "configmap_count": 0,
        "orphan_configmap_count": 0,
        "secret_count": 0,
        "orphan_secret_count": 0,
        "cronjob_count": 0,
        "active_cronjob_count": 0,
    }

    for ns_name in sorted(ns_snapshots.keys()):
        try:
            ns_snapshot = ns_snapshots[ns_name]
            row = calculate_namespace(ns_name, ns_snapshot)
            rows.append(row)

            totals["cpu_millicores"] += row["cpu"]
            totals["memory_bytes"] += row["memory"]
            totals["storage_bytes"] += row["storage"]
            totals["pod_count"] += row["pods"]
            totals["pvc_count"] += row["pvcs"]
            totals["orphan_pvc_count"] += row["orphan_pvcs"]
            totals["ingress_count"] += row["ingresses"]
            totals["orphan_ingress_count"] += row["orphanIngresses"]
            totals["configmap_count"] += row["configmaps"]
            totals["orphan_configmap_count"] += row["orphan_configmaps"]
            totals["secret_count"] += row["secrets"]
            totals["orphan_secret_count"] += row["orphan_secrets"]
            totals["cronjob_count"] += len(row["cronjobs"])
            totals["active_cronjob_count"] += sum(1 for item in row["cronjobs"] if not item["suspend"])
        except Exception as exc:
            logger.error("Error calculating namespace %s: %s", ns_name, exc)
            raise

    rows.sort(key=lambda row: row["cpu"], reverse=True)

    totals.update({
        "cpu_cores": round(totals["cpu_millicores"] / 1000, 3),
        "cpu_formatted": format_cpu(totals["cpu_millicores"]),
        "memory_gib": round(totals["memory_bytes"] / (1024**3), 3),
        "memory_formatted": format_bytes(totals["memory_bytes"]),
        "storage_gib": round(totals["storage_bytes"] / (1024**3), 3),
        "storage_formatted": format_bytes(totals["storage_bytes"]),
        "namespace_count": len(rows),
        "node_count": len(node_items) if node_items else 0,
    })

    return {
        "cluster": cluster,
        "generatedAt": generated_at,
        "generated_at": generated_at,
        "totals": totals,
        "namespaces": rows,
    }
