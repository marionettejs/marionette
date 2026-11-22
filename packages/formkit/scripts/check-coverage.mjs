import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { rollup } from 'rollup';
import config from '../rollup.config.mjs';
const root = new URL('../', import.meta.url);
const runtime = fileURLToPath(new URL('src/runtime/', root));
const bundle = await rollup(config);
let required;
try { required = bundle.watchFiles.filter(file => file.startsWith(runtime)); } finally { await bundle.close(); }
const summary = JSON.parse(await readFile(new URL('coverage/coverage-summary.json', root), 'utf8'));
assert(required.length > 0, 'Runtime coverage inventory must not be empty');
for (const file of required) { assert(Object.hasOwn(summary, file), `Missing runtime coverage: ${file}`); }
for (const name of ['statements', 'branches', 'functions', 'lines']) {
  assert(summary.total[name].total > 0, `Empty runtime ${name} coverage`);
}
const result = { passed: true, requiredRuntimeFiles: required, totals: summary.total };
await writeFile(new URL('coverage/graph-result.json', root), `${JSON.stringify(result, null, 2)}\n`);
console.log(`Verified coverage includes all ${required.length} active runtime modules.`);
