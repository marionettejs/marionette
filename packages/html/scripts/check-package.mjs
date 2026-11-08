import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const root = resolve('.');
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
assert.equal(pkg.private, true, 'Prototype must remain protected from accidental publish');
assert.equal(pkg.dependencies['@types/trusted-types'], '2.0.7');
const pack = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], { encoding: 'utf8' }))[0];
const files = new Set(pack.files.map(f => f.path));
for (const path of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'PROVENANCE.md', 'COMPATIBILITY.md', 'README.md', 'src/renderer.ts', 'src/marionette.ts', 'dist/index.js', 'dist/marionette.js', 'dist/development/index.d.ts'])
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
const evidenceDir = process.env.EVIDENCE_DIR ?? 'evidence';
await mkdir(evidenceDir, { recursive: true });
await writeFile(`${evidenceDir}/package-check.json`, JSON.stringify({ date: new Date().toISOString(), files: files.size, packedConsumerTypes: 'passed with only declared production type dependency', tarball: tar.filename, integrity: tar.integrity, shasum: tar.shasum }, null, 2) + '\n');
console.log(`Package check passed: ${files.size} files; notices, exports and isolated packed-consumer types verified.`);
