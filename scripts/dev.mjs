#!/usr/bin/env node
import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = new Set();
let shuttingDown = false;

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
    console.error(`\n[dev] ${name} stopped (${reason}).`);
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

console.log('[dev] API:   http://127.0.0.1:8787');
console.log('[dev] UI:    Vite will print its local URL below');
console.log('[dev] HMR works on the Vite URL, not on npm run start / port 8787.\n');

start('api', process.execPath, ['scripts/serve-dashboard.mjs']);
start('ui', npm, ['run', 'dev:ui']);
