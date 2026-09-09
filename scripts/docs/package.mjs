import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentDigest, exportDocs } from './export.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = await exportDocs();
manifest.pages = manifest.pages.filter(page =>
  page.section !== 'Maintaining Marionette');
manifest.assets = manifest.assets.filter(asset => !asset.source.startsWith('benchmarks/docs/'));
manifest.contentSha256 = contentDigest([...manifest.pages, ...manifest.assets]);
const destination = resolve(root, 'dist/docs');
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const page of [...manifest.pages, ...manifest.assets]) {
  await mkdir(dirname(resolve(destination, page.source)), { recursive: true });
  await cp(resolve(root, '.docs-export', page.source), resolve(destination, page.source));
}
await writeFile(resolve(destination, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(resolve(destination, 'readme.md'), `# Marionette package documentation

Start with [Build with an agent](docs/agents.md) or the [documentation index](docs/readme.md).
Read individual pages as the task requires. These files are documentation, outside
the runtime import graph. Maintainer instructions belong to the source repository.

Package: ${manifest.packageName}@${manifest.packageVersion}
Source revision: ${manifest.sourceRevision}${manifest.sourceDirty ? ' (includes working changes)' : ''}
Content SHA-256: ${manifest.contentSha256}

The manifest records each page's original repository path and content hash.
`);
const skillDestination = resolve(root, 'dist/agent-skill');
await rm(skillDestination, { recursive: true, force: true });
for (const entry of manifest.assets.filter(asset => asset.source.startsWith('skills/marionette/'))) {
  const path = resolve(skillDestination, entry.source.slice('skills/marionette/'.length));
  await mkdir(dirname(path), { recursive: true });
  await cp(resolve(root, '.docs-export', entry.source), path);
}
console.log(`Packaged ${manifest.pages.length} consumer documentation pages in dist/docs/.`);

const starterDestination = resolve(root, 'dist/docs/starter');
await rm(starterDestination, { recursive: true, force: true });
await mkdir(starterDestination, { recursive: true });
for (const file of ['package.json', 'package-lock.json', 'index.html', 'main.ts', 'workspace.ts', 'workspace.test.mjs', 'readme.md', 'tsconfig.json', 'eslint.config.mjs', 'vite.config.mjs']) {
  await cp(resolve(root, 'test/fixtures/data-package-starter', file), resolve(starterDestination, file));
}
