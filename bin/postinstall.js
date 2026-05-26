#!/usr/bin/env node

const { spawnSync } = require('child_process');

const colors = { green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', reset: '\x1b[0m', bold: '\x1b[1m' };
const log = (msg, color = 'reset') => console.log(`${colors[color]}${msg}${colors.reset}`);

function getPythonCommand() {
  const commands = process.platform === 'win32' ? ['python', 'python3', 'py'] : ['python3', 'python'];
  for (const cmd of commands) {
    try {
      const result = spawnSync(cmd, ['--version'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      if (result.status === 0) return { cmd, version: (result.stdout || result.stderr).trim() };
    } catch (e) {}
  }
  return null;
}

function main() {
  console.log('');
  log('k8s-mcp installed!', 'bold');
  console.log('');

  const python = getPythonCommand();
  if (python) {
    log(`Python: ${python.version}`, 'green');
  } else {
    log('Python 3.9+ required: https://python.org', 'yellow');
  }

  console.log('');
  log('Usage:', 'cyan');
  log('  npx k8s-mcp', 'reset');
  log('  npx k8s-mcp --transport sse --port 8000', 'reset');
  console.log('');
  log('Claude Desktop config:', 'cyan');
  console.log(`  {
    "mcpServers": {
      "kubernetes": {
        "command": "npx",
        "args": ["-y", "k8s-mcp"]
      }
    }
  }`);
  console.log('');
}

main();
