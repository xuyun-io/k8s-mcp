"""MCP Apps integration for k8s-inspect cluster inspection reports.

This module provides:
- A UI resource (viewer.html) for rendering inspection reports
- Tools to list reports, open the viewer, and fetch report data
- Tools to collect cluster snapshots and build inspection reports

The report data is loaded from a configurable directory on the server filesystem.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from fastmcp.tools.function_tool import ToolResult
from mcp.types import ToolAnnotations

from k8s_mcp.server.tools.inspect_snapshot_api import collect_cluster_snapshot_api, list_metadata_only
from k8s_mcp.server.tools.inspect_build import build_report_data
from k8s_mcp.server.k8s_config import get_k8s_client, get_apps_client, get_networking_client

logger = logging.getLogger("mcp-server")

K8S_INSPECT_TOOL_NAME = "k8s_inspect_open"
K8S_INSPECT_RESOURCE_URI = "ui://k8s-inspect/viewer.html"
K8S_INSPECT_RESOURCE_MIME_TYPE = "text/html;profile=mcp-app"

# Environment variable to override default inspection data directory
K8S_INSPECT_DATA_DIR_ENV = "K8S_INSPECT_DATA_DIR"

# Default: ~/.k8s-mcp/inspections
DEFAULT_INSPECT_DIR = Path.home() / ".k8s-mcp" / "inspections"


def _get_inspect_dir() -> Path:
    configured = os.environ.get(K8S_INSPECT_DATA_DIR_ENV)
    if configured:
        return Path(configured).expanduser()
    return DEFAULT_INSPECT_DIR


def _list_reports(cluster: str = "") -> List[Dict[str, Any]]:
    """List available inspection reports on disk.

    Directory structure expected:
        <inspect_dir>/<cluster>/<reportId>/report-data.json
    """
    inspect_dir = _get_inspect_dir()
    results: List[Dict[str, Any]] = []

    clusters = [cluster] if cluster else _list_subdirs(inspect_dir)

    for cl in clusters:
        cluster_path = inspect_dir / cl
        if not cluster_path.is_dir():
            continue
        for report_dir in sorted(cluster_path.iterdir()):
            if not report_dir.is_dir():
                continue
            data_file = report_dir / "report-data.json"
            if not data_file.is_file():
                continue
            try:
                stat = data_file.stat()
                mtime = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()
                with data_file.open("r", encoding="utf-8") as f:
                    data = json.load(f)
                totals = data.get("totals", {})
                results.append({
                    "reportId": report_dir.name,
                    "cluster": cl,
                    "generatedAt": data.get("generatedAt", mtime),
                    "namespaceCount": len(data.get("namespaces", [])),
                    "podCount": totals.get("pod_count", 0),
                    "sizeBytes": stat.st_size,
                })
            except Exception as exc:
                logger.debug("Failed to read report %s: %s", data_file, exc)
                continue

    # Sort by generatedAt descending (newest first)
    results.sort(key=lambda r: r.get("generatedAt", ""), reverse=True)
    return results


def _list_subdirs(path: Path) -> List[str]:
    if not path.is_dir():
        return []
    return sorted([p.name for p in path.iterdir() if p.is_dir()])


def _load_report_data(cluster: str, report_id: str) -> Optional[Dict[str, Any]]:
    """Load report-data.json from disk."""
    inspect_dir = _get_inspect_dir()
    if not cluster:
        # Try to infer cluster from report_id if directory exists under any cluster
        for cl in _list_subdirs(inspect_dir):
            candidate = inspect_dir / cl / report_id / "report-data.json"
            if candidate.is_file():
                cluster = cl
                break

    if not cluster:
        return None

    data_file = inspect_dir / cluster / report_id / "report-data.json"
    if not data_file.is_file():
        return None

    try:
        with data_file.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as exc:
        logger.error("Failed to load report data %s: %s", data_file, exc)
        return None


def _resolve_latest_report(cluster: str) -> Optional[str]:
    """Find the latest report ID for a cluster."""
    reports = _list_reports(cluster)
    return reports[0]["reportId"] if reports else None


def register_k8s_inspect_tools(server: "FastMCP", non_destructive: bool) -> None:
    """Register k8s-inspect MCP App resource and tools."""

    @server.resource(
        K8S_INSPECT_RESOURCE_URI,
        title="K8s Inspect Viewer",
        mime_type=K8S_INSPECT_RESOURCE_MIME_TYPE,
        meta=get_k8s_inspect_resource_meta(),
    )
    def k8s_inspect_viewer_resource() -> str:
        """Return the single-file HTML bundle for the inspection viewer."""
        return read_inspect_viewer_html()

    @server.tool(
        name="k8s_inspect_list",
        annotations=ToolAnnotations(
            title="List Inspection Reports",
            readOnlyHint=True,
            destructiveHint=False,
            idempotentHint=True,
            openWorldHint=True,
        ),
    )
    def k8s_inspect_list(
        cluster: str = "",
        limit: int = 50,
    ) -> Dict[str, Any]:
        """List available cluster inspection reports.

        Args:
            cluster: Filter by cluster name. Empty lists all clusters.
            limit: Maximum number of reports to return.

        Returns:
            {
                "success": true,
                "reports": [
                    {
                        "reportId": "2026-05-29",
                        "cluster": "prod",
                        "generatedAt": "2026-05-29T02:00:00+00:00",
                        "namespaceCount": 153,
                        "podCount": 729,
                        "sizeBytes": 163840
                    }
                ]
            }
        """
        try:
            reports = _list_reports(cluster)
            return {
                "success": True,
                "cluster": cluster or "all",
                "count": len(reports),
                "reports": reports[:limit],
            }
        except Exception as exc:
            logger.error("Error listing inspection reports: %s", exc)
            return {"success": False, "error": str(exc)}

    @server.tool(
        name=K8S_INSPECT_TOOL_NAME,
        annotations=ToolAnnotations(
            title="Open Inspection Report",
            readOnlyHint=True,
            destructiveHint=False,
            idempotentHint=True,
            openWorldHint=True,
        ),
        meta=get_k8s_inspect_tool_meta(),
    )
    def k8s_inspect_open(
        report_id: str = "latest",
        cluster: str = "",
    ) -> ToolResult:
        """Open a cluster inspection report in the MCP App viewer.

        Args:
            report_id: Report identifier (e.g. '2026-05-29'). Use 'latest' for newest.
            cluster: Cluster name. If empty, inferred from report directories.

        Returns:
            {
                "success": true,
                "reportId": "2026-05-29",
                "cluster": "prod",
                "generatedAt": "2026-05-29T02:00:00+00:00",
                "summary": {
                    "namespaceCount": 153,
                    "podCount": 729,
                    "cpuCores": 92.73,
                    "memoryGi": 283.97
                },
                "resourceUri": "ui://k8s-inspect/viewer.html"
            }
        """
        try:
            resolved_id = report_id
            if report_id == "latest":
                resolved_id = _resolve_latest_report(cluster) or report_id
                if resolved_id != report_id and not cluster:
                    # Infer cluster from the resolved report
                    for cl in _list_subdirs(_get_inspect_dir()):
                        if (_get_inspect_dir() / cl / resolved_id / "report-data.json").is_file():
                            cluster = cl
                            break

            data = _load_report_data(cluster, resolved_id)
            if not data:
                result = {
                    "success": False,
                    "error": f"Report not found: {resolved_id} (cluster={cluster or 'auto'}). "
                    f"Run inspection pipeline first or check {K8S_INSPECT_DATA_DIR_ENV}.",
                }
                return result

            totals = data.get("totals", {})
            result = {
                "success": True,
                "reportId": resolved_id,
                "cluster": data.get("cluster", cluster or "unknown"),
                "generatedAt": data.get("generatedAt", ""),
                "summary": {
                    "namespaceCount": len(data.get("namespaces", [])),
                    "podCount": totals.get("pod_count", 0),
                    "cpuCores": totals.get("cpu_cores", 0),
                    "memoryGi": totals.get("memory_gib", 0),
                },
                "resourceUri": K8S_INSPECT_RESOURCE_URI,
            }

            return ToolResult(
                content=result,
                structured_content=result,
                meta={"ui": {"resourceUri": K8S_INSPECT_RESOURCE_URI}},
            )
        except Exception as exc:
            logger.error("Error opening inspection report: %s", exc)
            return {"success": False, "error": str(exc)}

    @server.tool(
        name="k8s_inspect_report_data",
        annotations=ToolAnnotations(
            title="Get Inspection Report Data",
            readOnlyHint=True,
            destructiveHint=False,
            idempotentHint=True,
            openWorldHint=True,
        ),
        meta={
            "ui": {
                "visibility": ["app"],
            }
        },
    )
    def k8s_inspect_report_data(
        report_id: str = "latest",
        cluster: str = "",
    ) -> Dict[str, Any]:
        """Return full inspection report data for the viewer.

        This tool is app-only and returns the complete report payload (~160KB).
        It should not be called directly by the model.

        Args:
            report_id: Report identifier. 'latest' resolves to newest.
            cluster: Cluster name. Auto-inferred if empty.

        Returns:
            Full report-data.json object with cluster, totals, namespaces.
        """
        try:
            resolved_id = report_id
            if report_id == "latest":
                resolved_id = _resolve_latest_report(cluster) or report_id
                if resolved_id != report_id and not cluster:
                    for cl in _list_subdirs(_get_inspect_dir()):
                        if (_get_inspect_dir() / cl / resolved_id / "report-data.json").is_file():
                            cluster = cl
                            break

            data = _load_report_data(cluster, resolved_id)
            if not data:
                return {
                    "success": False,
                    "error": f"Report not found: {resolved_id}",
                }

            return {
                "success": True,
                "reportId": resolved_id,
                "cluster": data.get("cluster", cluster or "unknown"),
                "generatedAt": data.get("generatedAt", ""),
                **data,
            }
        except Exception as exc:
            logger.error("Error loading report data: %s", exc)
            return {"success": False, "error": str(exc)}

    @server.tool(
        name="k8s_inspect_run",
        annotations=ToolAnnotations(
            title="Run Cluster Inspection",
            readOnlyHint=True,
            destructiveHint=False,
            idempotentHint=False,
            openWorldHint=True,
        ),
    )
    def k8s_inspect_run(
        namespaces: str = "all",
        exclude: str = "kube-system,kube-public,kube-node-lease",
        context: str = "",
        cluster: str = "",
        report_id: str = "",
        timeout: int = 60,
    ) -> Dict[str, Any]:
        """Collect cluster snapshot and build inspection report.

        This tool gathers live Kubernetes data, analyzes orphan resources
        (PVCs, Ingresses, ConfigMaps, Secrets), and saves the report
        to the standard inspection directory.

        Args:
            namespaces: Comma-separated namespace names, or 'all' for all non-excluded.
            exclude: Comma-separated namespaces to exclude when namespaces='all'.
            context: kubectl context to use.
            cluster: Cluster name for metadata. Auto-detected if empty.
            report_id: Report identifier. Defaults to YYYYMMDD if empty.
            timeout: Per-API-call timeout in seconds.

        Returns:
            {
                "success": true,
                "reportId": "20260529",
                "cluster": "prod",
                "outputPath": "~/.k8s-mcp/inspections/prod/20260529/report-data.json",
                "summary": {
                    "namespaceCount": 153,
                    "podCount": 729,
                    "cpuCores": 92.73,
                    "memoryGi": 283.97,
                    "nodeCount": 12,
                    "orphanPvcCount": 5,
                    "orphanIngressCount": 3,
                    "orphanConfigmapCount": 12,
                    "orphanSecretCount": 8
                },
                "resourceUri": "ui://k8s-inspect/viewer.html"
            }
        """
        try:
            import re
            from datetime import datetime as dt

            # Resolve target namespaces
            if namespaces.lower() == "all":
                target_namespaces = None  # collect all (excluding system ns in snapshot api)
            else:
                target_namespaces = [n.strip() for n in namespaces.split(",") if n.strip()]

            # Resolve cluster name
            resolved_cluster = cluster or context or "unknown"
            if not cluster and context:
                resolved_cluster = context

            # Resolve report_id
            resolved_report_id = report_id or dt.now().strftime("%Y%m%d")
            # Sanitize for filename
            safe_cluster = re.sub(r"[^a-zA-Z0-9_.-]", "-", resolved_cluster).strip("-.") or "unknown"

            # 1. Collect snapshot
            logger.info("k8s_inspect_run: collecting snapshot for cluster=%s", resolved_cluster)
            try:
                snapshot = collect_cluster_snapshot_api(
                    context=context,
                    namespaces=target_namespaces,
                    timeout=timeout,
                )
            except Exception as e:
                logger.error(f"k8s_inspect_run: failed to collect snapshot: {e}")
                return {
                    "success": False,
                    "error": "Failed to collect cluster snapshot. Check permissions and API server connectivity.",
                }

            # Override cluster name if provided
            if cluster:
                snapshot["cluster"] = cluster
            resolved_cluster = snapshot.get("cluster", resolved_cluster)
            safe_cluster = re.sub(r"[^a-zA-Z0-9_.-]", "-", resolved_cluster).strip("-.") or "unknown"

            # 2. Build report data
            logger.info("k8s_inspect_run: building report data")
            report_data = build_report_data(snapshot)

            # 3. Save to standard directory
            inspect_dir = _get_inspect_dir()
            output_dir = inspect_dir / safe_cluster / resolved_report_id
            output_dir.mkdir(parents=True, exist_ok=True)
            output_path = output_dir / "report-data.json"

            with output_path.open("w", encoding="utf-8") as f:
                json.dump(report_data, f, ensure_ascii=False, indent=2)

            totals = report_data.get("totals", {})
            summary = {
                "namespaceCount": len(report_data.get("namespaces", [])),
                "podCount": totals.get("pod_count", 0),
                "cpuCores": totals.get("cpu_cores", 0),
                "memoryGi": totals.get("memory_gib", 0),
                "nodeCount": totals.get("node_count", 0),
                "orphanPvcCount": totals.get("orphan_pvc_count", 0),
                "orphanIngressCount": totals.get("orphan_ingress_count", 0),
                "orphanConfigmapCount": totals.get("orphan_configmap_count", 0),
                "orphanSecretCount": totals.get("orphan_secret_count", 0),
            }

            logger.info("k8s_inspect_run: report saved to %s", output_path)

            return {
                "success": True,
                "reportId": resolved_report_id,
                "cluster": resolved_cluster,
                "outputPath": str(output_path),
                "summary": summary,
                "resourceUri": K8S_INSPECT_RESOURCE_URI,
            }

        except Exception as exc:
            logger.error("Error running inspection: %s", exc)
            return {"success": False, "error": str(exc)}

    @server.tool(
        name="k8s_inspect_namespace_detail",
        annotations=ToolAnnotations(
            title="Get Namespace Detail",
            readOnlyHint=True,
            destructiveHint=False,
            idempotentHint=True,
            openWorldHint=True,
        ),
        meta={"ui": {"visibility": ["app"]}},
    )
    def k8s_inspect_namespace_detail(
        namespace: str,
        context: str = "",
    ) -> Dict[str, Any]:
        """Return detailed information for a single namespace.

        This is an app-only tool for the inspect viewer drill-down.
        It returns pods, services, deployments, ingresses, pvcs, configmaps,
        secrets, and recent events in the namespace.

        Args:
            namespace: Target namespace name (required).
            context: kubectl context to use.

        Returns:
            {
                "success": true,
                "namespace": "default",
                "pods": [...],
                "services": [...],
                "deployments": [...],
                "ingresses": [...],
                "pvcs": [...],
                "configmaps": [...],
                "secrets": [...],
                "events": [...]
            }
        """
        from concurrent.futures import ThreadPoolExecutor, as_completed

        v1 = get_k8s_client(context)
        apps_v1 = get_apps_client(context)
        networking_v1 = get_networking_client(context)

        def _safe_call(label: str, fn, default):
            """Execute an API call with timeout and return default on failure."""
            try:
                return fn()
            except Exception as exc:
                logger.warning("k8s_inspect_namespace_detail: %s failed: %s", label, exc)
                return default

        def fetch_pods():
            pod_list = v1.list_namespaced_pod(namespace, _request_timeout=15)
            return [
                {
                    "name": p.metadata.name,
                    "phase": p.status.phase if p.status else "Unknown",
                    "ready": f"{sum(1 for c in (p.status.container_statuses or []) if c.ready)}/{len(p.spec.containers or [])}",
                    "restarts": sum((c.restart_count or 0) for c in (p.status.container_statuses or [])),
                    "node": p.spec.node_name,
                    "ip": p.status.pod_ip if p.status else None,
                    "age": _age_str(p.metadata.creation_timestamp),
                }
                for p in pod_list.items
            ]

        def fetch_services():
            svc_list = v1.list_namespaced_service(namespace, _request_timeout=10)
            return [
                {
                    "name": s.metadata.name,
                    "type": s.spec.type,
                    "cluster_ip": s.spec.cluster_ip,
                    "ports": [f"{p.port}/{p.protocol}" for p in (s.spec.ports or [])],
                }
                for s in svc_list.items
            ]

        def fetch_deployments():
            dep_list = apps_v1.list_namespaced_deployment(namespace, _request_timeout=10)
            return [
                {
                    "name": d.metadata.name,
                    "replicas": f"{d.status.ready_replicas or 0}/{d.spec.replicas or 0}",
                    "age": _age_str(d.metadata.creation_timestamp),
                }
                for d in dep_list.items
            ]

        def fetch_ingresses():
            ing_list = networking_v1.list_namespaced_ingress(namespace, _request_timeout=10)
            result = []
            for ing in ing_list.items:
                hosts = [rule.host for rule in (ing.spec.rules or []) if rule.host]
                result.append({
                    "name": ing.metadata.name,
                    "hosts": hosts,
                    "age": _age_str(ing.metadata.creation_timestamp),
                })
            return result

        def fetch_pvcs():
            pvc_list = v1.list_namespaced_persistent_volume_claim(namespace, _request_timeout=10)
            return [
                {
                    "name": p.metadata.name,
                    "status": p.status.phase if p.status else "Unknown",
                    "capacity": (p.status.capacity or {}).get("storage", "") if p.status else "",
                    "storage_class": p.spec.storage_class_name,
                }
                for p in pvc_list.items
            ]

        def fetch_configmaps():
            # Use metadata-only query to avoid downloading huge data fields
            items = list_metadata_only(v1.api_client, f"/api/v1/namespaces/{namespace}/configmaps")
            return [{"name": item["metadata"].get("name", "")} for item in items if item["metadata"].get("name")]

        def fetch_secrets():
            # Use metadata-only query to avoid downloading sensitive data
            items = list_metadata_only(v1.api_client, f"/api/v1/namespaces/{namespace}/secrets")
            return [{"name": item["metadata"].get("name", ""), "type": item.get("type", "Opaque")} for item in items if item["metadata"].get("name")]

        def fetch_events():
            event_list = v1.list_namespaced_event(namespace, limit=50, _request_timeout=10)
            return [
                {
                    "type": e.type,
                    "reason": e.reason,
                    "message": e.message,
                    "involved_object": e.involved_object.name if e.involved_object else "",
                    "count": e.count,
                    "last_seen": _age_str(e.last_timestamp) if e.last_timestamp else "",
                }
                for e in event_list.items
            ]

        try:
            tasks = {
                "pods": (fetch_pods, []),
                "services": (fetch_services, []),
                "deployments": (fetch_deployments, []),
                "ingresses": (fetch_ingresses, []),
                "pvcs": (fetch_pvcs, []),
                "configmaps": (fetch_configmaps, []),
                "secrets": (fetch_secrets, []),
                "events": (fetch_events, []),
            }

            results: Dict[str, Any] = {}
            with ThreadPoolExecutor(max_workers=6) as executor:
                futures = {
                    executor.submit(_safe_call, name, fn, default): name
                    for name, (fn, default) in tasks.items()
                }
                for future in as_completed(futures):
                    name = futures[future]
                    try:
                        results[name] = future.result()
                    except Exception as exc:
                        logger.warning("k8s_inspect_namespace_detail: %s exception: %s", name, exc)
                        results[name] = tasks[name][1]

            return {
                "success": True,
                "namespace": namespace,
                "pods": results.get("pods", []),
                "services": results.get("services", []),
                "deployments": results.get("deployments", []),
                "ingresses": results.get("ingresses", []),
                "pvcs": results.get("pvcs", []),
                "configmaps": results.get("configmaps", []),
                "secrets": results.get("secrets", []),
                "events": results.get("events", []),
            }
        except Exception as exc:
            logger.error("Error getting namespace detail: %s", exc)
            return {"success": False, "error": str(exc)}


def _age_str(dt_obj):
    """Convert datetime to human-readable age string."""
    if not dt_obj:
        return ""
    from datetime import datetime, timezone
    if dt_obj.tzinfo is None:
        dt_obj = dt_obj.replace(tzinfo=timezone.utc)
    delta = datetime.now(timezone.utc) - dt_obj
    days = delta.days
    hours, remainder = divmod(int(delta.total_seconds()) - days * 86400, 3600)
    minutes = remainder // 60
    if days > 0:
        return f"{days}d"
    if hours > 0:
        return f"{hours}h"
    return f"{minutes}m"


def read_inspect_viewer_html() -> str:
    """Read the built React single-file bundle, falling back to placeholder."""
    for path in _candidate_viewer_paths():
        if path.is_file():
            return path.read_text(encoding="utf-8")

    return """<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>集群巡检报告</title></head>
<body>
<main style="font-family: system-ui, sans-serif; padding: 24px;">
<h1>集群巡检报告</h1>
<p>The UI bundle was not found. Run <code>npm run build:inspect</code> in k8s-mcp-apps.</p>
</main>
</body>
</html>"""


def get_k8s_inspect_tool_meta() -> Dict[str, Any]:
    return {
        "ui": {
            "resourceUri": K8S_INSPECT_RESOURCE_URI,
            "visibility": ["model", "app"],
        },
        "ui/resourceUri": K8S_INSPECT_RESOURCE_URI,
    }


def get_k8s_inspect_resource_meta() -> Dict[str, Any]:
    return {
        "ui": {
            "csp": {
                "connectDomains": [],
                "resourceDomains": [],
                "frameDomains": [],
                "baseUriDomains": [],
            },
            "prefersBorder": True,
        }
    }


def get_k8s_inspect_resource_descriptor() -> Dict[str, Any]:
    return {
        "uri": K8S_INSPECT_RESOURCE_URI,
        "name": "k8s-inspect-viewer",
        "title": "K8s Inspect Viewer",
        "description": "Interactive cluster inspection report viewer.",
        "mimeType": K8S_INSPECT_RESOURCE_MIME_TYPE,
        "_meta": get_k8s_inspect_resource_meta(),
    }


def _candidate_viewer_paths() -> List[Path]:
    configured_dist = os.environ.get("K8S_MCP_APP_DIST")
    candidates: List[Path] = []

    if configured_dist:
        candidates.append(Path(configured_dist) / "k8s-inspect-viewer.html")

    current = Path(__file__).resolve()
    for parent in current.parents:
        candidates.append(parent / "k8s-mcp-apps" / "inspect" / "dist" / "viewer.html")
        candidates.append(parent / "k8s-mcp-apps" / "inspect" / "dist" / "index.html")

    candidates.append(current.parent.parent / "app_dist" / "k8s-inspect-viewer.html")
    return candidates
