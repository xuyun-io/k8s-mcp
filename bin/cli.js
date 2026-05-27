#!/usr/bin/env node

const { spawn, spawnSync } = require('child_process');

const colors = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', reset: '\x1b[0m' };
const log = (msg, color = 'reset') => console.error(`${colors[color]}${msg}${colors.reset}`);

function getPythonCommand() {
  const commands = process.platform === 'win32' ? ['python', 'python3', 'py'] : ['python3', 'python'];
  for (const cmd of commands) {
    try {
      if (spawnSync(cmd, ['--version'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).status === 0) return cmd;
    } catch (e) {}
  }
  return null;
}

function getInstalledPythonVersion(pythonCmd) {
  try {
    const result = spawnSync(pythonCmd, ['-c', 'import k8s_mcp; print(k8s_mcp.__version__)'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    if (result.status === 0) {
      return result.stdout.trim();
    }
  } catch (e) {}
  return null;
}

function checkPythonPackage(pythonCmd, expectedVersion) {
  const installedVersion = getInstalledPythonVersion(pythonCmd);
  if (!installedVersion) {
    return false;
  }
  if (installedVersion !== expectedVersion) {
    log(`Python package version mismatch: ${installedVersion} (expected ${expectedVersion})`, 'yellow');
    return false;
  }
  return true;
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
k8s-mcp - MCP Server for Kubernetes

Usage: npx k8s-mcp [options]

Options:
  --transport <mode>       Transport: stdio, sse, http, streamable-http (default: stdio)
  --host <host>            Host for network transports (default: 0.0.0.0)
  --port <port>            Port for network transports (default: 8000)
  --disable-destructive    Block destructive operations
  --confirm-destructive    Require confirmation for destructive operations
  --read-only              Block all write operations
  --config <path>          Path to TOML configuration file
  --stateless              Don't cache API clients, reload config each request
  --watch-kubeconfig       Watch kubeconfig files for changes and auto-reload
  --watch-interval <sec>   Interval for kubeconfig watch checks (default: 5.0)
  --help, -h               Show this help message
  --version, -v            Show version

For more info: https://github.com/xuyun-io/k8s-mcp
`);
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(`k8s-mcp v${require('../package.json').version}`);
    process.exit(0);
  }

  const pythonCmd = getPythonCommand();
  if (!pythonCmd) {
    log('Error: Python 3.9+ is required. Install from https://python.org', 'red');
    process.exit(1);
  }

  const npmVersion = require('../package.json').version;

  if (!checkPythonPackage(pythonCmd, npmVersion)) {
    log(`Installing k8s-mcp==${npmVersion}...`, 'yellow');
    if (spawnSync(pythonCmd, ['-m', 'pip', 'install', `k8s-mcp==${npmVersion}`], { stdio: 'inherit' }).status !== 0) {
      log(`Failed to install k8s-mcp==${npmVersion}. Try: pip install k8s-mcp==${npmVersion}`, 'red');
      process.exit(1);
    }
    log('Installed successfully!', 'green');
  }

  // Use k8s-mcp-server command instead of python -m
  const server = spawn(pythonCmd, ['-m', 'k8s_mcp.server', ...args], {
    stdio: 'inherit',
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
  });

  server.on('error', (err) => { log(`Error: ${err.message}`, 'red'); process.exit(1); });
  server.on('close', (code) => process.exit(code || 0));
  process.on('SIGINT', () => server.kill('SIGINT'));
  process.on('SIGTERM', () => server.kill('SIGTERM'));
}

main();
