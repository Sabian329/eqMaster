import { copyFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

const releaseDir = resolve('release');
const desktopDir = join(homedir(), 'Desktop');

const dmgs = readdirSync(releaseDir)
  .filter((name) => name.toLowerCase().endsWith('.dmg'))
  .map((name) => {
    const path = join(releaseDir, name);
    return { name, path, mtime: statSync(path).mtimeMs };
  })
  .sort((a, b) => b.mtime - a.mtime);

if (!dmgs.length) {
  console.error('No .dmg found in release/');
  process.exit(1);
}

const latest = dmgs[0];
const destination = join(desktopDir, latest.name);
copyFileSync(latest.path, destination);
console.log(`Copied ${latest.name} → ${destination}`);
