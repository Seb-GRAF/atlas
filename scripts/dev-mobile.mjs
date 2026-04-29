#!/usr/bin/env node
import { spawn } from 'node:child_process';
import os from 'node:os';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = new Set();
let shuttingDown = false;

function getLanIps() {
  const ips = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const net of ifaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push({ name, address: net.address });
      }
    }
  }
  return ips;
}

function start(name, command, args, env = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: { ...process.env, ...env }
  });

  children.add(child);
  child.on('exit', (code, signal) => {
    children.delete(child);
    if (shuttingDown) return;

    const reason = signal || `code ${code ?? 0}`;
    console.error(`\n[dev:mobile] ${name} stopped (${reason}).`);
    shutdown(code || 1);
  });

  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }

  setTimeout(() => process.exit(code), 150);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

const API_PORT = Number(process.env.PORT || 8787);
const UI_PORT = Number(process.env.UI_PORT || 5173);

const ips = getLanIps();

console.log('[dev:mobile] Binding API and UI to 0.0.0.0 (reachable on your LAN).');
console.log(`[dev:mobile] API: http://localhost:${API_PORT}`);
console.log('[dev:mobile] UI:  Vite will print its URLs below.\n');

if (ips.length === 0) {
  console.log('[dev:mobile] No LAN IPv4 interface detected — are you connected to Wi-Fi?\n');
} else {
  console.log('[dev:mobile] Open these URLs on your phone (same Wi-Fi):');
  for (const { name, address } of ips) {
    console.log(`  • UI  (${name}): http://${address}:${UI_PORT}/`);
    console.log(`  • API (${name}): http://${address}:${API_PORT}/`);
  }
  console.log('');
  console.log('[dev:mobile] If it does not load, allow incoming connections for Node.js in macOS firewall.\n');
}

start('api', process.execPath, ['scripts/serve-dashboard.mjs'], { PORT: String(API_PORT) });
start('ui', npm, ['run', 'dev:ui', '--', '--host', '0.0.0.0', '--port', String(UI_PORT)]);
