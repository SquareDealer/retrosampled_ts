// The package itself is CommonJS (no top-level "type"), so the ESM output needs
// its own marker for Node to read `dist/esm/*.js` as modules.
const { writeFileSync, mkdirSync } = require('fs');
const { join } = require('path');

const target = join(__dirname, '..', 'dist', 'esm');

mkdirSync(target, { recursive: true });
writeFileSync(
  join(target, 'package.json'),
  `${JSON.stringify({ type: 'module' }, null, 2)}\n`,
);
