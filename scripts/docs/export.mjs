import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseChannel } from '../release/publication.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const sha256 = value => createHash('sha256').update(value).digest('hex');

export function validateNavigation(pages) {
  if (!Array.isArray(pages) || !pages.length) {
    throw new Error('Documentation navigation is empty.');
  }
  const sources = new Set();
  const routes = new Set();
  for (const page of pages) {
    if (!/^(?:docs\/[a-z0-9./-]+|packages\/[a-z]+\/readme|docs-site\/README|CONTRIBUTING|AGENTS|upgradeGuide)\.md$/.test(page.source) ||
        page.source.split('/').includes('..')) {
      throw new Error(`Invalid documentation source: ${page.source}`);
    }
    if (!/^docs(?:\/[a-z0-9-]+)*$/.test(page.route)) {
      throw new Error(`Invalid documentation route: ${page.route}`);
    }
    if (!page.title || !page.section) {
      throw new Error(`Missing navigation label: ${page.source}`);
    }
    if (sources.has(page.source) || routes.has(page.route)) {
      throw new Error(`Duplicate documentation entry: ${page.source}`);
    }
    sources.add(page.source);
    routes.add(page.route);
  }
}

export function contentDigest(pages) {
  return sha256([...pages].sort((a, b) => a.source.localeCompare(b.source, 'en'))
    .map(page => `${page.source}\0${page.sha256}\n`).join(''));
}

async function readSource(repository, source) {
  if (typeof source !== 'string' || !/^[a-zA-Z0-9._/-]+\.(?:md|json|mjs)$/.test(source) ||
      source.startsWith('/') || source.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error(`Invalid documentation resource: ${source}`);
  }
  const repositoryPath = await realpath(repository);
  const path = await realpath(resolve(repositoryPath, source));
  const local = relative(repositoryPath, path);
  if (local === '..' || local.startsWith(`..${sep}`) || isAbsolute(local)) {
    throw new Error(`Documentation source escapes its repository: ${source}`);
  }
  return readFile(path);
}

export async function readResources(repository, sources, pageSources = []) {
  if (!Array.isArray(sources) || !sources.length) {
    throw new Error('Documentation resources are empty.');
  }
  const used = new Set(pageSources);
  for (const source of sources) {
    if (used.has(source)) { throw new Error(`Duplicate documentation source: ${source}`); }
    used.add(source);
  }
  return Promise.all(sources.map(async source => ({ source, bytes: await readSource(repository, source) })));
}

export async function exportDocs() {
  const navigation = JSON.parse(await readFile(resolve(root, 'docs-site/navigation.json'), 'utf8'));
  validateNavigation(navigation);
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const policy = JSON.parse(await readFile(resolve(root, 'config/release-promotion.json'), 'utf8'));
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const assetSources = JSON.parse(await readFile(resolve(root, 'docs-site/resources.json'), 'utf8'));
  if (!Array.isArray(assetSources) || !assetSources.includes('config/diagnostics/catalog.json')) {
    throw new Error('Documentation resources must include the diagnostic catalog.');
  }
  const sourceRevision = git(['rev-parse', 'HEAD']);
  const sourceDirty = Boolean(git(['status', '--porcelain', '--untracked-files=all']));
  const contents = await Promise.all(navigation.map(async page => ({
    page, bytes: await readSource(root, page.source),
  })));
  const pages = contents.map(({ page, bytes }) => ({ ...page, sha256: sha256(bytes) }));
  const assetContents = await readResources(root, assetSources, navigation.map(page => page.source));
  const assets = assetContents.map(({ source, bytes }) => ({ source, sha256: sha256(bytes) }));
  const manifest = {
    schemaVersion: 1,
    packageName: pkg.name,
    packageVersion: pkg.version,
    channel: releaseChannel(policy, pkg.version),
    sourceRepository: 'https://github.com/marionettejs/marionette',
    sourceRevision,
    sourceDirty,
    contentSha256: contentDigest([...pages, ...assets]),
    pages,
    assets,
  };
  const output = resolve(root, '.docs-export');
  const temporary = resolve(root, '.docs-export-tmp');
  await rm(temporary, { recursive: true, force: true });
  for (const { page, bytes } of contents) {
    const destination = resolve(temporary, page.source);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
  }
  for (const { source, bytes } of assetContents) {
    const destination = resolve(temporary, source);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
  }
  await writeFile(resolve(temporary, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await rm(output, { recursive: true, force: true });
  await rename(temporary, output);
  console.log(`Exported ${pages.length} documentation pages to .docs-export (${sourceRevision.slice(0, 8)}${sourceDirty ? ', working changes' : ''}).`);
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await exportDocs();
}
