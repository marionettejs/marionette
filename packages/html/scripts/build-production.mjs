import assert from 'node:assert/strict';
import {readdir, readFile, writeFile, mkdir} from 'node:fs/promises';
import {join, relative, dirname} from 'node:path';
import {minify} from 'terser';

const development = 'dist/development';
const sources = new Map();
async function collect(directory) {
  for (const entry of (await readdir(directory, {withFileTypes: true})).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collect(path);
    else if (entry.name.endsWith('.js')) sources.set(relative(development, path), await readFile(path, 'utf8'));
  }
}
await collect(development);

// Fail closed if TypeScript output or a newly added flag changes the build contract.
const developmentFlags = new Map([['renderer.js', 1], ['async-directive.js', 1], ['template.js', 1]]);
for (const [path, source] of sources) {
  assert.equal((source.match(/const DEV_MODE = true;/g) ?? []).length,
    developmentFlags.get(path) ?? 0, `Unexpected DEV_MODE declarations in ${path}`);
  assert.equal((source.match(/const ENABLE_EXTRA_SECURITY_HOOKS = true;/g) ?? []).length,
    path === 'renderer.js' ? 1 : 0, `Unexpected security hook flag in ${path}`);
  sources.set(path, source.replaceAll('const DEV_MODE = true;', 'const DEV_MODE = false;')
    .replaceAll('const ENABLE_EXTRA_SECURITY_HOOKS = true;', 'const ENABLE_EXTRA_SECURITY_HOOKS = false;')
    .replace(/\/\/# sourceMappingURL=.*$/gm, ''));
}
for (const path of developmentFlags.keys()) assert.ok(sources.has(path), `Missing ${path}`);

// Share one property map across all entrypoints. Quoted protocol keys stay stable,
// including brands and AsyncDirective notifications used across independent copies.
const reserved = [...new Set([...sources.values()].flatMap(source =>
  [...source.matchAll(/['"](_[\w$]+)['"]/g)].map(match => match[1])))];
const nameCache = {};
for (const [path, source] of sources) {
  const result = await minify(source, {
    module: true,
    compress: {passes: 2},
    mangle: {properties: {
      regex: /^_/, reserved,
      // Directive subclasses own ordinary names (including p, t and $). Keep
      // minified internals in Lit's reserved internal namespace as well.
      nth_identifier: {get: n => `_$${n.toString(36)}`},
    }},
    nameCache,
    format: {comments: /@license|SPDX-License-Identifier/},
  });
  assert.ok(result.code, `Empty production output for ${path}`);
  assert.ok(!result.code.includes('mn-html-debug'), `Debug instrumentation leaked into ${path}`);
  assert.ok(!result.code.includes('is in development mode'), `Development warning leaked into ${path}`);
  assert.ok(!result.code.includes('setSanitizer'), `Development sanitizer API leaked into ${path}`);
  const output = join('dist', path);
  await mkdir(dirname(output), {recursive: true});
  await writeFile(output, result.code + '\n');
}
console.log(`Built ${sources.size} production modules with shared private-property mangling.`);
