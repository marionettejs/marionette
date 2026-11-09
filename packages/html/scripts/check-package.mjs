import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {pathToFileURL} from 'node:url';
const root = resolve('.');
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
assert.equal(pkg.private, undefined, 'Release candidate must not retain private publication blocker');
assert.equal(pkg.version, '0.1.0', 'Package addition targets version 0.1.0');
assert.deepEqual(pkg.publishConfig, {access: 'public'});
assert.deepEqual(pkg.repository, {type: 'git', url: 'https://github.com/marionettejs/marionette.git', directory: 'packages/html'});
assert.equal(pkg.bugs.url, 'https://github.com/marionettejs/marionette/issues');
assert.equal(pkg.homepage, 'https://github.com/marionettejs/marionette/tree/master/packages/html#readme');
assert.equal(pkg.dependencies['@types/trusted-types'], '2.0.7');
const pack = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], { encoding: 'utf8' }))[0];
const files = new Set(pack.files.map(f => f.path));
for (const path of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'PROVENANCE.md', 'COMPATIBILITY.md', 'README.md', 'guide.md', 'INTEGRATION.md', 'UPSTREAM.md', 'LIT_DIFFERENCES.md', 'RELEASE.md', 'src/renderer.ts', 'src/marionette.ts', 'dist/index.js', 'dist/marionette.js', 'dist/development/index.d.ts'])
    assert.ok(files.has(path), `Missing packed ${path}`);
for (const value of Object.values(pkg.exports))
    for (const path of typeof value === 'string' ? [value] : Object.values(value))
        assert.ok(files.has(path.slice(2)), `Missing export target ${path}`);
assert.equal([...files].some(p => p.includes('node_modules') || p.startsWith('vendor/') || p.startsWith('test/')), false);
assert.equal(Object.keys(pkg.exports).some(p => /private-ssr|polyfill|compiled/.test(p)), false);
assert.equal([...files].some(p => /(?:^|\/)(?:compiler|compiled|compiled-only|compiled-template)(?:[/.]|$)/.test(p)), false, 'Compiler work must stay outside the runtime package');
const notices = await readFile('THIRD_PARTY_NOTICES.md', 'utf8');
assert.ok(notices.includes(await readFile('LICENSE', 'utf8')));
assert.ok(notices.includes(await readFile('node_modules/marionette/license.txt', 'utf8')));
for (const name of ['renderer', 'directive', 'async-directive', 'directive-helpers'])
    assert.match(await readFile(`dist/${name}.js`, 'utf8'), /Copyright.*Google LLC/);
const core = await readFile('dist/renderer.js', 'utf8');
for (const forbidden of ['addEventListener', 'removeEventListener', 'litHtmlVersions', 'litHtmlPolyfillSupport', 'ShadyDOM'])
    assert.equal(core.includes(forbidden), false, `Unexpected ${forbidden}`);
const temp = await mkdtemp(join(tmpdir(), 'mnjs-html-consumer-'));
const tar = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', temp], { encoding: 'utf8' }))[0];
const destination = join(temp, 'node_modules/@mnjs/html');
await mkdir(destination, { recursive: true });
execFileSync('tar', ['-xzf', join(temp, tar.filename), '--strip-components=1', '-C', destination]);
// Only the declared production types dependency accompanies the package.
await cp('node_modules/@types/trusted-types', join(temp, 'node_modules/@types/trusted-types'), { recursive: true, dereference: true });
await writeFile(join(temp, 'package.json'), '{"type":"module"}\n');
await writeFile(join(temp, 'consumer.ts'), `import {html,render,type TemplateResult} from '@mnjs/html';
import HtmlDomApi from '@mnjs/html/marionette';
import {repeat} from '@mnjs/html/directives/repeat.js';
import {AsyncDirective} from '@mnjs/html/async-directive';
const t:TemplateResult=html\`<p>\${repeat([1],n=>n,n=>html\`\${n}\`)}</p>\`;
render(t,document.body);HtmlDomApi.notifyAttach(document.body);
class D extends AsyncDirective { render() { return 'ok'; } } void D;
`);
await writeFile(join(temp, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true, types: [], skipLibCheck: false }, include: ['consumer.ts'] }));
execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', join(temp, 'tsconfig.json')], { stdio: 'inherit' });
await cp('test/packed-runtime.mjs', join(temp, 'packed-runtime.mjs'));
await writeFile(join(temp, 'runtime.mjs'), `import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {JSDOM} = await import(${JSON.stringify(pathToFileURL(join(root, 'node_modules/jsdom/lib/api.js')).href)});
const dom = new JSDOM('<!doctype html><html><body></body></html>', {url:'https://example.test/'});
for (const key of ['window','document','Node','Element','HTMLElement','SVGElement','DocumentFragment','ShadowRoot','CustomEvent','Event','customElements']) globalThis[key] = dom.window[key];
const manifest = JSON.parse(readFileSync(new URL('./node_modules/@mnjs/html/package.json', import.meta.url)));
for (const key of Object.keys(manifest.exports)) {
  const specifier = key === '.' ? '@mnjs/html' : '@mnjs/html/' + key.slice(2);
  assert.ok(import.meta.resolve(specifier).startsWith(new URL('./node_modules/@mnjs/html/', import.meta.url).href), 'export escaped extracted package: ' + specifier);
}
const {smoke} = await import('./packed-runtime.mjs');
console.log(JSON.stringify(await smoke(manifest, process.execArgv.includes('--conditions=development'))));
dom.window.close();
`);
for (const args of [[], ['--conditions=development']])
    execFileSync(process.execPath, [...args, join(temp, 'runtime.mjs')], {cwd: temp, stdio: 'inherit'});
const evidenceDir = process.env.EVIDENCE_DIR ?? 'evidence';
await mkdir(evidenceDir, { recursive: true });
await writeFile(`${evidenceDir}/package-check.json`, JSON.stringify({ date: new Date().toISOString(), files: files.size, packedConsumerTypes: 'passed with only declared production type dependency', packedRuntime: 'all JS exports and runtime smoke passed under default and development; external JSDOM test host', tarball: tar.filename, integrity: tar.integrity, shasum: tar.shasum }, null, 2) + '\n');
console.log(`Package check passed: ${files.size} files; notices, exports and isolated packed-consumer types verified.`);
