import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = '/block-meadow/';
const root = resolve('dist');
const html = await readFile(resolve(root, 'index.html'), 'utf8');
const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]);
assert.ok(assets.some(path => path.endsWith('.js')), 'production JavaScript is present');
assert.ok(assets.some(path => path.endsWith('.css')), 'production CSS is present');
for (const path of assets) {
  assert.ok(path.startsWith(base), `asset must use the GitHub Pages subpath: ${path}`);
  const file = resolve(root, path.slice(base.length));
  assert.ok(file.startsWith(`${root}/`), 'asset stays inside dist');
  await access(file);
}
assert.ok(!html.includes('/src/main.js'), 'development entry point must not ship');
console.log(`Verified ${assets.length} production asset references under ${base}`);
