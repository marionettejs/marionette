import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentDigest, exportDocs } from './export.mjs';
import { stagePackage } from './stage-package.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = await exportDocs();
manifest.pages = manifest.pages.filter(page =>
  page.section !== 'Maintaining Marionette');
manifest.assets = manifest.assets.filter(asset => !asset.source.startsWith('benchmarks/') &&
  asset.source !== 'ROADMAP.md' && !asset.source.startsWith('test/unit/') && asset.source !== 'test/README.md');
manifest.contentSha256 = contentDigest([...manifest.pages, ...manifest.assets]);
const skillDestination = resolve(root, 'dist/agent-skill');
await rm(skillDestination, { recursive: true, force: true });
for (const entry of manifest.assets.filter(asset => asset.source.startsWith('skills/marionette/'))) {
  const path = resolve(skillDestination, entry.source.slice('skills/marionette/'.length));
  await mkdir(dirname(path), { recursive: true });
  await cp(resolve(root, '.docs-export', entry.source), path);
}
await stagePackage(root, manifest);
console.log(`Packaged ${manifest.pages.length} consumer documentation pages at the package root.`);

const starterDestination = resolve(root, '.package/starter');
await rm(starterDestination, { recursive: true, force: true });
await mkdir(starterDestination, { recursive: true });
for (const file of ['package.json', 'AGENTS.md', 'playwright.config.mjs', 'workspace.browser.spec.mjs', 'gitignore', 'index.html', 'main.ts', 'workspace.ts', 'workspace.test.mjs', 'readme.md', 'tsconfig.json', 'eslint.config.mjs', 'vite.config.mjs']) {
  await cp(resolve(root, 'test/fixtures/data-package-starter', file), resolve(starterDestination, file));
}

// Registry consumers resolve the package version they installed. The first npm
// install creates their application lock; candidate kits supply exact tarballs.
const starterManifestPath = resolve(starterDestination, 'package.json');
const starterManifest = JSON.parse(await readFile(starterManifestPath, 'utf8'));
starterManifest.dependencies = { marionette: manifest.packageVersion, '@mnjs/data': manifest.packageVersion };
starterManifest.allowScripts[`marionette@${manifest.packageVersion}`] = false;
await writeFile(starterManifestPath, `${JSON.stringify(starterManifest, null, 2)}\n`);
