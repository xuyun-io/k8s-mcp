# k8s-mcp 入口点分析

## 概览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           k8s-mcp 入口点总览                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        npm 包 (k8s-mcp)                              │   │
│  │  ┌─────────────┐  ┌─────────────────────────────────────────────┐  │   │
│  │  │  npx k8s-mcp │  │  npm install -g k8s-mcp                    │  │   │
│  │  │  (临时运行)  │  │  k8s-mcp (全局命令)                         │  │   │
│  │  └──────┬──────┘  └──────────────────┬────────────────────────┘  │   │
│  │         │                             │                         │   │
│  │         └─────────────┬───────────────┘                         │   │
│  │                       ▼                                         │   │
│  │              ┌─────────────────┐                               │   │
│  │              │   bin/cli.js    │                               │   │
│  │              │   (Node.js 包装器) │                               │   │
│  │              └────────┬────────┘                               │   │
│  │                       │                                         │   │
│  │         ┌─────────────┼─────────────┐                         │   │
│  │         │             │             │                         │   │
│  │         ▼             ▼             ▼                         │   │
│  │    检查 Python    安装 Python    启动 Python                   │   │
  │    是否安装       包 (pip)       服务器                        │   │
  │         │             │             │                         │   │
  │         └─────────────┴─────────────┘                         │   │
  │                       │                                         │   │
  │                       ▼                                         │   │
  │         python -m k8s_mcp.mcp_server                   │   │
  │                       │                                         │   │
  │                       ▼                                         │   │
  │              ┌─────────────────┐                               │   │
  │              │   mcp_server.py  │                               │   │
  │              │  (直接启动服务器)  │                               │   │
  │              └─────────────────┘                               │   │
  │                                                                 │   │
  └─────────────────────────────────────────────────────────────────┘   │
                                    │                                     │
                                    │                                     │
  ┌─────────────────────────────────┼─────────────────────────────────┐ │
  │                        pip 包 (k8s-mcp)                            │ │
  │  ┌──────────────────────────────┼──────────────────────────────┐  │ │
  │  │                              │                              │  │ │
  │  │  ┌─────────────────┐        │        ┌─────────────────┐  │  │ │
  │  │  │   k8s-mcp        │        │        │  k8s-mcp-server   │  │  │ │
  │  │  │   (CLI 工具)     │        │        │  (服务器启动)     │  │  │ │
  │  │  │                  │        │        │                  │  │  │
  │  │  │  k8s_mcp│        │        │k8s_mcp  │  │  │ │
  │  │  │  .cli:main       │        │        │.__main__:main    │  │  │ │
  │  │  └────────┬────────┘        │        └────────┬────────┘  │  │ │
  │  │           │                 │                 │           │  │ │
  │  │           ▼                 │                 ▼           │  │ │
  │  │  ┌─────────────────┐       │       ┌─────────────────┐   │  │ │
  │  │  │    cli/cli.py   │       │       │   __main__.py   │   │  │ │
  │  │  │                 │       │       │                 │   │  │ │
  │  │  │  tools/call/    │       │       │  --transport    │   │  │ │
  │  │  │  info/doctor    │       │       │  --port/--host  │   │  │ │
  │  │  └────────┬────────┘       │       └────────┬────────┘   │  │ │
  │  │           │                │                │            │  │ │
  │  │           │                │                │            │  │ │
  │  │           └────────────────┴────────────────┘            │  │ │
  │  │                            │                             │  │ │
  │  │                            ▼                             │  │ │
  │  │                   ┌─────────────────┐                    │  │ │
  │  │                   │   mcp_server.py  │                    │  │ │
  │  │                   │   MCPServer 类   │                    │  │ │
  │  │                   └─────────────────┘                    │  │ │
  │  │                                                          │  │ │
  │  └──────────────────────────────────────────────────────────┘  │ │
  │                                                                │ │
  └────────────────────────────────────────────────────────────────┘ │
                                                                     │
                                                                     ▼
                                                            ┌─────────────────┐
                                                            │  Kubernetes API │
                                                            └─────────────────┘

```

---

## npm 包入口分析

### 1. `npx k8s-mcp` 或全局 `k8s-mcp`

**文件**: `bin/cli.js`

```
┌─────────────────────────────────────────────────────────────┐
│                     bin/cli.js (Node.js)                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 解析命令行参数                                           │
│     --transport, --host, --port, --read-only, etc.          │
│                                                             │
│  2. 检查 Python 环境                                         │
│     ├─ 尝试: python3, python, py (Windows)                  │
│     └─ 未找到 → 报错退出                                     │
│                                                             │
│  3. 检查 Python 包是否安装                                    │
│     ├─ 尝试: import k8s_mcp                        │
│     ├─ 未安装 → 自动运行: pip install k8s-mcp               │
│     └─ 安装失败 → 报错退出                                   │
│                                                             │
│  4. 启动 Python 服务器                                       │
│     └─ python -m k8s_mcp.mcp_server [args...]      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**特点**:
- **零配置安装**: 不需要手动安装 Python 包
- **自动依赖管理**: 自动检测并安装 Python 依赖
- **统一接口**: 无论底层是 Python 还是 Node.js，用户使用相同的命令

**实际调用链**:
```
npx k8s-mcp --transport stdio
  → bin/cli.js
    → python -m k8s_mcp.mcp_server --transport stdio
      → mcp_server.py::MCPServer.serve_stdio()
```

### 2. `npm install` 后触发

**文件**: `bin/postinstall.js`

```
┌─────────────────────────────────────────────────────────────┐
│                bin/postinstall.js (安装后提示)                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 显示安装成功信息                                          │
│                                                             │
│  2. 检查 Python 版本                                          │
│     └─ 显示 Python 版本或提示安装                            │
│                                                             │
│  3. 显示使用示例                                              │
│     ├─ npx k8s-mcp                                          │
│     ├─ npx k8s-mcp --transport sse --port 8000              │
│     └─ Claude Desktop 配置示例                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## pip 包入口分析

### 1. `k8s-mcp` (CLI 工具)

**配置**: `pyproject.toml`
```toml
[project.scripts]
k8s-mcp = "k8s_mcp.cli:main"
```

**实际指向**: `k8s_mcp/cli/cli.py::main()`

```
┌─────────────────────────────────────────────────────────────┐
│              k8s-mcp (CLI 调试工具)                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  用途: 人类开发者调试、测试、查看信息                           │
│                                                             │
│  子命令:                                                     │
│  ├─ serve          启动 MCP 服务器 (stdio/sse/http)         │
│  ├─ tools          列出所有工具                              │
│  ├─ tools <name>   查看工具参数定义                          │
│  ├─ resources      列出所有资源                              │
│  ├─ prompts        列出所有提示词                            │
│  ├─ call <tool>    直接调用工具测试                          │
│  ├─ grep <pattern> 搜索工具                                  │
│  ├─ info           显示服务器信息                            │
│  ├─ context        查看/切换 K8s 上下文                     │
│  ├─ doctor         检查环境和依赖                            │
│  ├─ version        显示版本                                  │
│  └─ diagnostics    运行集群诊断                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**使用示例**:
```bash
# 查看所有工具
k8s-mcp tools

# 测试调用工具
k8s-mcp call get_pods '{"namespace": "default"}'

# 查看服务器信息
k8s-mcp info

# 启动服务器 (stdio 模式)
k8s-mcp-server --transport stdio
```

### 2. `k8s-mcp-server` (服务器启动)

**配置**: `pyproject.toml`
```toml
[project.scripts]
k8s-mcp-server = "k8s_mcp.server.main:main"
```

**实际指向**: `k8s_mcp/__main__.py::main()`

```
┌─────────────────────────────────────────────────────────────┐
│              k8s-mcp-server (服务器启动器)                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  用途: 直接启动 MCP 服务器（无子命令）                         │
│                                                             │
│  参数:                                                       │
│  ├─ --transport    stdio | sse | http | streamable-http     │
│  ├─ --host         绑定主机 (默认: 0.0.0.0)                 │
│  ├─ --port         绑定端口 (默认: 8000)                    │
│  ├─ --read-only    只读模式                                 │
│  ├─ --disable-destructive  禁用破坏性操作                    │
│  ├─ --confirm-destructive  破坏性操作需要确认                │
│  └─ --config       TOML 配置文件路径                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**使用示例**:
```bash
# stdio 模式 (AI 客户端使用)
k8s-mcp-server --transport stdio

# SSE 模式
k8s-mcp-server --transport sse --port 8000

# HTTP 模式
k8s-mcp-server --transport streamable-http --host 0.0.0.0 --port 8000

# 只读模式
k8s-mcp-server --transport stdio --read-only
```

---

## 入口点对比

| 入口 | 来源 | 用途 | 目标用户 | 功能范围 |
|------|------|------|----------|----------|
| `npx k8s-mcp` | npm | 启动服务器 | AI 客户端/用户 | 仅服务器启动 |
| `k8s-mcp` | pip | CLI 工具+服务器 | 开发者 | 完整 CLI + 可启动服务器 |
| `k8s-mcp-server` | pip | 服务器启动 | AI 客户端 | 仅服务器启动 |
| `python -m k8s_mcp` | pip | 模块运行 | 开发者 | 等同于 `k8s-mcp-server` |

---

## 设计问题

### 当前配置的问题

```toml
# pyproject.toml (当前)
[project.scripts]
k8s-mcp = "k8s_mcp.cli:main"         # ← CLI 工具
k8s-mcp-server = "k8s_mcp.server.main:main"  # ← 服务器启动
```

**问题**:
1. **命名反直觉**: `k8s-mcp-server` 听起来像服务器，但 `k8s-mcp-ctl` 不能启动服务器，只有 `k8s-mcp-server` 可以
2. **功能重叠**: `k8s-mcp-server` 和 `python -m k8s_mcp.server` 功能相同
3. **与 npm 不一致**: npm 的 `k8s-mcp` 直接启动服务器，pip 的 `k8s-mcp` 是 CLI 工具

### 建议的改进方案

#### 方案 A: 统一为单一入口（推荐）

```toml
[project.scripts]
k8s-mcp = "k8s_mcp.cli:main"
```

删除 `python -m k8s_mcp` 的旧方式，只保留 `k8s-mcp-server`:
- `k8s-mcp-server` → 启动服务器
- `k8s-mcp tools` → CLI 工具
- `k8s-mcp info` → 查看信息

**优点**: 简单统一，与 npm 行为一致（都是 `k8s-mcp`）

#### 方案 B: 明确分离

```toml
[project.scripts]
k8s-mcp = "k8s_mcp.server.main:main"      # 服务器（给 AI 客户端）
k8s-mcp-cli = "k8s_mcp.cli:main"       # CLI 工具（给开发者）
```

**优点**: 职责清晰，AI 客户端直接调用 `k8s-mcp`

#### 方案 C: 保持现状但修正

```toml
[project.scripts]
k8s-mcp = "k8s_mcp.server.main:main"      # 服务器（与 npm 一致）
k8s-mcp-cli = "k8s_mcp.cli:main"       # CLI 调试工具
```

**优点**: 
- `k8s-mcp` 行为一致（npm 和 pip 都是启动服务器）
- `k8s-mcp-cli` 明确为开发者工具

---

## 实际使用场景

### 场景 1: Claude Desktop 用户

```json
{
  "mcpServers": {
    "kubernetes": {
      "command": "npx",
      "args": ["-y", "k8s-mcp"]
    }
  }
}
```
→ 使用 npm 入口，自动处理 Python 依赖

### 场景 2: 开发者调试

```bash
# 安装 pip 包
pip install k8s-mcp

# 查看工具列表
k8s-mcp tools

# 测试工具
k8s-mcp call get_pods '{"namespace": "default"}'

# 启动服务器测试
k8s-mcp-server --transport stdio
```
→ 使用 pip CLI 入口

### 场景 3: 服务器部署

```bash
# pip 安装
pip install k8s-mcp

# 启动 SSE 服务器
k8s-mcp-server --transport sse --port 8000
```
→ 使用 pip 服务器入口

### 场景 4: Docker 部署

```dockerfile
FROM python:3.11
RUN pip install k8s-mcp
CMD ["k8s-mcp-server", "--transport", "streamable-http", "--port", "8000"]
```
→ 使用 pip 服务器入口
