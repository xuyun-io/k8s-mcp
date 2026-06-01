"""k8s-mcp: A Model Context Protocol (MCP) server for Kubernetes.

This package provides:
- server: MCP server implementation
- ctl: CLI control tool
"""

__version__ = "0.1.4"

from .server import MCPServer

__all__ = ["__version__", "MCPServer"]
