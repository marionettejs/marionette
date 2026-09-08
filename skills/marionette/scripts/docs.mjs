import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

const usage = 'Usage: node docs.mjs [--project PATH] [--package-root PATH] [--list | --page SOURCE]';
const hash = value => createHash('sha256').update(value).digest('hex');
const json = async path => JSON.parse(await readFile(path, 'utf8'));

async function installedPackage(project) {
  let directory = await realpath(project);
  if (!(await stat(directory)).isDirectory()) {
    throw new Error('--project must name a directory.');
  }
  while (true) {
    const candidate = resolve(directory, 'node_modules/marionette');
    try {
      return await realpath(candidate);
    } catch (error) {
      if (error.code !== 'ENOENT') { throw error; }
    }
    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error('No installed marionette found. Use the application workspace or --package-root for its physical package directory.');
    }
    directory = parent;
  }
}

async function main() {
  const options = { project: process.cwd() };
  const args = process.argv.slice(2);
  let mode;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--help') { console.log(usage); return; }
    if (argument === '--list') {
      if (mode) { throw new Error(usage); }
      mode = 'list';
    } else if (['--project', '--package-root', '--page'].includes(argument)) {
      const value = args[++index];
      if (!value || value.startsWith('--')) { throw new Error(usage); }
      if (argument === '--page') {
        if (mode) { throw new Error(usage); }
        mode = 'page';
      }
      options[argument.slice(2)] = value;
    } else {
      throw new Error(usage);
    }
  }
  const packageRoot = options['package-root'] ? await realpath(options['package-root']) : await installedPackage(options.project);
  const metadata = await json(resolve(packageRoot, 'package.json'));
  const docsRoot = await realpath(resolve(packageRoot, 'dist/docs')).catch(() => {
    throw new Error('This package has no dist/docs. Read its exports/declarations and obtain documentation from its exact release or known source revision; do not substitute current master.');
  });
  const manifest = await json(resolve(docsRoot, 'manifest.json'));
  if (metadata.name !== 'marionette' || manifest.packageName !== metadata.name || manifest.packageVersion !== metadata.version) {
    throw new Error('Documentation package/version does not match the installed marionette package.');
  }
  if (manifest.schemaVersion !== 1 || !/^[a-f0-9]{40}$/.test(manifest.sourceRevision) ||
      typeof manifest.sourceDirty !== 'boolean' || !Array.isArray(manifest.pages) || !Array.isArray(manifest.assets)) {
    throw new Error('Unsupported or incomplete documentation manifest.');
  }
  const entries = [...manifest.pages, ...manifest.assets];
  const files = new Map();
  for (const entry of entries) {
    const source = entry.source;
    if (typeof source !== 'string' || isAbsolute(source) || source.includes('\\') || source.split('/').some(part => !part || part === '..' || part === '.')) {
      throw new Error('Unsafe documentation source path.');
    }
    if (files.has(source)) { throw new Error(`Duplicate documentation source: ${source}`); }
    const path = await realpath(resolve(docsRoot, source));
    const local = relative(docsRoot, path);
    if (local === '..' || local.startsWith(`..${sep}`) || isAbsolute(local)) {
      throw new Error(`Documentation source escapes its package: ${source}`);
    }
    const content = await readFile(path);
    if (hash(content) !== entry.sha256) { throw new Error(`Documentation hash mismatch: ${source}`); }
    files.set(source, { path, content });
  }
  const digest = hash(entries.sort((a, b) => a.source.localeCompare(b.source, 'en'))
    .map(entry => `${entry.source}\0${entry.sha256}\n`).join(''));
  if (digest !== manifest.contentSha256) { throw new Error('Documentation manifest content digest does not match.'); }
  const provenance = {
    packageRoot,
    packageVersion: metadata.version,
    sourceRevision: manifest.sourceRevision,
    sourceDirty: manifest.sourceDirty,
    contentSha256: digest,
  };
  if (mode === 'page') {
    const page = manifest.pages.find(entry => entry.source === options.page);
    if (!page) { throw new Error('Page is not in this package manifest. Use --list to find its exact source path.'); }
    console.log(JSON.stringify({ ...provenance, source: page.source, sha256: page.sha256 }));
    console.log(files.get(page.source).content.toString('utf8'));
  } else {
    console.log(JSON.stringify({ ...provenance, pages: manifest.pages.map(page => ({
      source: page.source, title: page.title, section: page.section, path: files.get(page.source).path,
    })) }, null, 2));
  }
}

main().catch(error => {
  console.error(`Marionette docs: ${error.message}`);
  process.exitCode = 1;
});
