const fs = require('node:fs');
const path = require('node:path');

const outDir = path.join(__dirname, '..', 'dist-electron');

for (const file of ['main.js', 'preload.js']) {
  const from = path.join(outDir, file);
  const to = path.join(outDir, file.replace('.js', '.cjs'));
  if (fs.existsSync(from)) {
    fs.renameSync(from, to);
  }
}

// main.cjs is generated before rename; patch preload path inside it.
const mainPath = path.join(outDir, 'main.cjs');
if (fs.existsSync(mainPath)) {
  const source = fs.readFileSync(mainPath, 'utf8');
  fs.writeFileSync(mainPath, source.replace(/preload\.js/g, 'preload.cjs'));
}
