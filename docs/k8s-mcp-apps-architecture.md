# k8s-mcp-apps 技术架构草案

状态：Implemented v1，Pods Viewer 和 Inspect Viewer 已迁移到统一的 `k8s-mcp-apps/` 目录

## 目标

在现有 `k8s-mcp` 项目中使用 `k8s-mcp-apps/` 管理 MCP Apps 前端：后端继续使用现有 Python MCP Server、FastMCP 和 Kubernetes Python client；前端使用 React + Vite 打包为单文件 HTML；Goose 通过 Streamable HTTP 连接 MCP Server。

当前包含 Pods Viewer 和 Inspect Viewer。后续可以继续在 `k8s-mcp-apps/` 下扩展 logs、deploy、helm、network 等交互式页面。

## 关键约束

- 不新增 TypeScript MCP Server。官方 Quickstart 使用 TypeScript server 只是示例，本项目后端保持 Python。
- MCP Apps 的核心形态是 `Tool + UI Resource`：tool 的 `_meta.ui.resourceUri` 指向一个 `ui://` resource。
- UI resource 必须使用 `ui://` URI，并以 `text/html;profile=mcp-app` 返回完整 HTML。
- React App 不直接 `fetch` Kubernetes API，也不直接绕过 host 调用 `/mcp`。iframe 内的 View 通过 `@modelcontextprotocol/ext-apps` 与 host 通信，由 host 调用 MCP tools。
- 后端 Kubernetes 权限沿用当前 MCP Server 的 kubeconfig、context、RBAC 和 in-cluster 配置，不在前端保存任何凭据。
- 第一版只读，不做 scale、delete、rollback 等变更动作。变更类操作放到后续版本并加确认流程。

## Goose 适配结论

Goose Desktop 可以作为第一版目标 host：

- Goose 文档明确支持 MCP Apps 和 MCP-UI，其中 MCP Apps 是推荐的新路径，但仍标记为 experimental。
- Goose Desktop 支持在聊天窗口内渲染 tool 返回的交互式 UI，也支持部分 MCP Apps 以独立 sandbox window 启动。
- Goose 支持 Remote Extension over Streamable HTTP，可以通过 `/mcp` endpoint 接入远程或本地 MCP server。
- Goose CLI 可以通过 `--with-streamable-http-extension` 加载同一个 MCP server，但 CLI 场景主要验证 tool 可调用性；React iframe UI 以 Goose Desktop 验证为准。

第一版适配目标：

```bash
kubectl-mcp-server serve --transport streamable-http --port 8000
goose session --with-streamable-http-extension "http://localhost:8000/mcp"
```

Goose Desktop 配置时选择：

```text
Add Extension -> Remote Extension (Streamable HTTP)
Endpoint URI -> http://localhost:8000/mcp
```

注意：Goose 的 MCP Apps 支持仍在实验阶段，行为可能随版本变化。第一版应尽量保持协议标准、资源内联、无外部网络依赖，降低适配风险。

## 目录设计

```text
k8s-mcp/
├── k8s-mcp-apps/
│   ├── package.json
│   ├── pods/
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── src/
│   │   └── dist/
│   │       └── index.html
│   └── inspect/
│       ├── package.json
│       ├── vite.config.ts
│       ├── src/
│       └── dist/
│           └── index.html
├── src/
│   └── k8s_mcp/
│       └── server/
│           ├── core.py
│           └── tools/
│               └── k8s_app.py
└── docs/
    └── k8s-mcp-apps-architecture.md
```

`pods/dist/index.html` 和 `inspect/dist/index.html` 是 Vite single-file 构建产物。建议提交这些文件，保证 Goose Desktop 引用本地 Python MCP server 时可以直接读取 UI resource；后续发布 Python wheel 时再整理构建流水线。

## 后端设计

新增 `src/k8s_mcp/server/tools/k8s_app.py`，只承载 MCP Apps 相关注册，避免和已有 Kubernetes tools 混在一起。

## 现有 MCP Resources 现状

当前 server 的普通 MCP resources 集中在 `src/k8s_mcp/server/resources/resources.py`，由 `MCPServer.setup_resources()` 调用 `register_resources(self.server)` 注册。资源使用 FastMCP 的 `@server.resource(...)` 装饰器，主要返回 JSON/YAML 字符串：

- `kubeconfig://contexts`、`kubeconfig://current-context`
- `namespace://current`、`namespace://list`
- `cluster://info`、`cluster://nodes`、`cluster://version`、`cluster://api-resources`
- `manifest://template/...` 系列模板资源

这些 resource 目前是给模型读取的文本/结构化上下文，不是 UI resource。MCP Apps 使用独立的 `ui://...` resource，MIME 使用 `text/html;profile=mcp-app`。自定义 HTTP fallback 也补充了 `resources/list` 和 `resources/read` 对这些 app resource 的支持；FastMCP 原生 Streamable HTTP 继续走框架自己的 resource 处理。

### UI Resource

资源 URI：

```text
ui://k8s-mcp-apps/pods.html
```

资源内容：

- 读取 `k8s-mcp-apps/pods/dist/index.html`
- MIME：`text/html;profile=mcp-app`
- `_meta.ui.prefersBorder: true`
- 第一版不声明 `connectDomains`，因为 iframe 不直接访问外部 API

### Tool 划分

第一版只注册一个 tool：

`k8s_app_pods`

- 面向 model 和 app 可见，UI 刷新也复用同一个 tool。
- 输入：`context?: string`，`namespace?: string = "default"`，`limit?: int = 50`。
- 行为：调用 Kubernetes Python client 查询 Pods，按 phase 统计并返回前 `limit` 个 Pod 的简化信息。
- 输出：
  - `content`：简短文字摘要，给 LLM 使用。
  - `structuredContent`：Pod 统计和列表，给 UI 使用。
  - `_meta.ui.resourceUri`：`ui://k8s-mcp-apps/pods.html`。

后续可以补更多 app-only tools：

- `k8s_app_pod_logs_tool`：app-only，按 namespace/pod/container 拉取最近日志
- `k8s_app_workload_detail_tool`：app-only，打开 Deployment/StatefulSet 详情
- `k8s_app_events_tool`：app-only，按 namespace、kind、name 过滤事件

### Kubernetes 数据访问

第一版只需要 CoreV1Api：

- `list_namespaced_pod(namespace, limit=limit)`：指定 namespace。
- `list_pod_for_all_namespaces(limit=limit)`：当 namespace 显式传入 `all` 或空值策略确认后再启用。

后端聚合为稳定 JSON schema，避免前端依赖 Kubernetes Python client 原始对象结构。

示例 schema：

```json
{
  "context": "dev-cluster",
  "namespace": "default",
  "generatedAt": "2026-05-28T10:00:00Z",
  "pods": {
    "total": 42,
    "running": 39,
    "pending": 1,
    "failed": 2,
    "unknown": 0,
    "items": [
      {
        "name": "nginx-7d8b49557c-x2j8p",
        "namespace": "default",
        "phase": "Running",
        "ready": "1/1",
        "restarts": 0,
        "nodeName": "kind-worker",
        "ageSeconds": 3600
      }
    ]
  }
}
```

## 前端设计

React App 使用 `@modelcontextprotocol/ext-apps` 或 `@modelcontextprotocol/ext-apps/react`：

- 初始化 App 并连接 host
- 接收初始 tool result
- 用 `app.callServerTool()` 调用 app-only refresh/detail tools
- 读取 host theme、locale、timezone，适配亮暗色和时间格式

第一版页面结构：

- 顶部：context、namespace、刷新按钮、数据时间。
- 概览：Pod 总数、Running、Pending、Failed、Unknown。
- 主体：Pod 简表，展示 name、namespace、phase、ready、restarts、node、age。
- 错误态：Kubernetes API 错误、context 不存在、RBAC 权限不足。

前端只做展示和轻量交互，不存储 kubeconfig，不实现独立认证。

## 通信流程

```mermaid
sequenceDiagram
    participant Host as MCP Host
    participant Server as Python MCP Server
    participant View as React View iframe
    participant K8s as Kubernetes API

    Host->>Server: initialize over Streamable HTTP /mcp
    Host->>Server: tools/list
    Server-->>Host: k8s_app_pods_tool with _meta.ui.resourceUri
    Host->>Server: tools/call k8s_app_pods_tool
    Server->>K8s: list namespaced pods
    K8s-->>Server: Kubernetes objects
    Server-->>Host: content + structuredContent
    Host->>Server: resources/read ui://k8s-mcp-apps/pods.html
    Server-->>Host: text/html;profile=mcp-app
    Host->>View: render iframe + send tool result
    View->>Host: app.callServerTool(k8s_app_pods_tool)
    Host->>Server: tools/call k8s_app_pods_tool
    Server-->>Host: refreshed structuredContent
    Host-->>View: tool result
```

## Streamable HTTP

运行方式沿用现有 server：

```bash
kubectl-mcp-server serve --transport streamable-http --port 8000
```

Goose CLI 连接：

```bash
goose session --with-streamable-http-extension "http://localhost:8000/mcp"
```

Goose Desktop 连接时，在 Extensions 里添加 Remote Extension，endpoint 填 `http://localhost:8000/mcp`。UI 渲染以 Goose Desktop 为主要验收对象；CLI 只验收 tool 可发现和可调用。

## 安全设计

- iframe 由 MCP Host sandbox，不能访问 host DOM、cookies 或本地 kubeconfig。
- 第一版 resource 不声明外部 `connectDomains`，默认 CSP 禁止外部网络连接。
- 所有 Kubernetes 访问只发生在 Python server 端，遵循当前 context 和 RBAC。
- tool 输出需要按 `limit` 截断，避免一次性返回过多 Pods。
- 第一版只有一个只读 tool；危险操作后续必须增加确认和审计字段。

## 构建与发布

`k8s-mcp-apps/package.json` 统一入口脚本：

```json
{
  "scripts": {
    "build": "npm run build:pods && npm run build:inspect",
    "build:pods": "cd pods && npm run build",
    "build:inspect": "cd inspect && npm run build",
    "dev:pods": "cd pods && npm run dev",
    "dev:inspect": "cd inspect && npm run dev"
  }
}
```

Vite 配置使用 single-file 输出，产物名为 `index.html`，由 Python resource 查找。

Python package 侧需要确认：

- `pyproject.toml` 或 package data 是否包含 `k8s-mcp-apps/*/dist/*.html`
- Dockerfile 是否需要增加 Node build 阶段
- CI 是否先构建前端再运行 Python 测试

## 测试策略

后端：

- 单元测试：schema 聚合、状态计数、异常降级
- Mock Kubernetes client：覆盖 RBAC error、context 不存在、空 namespace、Pod phase 缺失
- MCP smoke test：`tools/list` 可见 `_meta.ui.resourceUri`，`resources/read` 返回正确 MIME

前端：

- Vitest：Pod 数据格式化、状态统计、错误态
- Playwright：在 Goose Desktop 或 ext-apps basic-host 中渲染 iframe，验证首屏非空、刷新按钮可调用 tool

端到端：

- kind cluster 可选：启动 kind，部署少量 nginx Pods，连接 streamable-http server，验证 Pods UI 数据

## 已确认决策

- 第一版只做 Pods Viewer。
- `pods/dist/index.html` 和 `inspect/dist/index.html` 作为构建产物保留在 `k8s-mcp-apps/*/dist/`，方便本地 Python server 直接作为 `ui://` resource 读取。
- 前端使用核心 `@modelcontextprotocol/ext-apps`，暂不使用 React 专用封装，减少首版依赖面。
- 后端保持 Python FastMCP，不新增 TypeScript MCP server。
- Goose Desktop 作为 UI 验收目标；Goose CLI 主要验证 Streamable HTTP extension 和 tool 可调用性。

## 已完成实施

1. 新增 `k8s-mcp-apps/` React + Vite single-file app collection。
2. 新增 Python `k8s_app.py`，注册 UI resource 和 `k8s_app_pods`。
3. 接入 `src/k8s_mcp/server/core.py` 的 tool 注册流程，并把 `app` 加入默认启用模块。
4. 补充 custom HTTP fallback 的 `tools/list` metadata、`tools/call` structured content、`resources/list`、`resources/read` 兼容。
5. 增加后端聚合测试和 resource MIME 测试。
6. 增加前端基础数据解析测试。

## 参考资料

- MCP Apps Quickstart: https://apps.extensions.modelcontextprotocol.io/api/documents/Quickstart.html
- ext-apps GitHub repo: https://github.com/modelcontextprotocol/ext-apps
- MCP Apps Overview: https://apps.extensions.modelcontextprotocol.io/api/documents/Overview.html
- MCP Apps specification: https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx
- FastMCP resources metadata: https://fastmcp.wiki/en/servers/resources
