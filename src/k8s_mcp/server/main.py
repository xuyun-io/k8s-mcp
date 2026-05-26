#!/usr/bin/env python3
"""Main entry point for k8s-mcp-server."""

import asyncio
import argparse
import logging
import sys
import os
import signal

from .core import MCPServer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stderr)]
)
logger = logging.getLogger("k8s-mcp-server")


def main():
    """Run the k8s-mcp server."""
    parser = argparse.ArgumentParser(
        prog="k8s-mcp-server",
        description="MCP Server for Kubernetes"
    )
    parser.add_argument(
        "--transport",
        choices=["stdio", "sse", "http", "streamable-http"],
        default="stdio",
        help="Communication transport (default: stdio)"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port for SSE/HTTP transport (default: 8000)"
    )
    parser.add_argument(
        "--host",
        type=str,
        default="0.0.0.0",
        help="Host for SSE/HTTP transport (default: 0.0.0.0)"
    )
    parser.add_argument(
        "--read-only",
        action="store_true",
        help="Enable read-only mode"
    )
    parser.add_argument(
        "--disable-destructive",
        "--non-destructive",
        action="store_true",
        help="Disable destructive operations"
    )
    parser.add_argument(
        "--confirm-destructive",
        action="store_true",
        help="Require confirmation for destructive operations"
    )
    parser.add_argument(
        "--config",
        type=str,
        default=None,
        help="Path to TOML configuration file"
    )
    parser.add_argument(
        "--stateless",
        action="store_true",
        help="Enable stateless mode"
    )
    parser.add_argument(
        "--watch-kubeconfig",
        action="store_true",
        help="Watch kubeconfig for changes"
    )
    parser.add_argument(
        "--watch-interval",
        type=float,
        default=5.0,
        help="Kubeconfig watch interval (default: 5.0)"
    )
    
    args = parser.parse_args()
    
    # Configure stateless mode
    if args.stateless:
        try:
            from .k8s_config import set_stateless_mode
            set_stateless_mode(True)
            logger.info("Stateless mode enabled")
        except ImportError:
            pass
    
    # Configure kubeconfig watching
    if args.watch_kubeconfig:
        try:
            from .k8s_config import enable_kubeconfig_watch
            enable_kubeconfig_watch(check_interval=args.watch_interval)
            logger.info(f"Kubeconfig watching enabled (interval: {args.watch_interval}s)")
        except ImportError:
            pass
    
    server = MCPServer(
        name="kubernetes",
        read_only=args.read_only,
        disable_destructive=args.disable_destructive,
        confirm_destructive=args.confirm_destructive,
        config_file=args.config
    )
    
    # Handle signals
    def signal_handler(sig, frame):
        print("\nShutting down server...", file=sys.stderr)
        os._exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        if args.transport == "stdio":
            logger.info("Starting server with stdio transport")
            asyncio.run(server.serve_stdio())
        elif args.transport == "sse":
            logger.info(f"Starting server with SSE transport on {args.host}:{args.port}")
            asyncio.run(server.serve_sse(host=args.host, port=args.port))
        elif args.transport in ("http", "streamable-http"):
            logger.info(f"Starting server with HTTP transport on {args.host}:{args.port}")
            asyncio.run(server.serve_http(host=args.host, port=args.port))
    except KeyboardInterrupt:
        print("\nShutting down server...", file=sys.stderr)
    except SystemExit:
        pass
    except Exception as e:
        logger.error(f"Server exited with error: {e}", exc_info=True)


if __name__ == "__main__":
    main()
