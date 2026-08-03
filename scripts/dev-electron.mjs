import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const electronEnv = { ...process.env };
delete electronEnv.ELECTRON_RUN_AS_NODE;
electronEnv.VITE_DEV_SERVER_URL = 'http://localhost:5173';

const vite = spawn('npx', ['vite'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: electronEnv,
});

const waitOn = spawn(
  'npx',
  ['wait-on', 'http://localhost:5173', '&&', 'env', '-u', 'ELECTRON_RUN_AS_NODE', 'npx', 'electron', '.'],
  {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: electronEnv,
  },
);

const shutdown = (code = 0) => {
  vite.kill('SIGTERM');
  waitOn.kill('SIGTERM');
  process.exit(code);
};

vite.on('exit', (code) => {
  if (code && code !== 0) shutdown(code);
});

waitOn.on('exit', (code) => shutdown(code ?? 0));

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
