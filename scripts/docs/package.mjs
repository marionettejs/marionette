import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentDigest, exportDocs } from './export.mjs';
import { isConsumerPage } from './sections.mjs';
import { stagePackage } from './stage-package.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = await exportDocs();
manifest.pages = manifest.pages.filter(isConsumerPage);
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
