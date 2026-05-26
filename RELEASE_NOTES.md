## k8s-mcp v0.1.2

### New Features
- **Prometheus Query Tools** (`prometheus.py`)
  - `query_prometheus` - Generic PromQL instant query tool
  - `query_prometheus_range` - PromQL range query for time-series data
  - Stateless design - URL provided per call, no session caching
  
- **Namespace Lifecycle Management** (`namespace_lifecycle.py`)
  - `manage_namespace_lifecycle` - Batch manage namespace active/idle annotations
  - `get_namespace_lifecycle_status` - Read lifecycle annotations (read-only)
  - Queries Prometheus for pod counts, computes status, applies annotations via kubectl
  - Default `dry_run=True` for safety
  - Server-side processing to minimize LLM token usage
  - Supports 170+ namespaces efficiently

### Annotation Schema
Namespaces annotated with:
- `kubestar.io/lifecycle-status` - `active` or `idle`
- `kubestar.io/lifecycle-since` - ISO 8601 timestamp when status began
- `kubestar.io/lifecycle-duration` - Duration in days (e.g., `5d`)
- `kubestar.io/lifecycle-last-transition` - Last status transition time
- `kubestar.io/lifecycle-last-check` - Last check time
- `kubestar.io/lifecycle-last-pod-count` - Pod count from last check

### Use Cases
- Identify idle namespaces for cost optimization
- Track namespace activity over time
- Automate namespace lifecycle management

### Install
```bash
pip install k8s-mcp==0.1.2
npm install -g k8s-mcp@0.1.2
```

---

## k8s-mcp v0.1.1

### Breaking Changes
- Migrated from `setup.py` to `pyproject.toml`
- Restructured to `src/` layout
- Renamed commands: `k8s-mcp-ctl` (client) and `k8s-mcp-server` (server)
- Package renamed from `kubectl_mcp_tool` to `k8s_mcp`

### New Features
- Separated client (`ctl/`) and server (`server/`) modules
- Added `k8s-mcp-ctl` CLI tool for debugging (tools, call, info, doctor)
- Added `python -m k8s_mcp.server` and `python -m k8s_mcp.ctl` module support

### Improvements
- Modern Python project structure
- Cleaner separation of concerns
- Better entry point organization

### Migration Guide
```bash
# Old commands
k8s-mcp serve          # -> k8s-mcp-server
k8s-mcp-serve          # -> k8s-mcp-server
k8s-mcp tools          # -> k8s-mcp-ctl tools
k8s-mcp call           # -> k8s-mcp-ctl call
```

### Install
```bash
pip install k8s-mcp==0.1.1
npm install -g k8s-mcp@0.1.1
```
