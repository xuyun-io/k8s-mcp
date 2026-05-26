# 开发指南

本文档面向希望参与 `k8s-mcp` 项目开发的贡献者，涵盖环境搭建、常用命令和开发流程。

---

## 目录

- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [开发环境设置](#开发环境设置)
- [常用开发命令](#常用开发命令)
- [测试](#测试)
- [代码质量](#代码质量)
- [发布流程](#发布流程)
- [常见问题](#常见问题)

---

## 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/xuyun-io/k8s-mcp.git
cd k8s-mcp

# 2. 创建并激活虚拟环境
python -m venv venv
source venv/bin/activate        # Linux/Mac
# 或: venv\Scripts\activate     # Windows

# 3. 安装开发依赖
pip install -r requirements-dev.txt

# 4. 以 editable 模式安装项目
pip install -e .

# 5. 验证安装
k8s-mcp-ctl info
```

---

## 项目结构

```
k8s-mcp/
├── src/k8s_mcp/           # Python 主代码
│   ├── __init__.py             # 版本号
│   ├── server/core.py           # MCP 服务器核心
│   ├── k8s_config.py           # Kubernetes 配置
│   ├── providers.py            # 多集群 Provider
│   ├── ctl/                     # 客户端控制工具
│   │   ├── main.py              # CTL 主入口
│   │   ├── errors.py           # 错误处理
│   │   └── output.py           # 输出格式化
│   └── server/tools/            # 服务端工具实现
│       ├── pods.py             # Pod 管理
│       ├── deployments.py      # 部署管理
│       ├── cluster.py          # 集群管理
│       ├── helm.py             # Helm 操作
│       ├── diagnostics.py      # 诊断工具
│       ├── cost.py             # 成本优化
│       ├── browser.py          # 浏览器自动化
│       ├── ui.py               # MCP-UI 仪表板
│       ├── gitops.py           # GitOps 工具
│       ├── certs.py            # 证书管理
│       ├── policy.py           # 策略管理
│       ├── backup.py           # 备份工具
│       ├── keda.py             # KEDA 自动扩缩容
│       ├── cilium.py           # Cilium 网络
│       ├── rollouts.py         # Argo Rollouts
│       ├── capi.py             # Cluster API
│       ├── kubevirt.py         # KubeVirt 虚拟机
│       ├── kiali.py            # Istio 服务网格
│       ├── vind.py             # vCluster 管理
│       └── kind.py             # kind 本地集群
├── tests/                      # 测试套件
│   ├── conftest.py             # 共享 fixtures
│   ├── test_tools.py           # 工具测试
│   ├── test_cli.py             # CLI 测试
│   ├── test_browser.py         # 浏览器测试
│   └── ...                     # 其他测试
├── docs/                       # 文档
├── deploy/                     # K8s 部署清单
├── kubernetes-skills/          # AI Agent Skills
├── pyproject.toml              # Python 包配置
├── requirements.txt            # 生产依赖
├── requirements-dev.txt        # 开发依赖
├── pytest.ini                  # pytest 配置
└── package.json                # npm 包配置
```

---

## 开发环境设置

### 前置要求

- **Python 3.9+**
- **kubectl** 已安装并配置
- 可访问的 Kubernetes 集群（本地 kind/minikube 或远程集群）

### 详细步骤

#### 1. 创建虚拟环境

```bash
# 创建
python -m venv venv

# 激活 (选择对应系统的命令)
source venv/bin/activate        # Linux / macOS
venv\Scripts\activate           # Windows CMD
venv\Scripts\Activate.ps1      # Windows PowerShell
```

#### 2. 安装依赖

```bash
# 安装开发依赖（包含测试、代码格式化等工具）
pip install -r requirements-dev.txt

# 以 editable 模式安装项目（修改代码无需重新安装）
pip install -e .
```

#### 3. 验证环境

```bash
# 检查 kubectl 连接
kubectl cluster-info

# 测试 MCP 服务器
k8s-mcp-ctl info
k8s-mcp-ctl tools
k8s-mcp-ctl call get_pods '{"namespace": "kube-system"}'
```

---

## 常用开发命令

### 运行服务器

```bash
# 开发模式（带自动重载）
k8s-mcp-server --transport stdio

# SSE 传输模式
k8s-mcp-server --transport sse --port 8000

# Streamable HTTP 模式
k8s-mcp-server --transport streamable-http --port 8000
```

### CLI 调试

```bash
# 查看服务器信息
k8s-mcp-ctl info

# 列出所有工具
k8s-mcp-ctl tools
k8s-mcp-ctl tools -d              # 带描述
k8s-mcp-ctl tools get_pods        # 查看特定工具参数

# 搜索工具
k8s-mcp-ctl grep "*pod*"
k8s-mcp-ctl grep "*helm*"

# 直接调用工具
k8s-mcp-ctl call get_pods '{"namespace": "default"}'
k8s-mcp-ctl call get_deployments '{"namespace": "kube-system"}'

# 从 stdin 传入参数
echo '{"namespace": "default"}' | k8s-mcp-ctl call get_pods

# 查看资源
k8s-mcp-ctl resources

# 查看提示词
k8s-mcp-ctl prompts

# 查看/切换 K8s 上下文
k8s-mcp-ctl context
k8s-mcp-ctl context production-cluster

# 检查依赖和环境
k8s-mcp-ctl doctor
```

### 环境变量调试

```bash
# 启用调试日志
export MCP_DEBUG=true

# 指定日志文件
export MCP_LOG_FILE=/tmp/k8s-mcp.log

# 禁用彩色输出
export NO_COLOR=1

# 启用浏览器工具
export MCP_BROWSER_ENABLED=true

# 多集群配置
export MCP_K8S_PROVIDER=kubeconfig    # kubeconfig / in-cluster / single
export MCP_K8S_CONTEXT=minikube       # 默认上下文
```

---

## 测试

### 运行测试

```bash
# 运行所有测试
pytest tests/ -v

# 运行特定测试文件
pytest tests/test_tools.py -v
pytest tests/test_cli.py -v
pytest tests/test_browser.py -v

# 运行特定测试类
pytest tests/test_tools.py::TestPodTools -v

# 运行特定测试方法
pytest tests/test_tools.py::TestPodTools::test_get_pods -v

# 仅运行单元测试
pytest tests/ -v -m unit

# 仅运行集成测试
pytest tests/ -v -m integration

# 跳过慢测试
pytest tests/ -v -m "not slow"
```

### 测试覆盖率

```bash
# 生成 HTML 覆盖率报告
pytest tests/ --cov=src/k8s_mcp --cov-report=html

# 查看终端覆盖率摘要
pytest tests/ --cov=src/k8s_mcp --cov-report=term-missing

# 打开 HTML 报告
open htmlcov/index.html        # macOS
start htmlcov/index.html       # Windows
```

### 测试标记说明

| 标记 | 说明 | 使用场景 |
|------|------|----------|
| `@pytest.mark.unit` | 单元测试 | 不依赖外部服务 |
| `@pytest.mark.integration` | 集成测试 | 需要 K8s 集群 |
| `@pytest.mark.slow` | 慢速测试 | 执行时间 > 5s |

---

## 代码质量

### 格式化代码

```bash
# 格式化所有 Python 代码
black src/k8s_mcp tests

# 排序导入
isort src/k8s_mcp tests

# 检查代码风格
flake8 src/k8s_mcp tests

# 类型检查
mypy src/k8s_mcp
```

### 提交前检查清单

```bash
# 1. 运行测试
pytest tests/ -v

# 2. 格式化代码
black src/k8s_mcp tests
isort src/k8s_mcp tests

# 3. 代码检查
flake8 src/k8s_mcp tests

# 4. 类型检查（可选）
mypy src/k8s_mcp
```

---

## 发布流程

### Python 包发布

```bash
# 1. 更新版本号（修改以下文件）
# - pyproject.toml: version
# - src/k8s_mcp/__init__.py: __version__
# - package.json: version

# 2. 清理旧构建
rm -rf dist/ build/ *.egg-info/

# 3. 构建分发包
python -m build

# 4. 检查包
python -m twine check dist/*

# 5. 上传到 PyPI（测试环境）
python -m twine upload --repository testpypi dist/*

# 6. 上传到 PyPI（生产环境）
python -m twine upload dist/*
```

### npm 包发布

```bash
# 1. 确保 Node.js 已安装
node --version

# 2. 更新版本号
npm version patch    # 或 minor / major

# 3. 发布
npm publish

# 4. 测试发布（使用 tag）
npm publish --tag beta
```

---

## 常见问题

### pip install -e . 报错 "editable install is deprecated"

**原因**：旧版 `setup.py` 的 editable 安装方式已被弃用。

**解决**：项目已迁移到 `pyproject.toml`，直接运行：

```bash
pip install -e .
```

如果仍有问题，尝试：

```bash
pip install --upgrade pip setuptools
pip install -e . --use-pep517
```

### Windows 激活虚拟环境失败

**PowerShell 执行策略限制**：

```powershell
# 以管理员身份运行 PowerShell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# 然后激活
venv\Scripts\Activate.ps1
```

### 测试需要 Kubernetes 集群

部分集成测试需要真实的 K8s 集群。如果没有，可以：

```bash
# 使用 kind 创建本地集群
kind create cluster --name k8s-mcp-test

# 运行仅单元测试
pytest tests/ -v -m unit

# 跳过集成测试
pytest tests/ -v -m "not integration"
```

### 修改代码后未生效

确保使用 **editable 模式**安装：

```bash
# 检查安装方式
pip show k8s-mcp
# Location 应该指向你的项目目录

# 如果不是，重新安装
pip install -e . --force-reinstall --no-deps
```

### 导入错误

```bash
# 确保虚拟环境已激活
which python    # 应该指向 venv/bin/python

# 重新安装依赖
pip install -r requirements-dev.txt
pip install -e .
```

---

## 相关文档

- [项目 README](../README.md) - 项目介绍和使用说明
- [CLAUDE.md](../CLAUDE.md) - 项目架构和版本历史
- [CONTRIBUTING.md](../kubectl-mcp-app/CONTRIBUTING.md) - 贡献指南

---

## 获取帮助

- [GitHub Issues](https://github.com/xuyun-io/k8s-mcp/issues) - 报告问题
- [GitHub Discussions](https://github.com/xuyun-io/k8s-mcp/discussions) - 讨论和交流
