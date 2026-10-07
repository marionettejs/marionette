import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { searchSections } from './search.mjs';
import { findSymbols, validateSymbolIndex } from './symbols.mjs';

const usage = 'Usage: node docs.mjs [--project PATH] [--package-root PATH] [--list | --page SOURCE [--section HEADING] | --search QUERY | --section SOURCE#ANCHOR | --symbol NAME | --diagnostic MNxxxx]';
const hash = value => createHash('sha256').update(value).digest('hex');
const json = async path => JSON.parse(await readFile(path, 'utf8'));

async function installedPackage(project) {
  let directory = await realpath(project);
  if (!(await stat(directory)).isDirectory()) {
    throw new Error('--project must name a directory.');
  }
  const searched = [];
  while (true) {
    const candidate = resolve(directory, 'node_modules/marionette');
    try {
      return await realpath(candidate);
    } catch (error) {
      if (error.code !== 'ENOENT') { throw error; }
    }
    searched.push(directory);
    const parent = dirname(directory);
    if (parent === directory) {
      for (const location of searched) {
        let legacy;
        try { legacy = await json(resolve(location, 'node_modules/backbone.marionette/package.json')); } catch (error) {
          if (error.code === 'ENOENT') { continue; }
          throw error;
        }
        const guidance = legacy.version.startsWith('4.') ?
          '(v4). Use its v4 documentation; for migration choose an exact v5 target and read that target’s packaged migration guide.' :
          '— use documentation for this installed release; the v4-to-v5 guide does not cover it.';
        throw new Error(`Found backbone.marionette ${legacy.version} ${guidance}`);
      }
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
    } else if (['--project', '--package-root', '--page', '--search', '--section', '--symbol', '--diagnostic'].includes(argument)) {
      const value = args[++index];
      if (!value || value.startsWith('--')) { throw new Error(usage); }
      if (['--page', '--search', '--section', '--symbol', '--diagnostic'].includes(argument)) {
        const nextMode = argument.slice(2);
        const scopedSection = mode && !options[nextMode] &&
          ((mode === 'page' && nextMode === 'section') || (mode === 'section' && nextMode === 'page'));
        if (mode && !scopedSection) { throw new Error(usage); }
        mode = scopedSection ? 'section' : nextMode;
      }
      options[argument.slice(2)] = value;
    } else {
      throw new Error(usage);
    }
  }
  const packageRoot = options['package-root'] ? await realpath(options['package-root']) : await installedPackage(options.project);
  const metadata = await json(resolve(packageRoot, 'package.json'));
  const manifestPath = await realpath(resolve(packageRoot, 'docs-manifest.json')).catch(error => {
    if (error.code !== 'ENOENT') { throw error; }
    throw new Error('This package has no docs-manifest.json. Read its exports/declarations and obtain documentation from its exact release or known source revision; do not substitute current master.');
  });
  const manifestLocal = relative(packageRoot, manifestPath);
  if (manifestLocal === '..' || manifestLocal.startsWith(`..${sep}`) || isAbsolute(manifestLocal)) {
    throw new Error('Documentation manifest escapes its package.');
  }
  const manifest = await json(manifestPath);
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
    if (typeof source !== 'string' || isAbsolute(source) || source.includes('\\') || source.includes(':') || source.split('/').some(part => !part || part === '..' || part === '.')) {
      throw new Error('Unsafe documentation source path.');
    }
    if (files.has(source)) { throw new Error(`Duplicate documentation source: ${source}`); }
    const path = await realpath(resolve(packageRoot, source));
    const local = relative(packageRoot, path);
    if (!local || local === '..' || local.startsWith(`..${sep}`) || isAbsolute(local)) {
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
  if (mode === 'diagnostic') {
    if (!/^MN[0-9]{4}$/.test(options.diagnostic)) { throw new Error('Diagnostic lookup requires an exact MNxxxx code.'); }
    const source = 'config/diagnostics/catalog.json';
    const entry = manifest.assets.find(asset => asset.source === source);
    if (!entry) { throw new Error('This artifact has no diagnostic catalog.'); }
    const catalog = JSON.parse(files.get(source).content.toString('utf8'));
    if (catalog?.schemaVersion !== 3 || !Array.isArray(catalog.diagnostics) || !catalog.diagnostics.length) {
      throw new Error('Unsupported or incomplete diagnostic catalog.');
    }
    const codes = new Set();
    // Check the lookup record's shape and identity. Full semantic catalog
    // validation remains the publishing check, not a second schema here.
    for (const diagnostic of catalog.diagnostics) {
      if (!diagnostic || typeof diagnostic.code !== 'string' || !/^MN[0-9]{4}$/.test(diagnostic.code) || codes.has(diagnostic.code) ||
          !['defined', 'active', 'deprecated', 'retired'].includes(diagnostic.status) ||
          !['slug', 'category', 'severity', 'remediation', 'benchmarkCategory'].every(field =>
            typeof diagnostic[field] === 'string' && diagnostic[field].trim()) ||
          !['objects', 'surfaces'].every(field => Array.isArray(diagnostic[field]) && diagnostic[field].length &&
            diagnostic[field].every(value => typeof value === 'string' && value.trim())) ||
          diagnostic.docsAnchor !== `/errors/${diagnostic.code}/` ||
          diagnostic.docsSection !== `docs/api/errors.md#${diagnostic.code.toLowerCase()}` ||
          (diagnostic.status === 'deprecated' ? !/^MN[0-9]{4}$/.test(diagnostic.replacementCode) :
            diagnostic.replacementCode !== undefined)) {
        throw new Error('Invalid or duplicate diagnostic catalog entry.');
      }
      codes.add(diagnostic.code);
    }
    const diagnostic = catalog.diagnostics.find(value => value.code === options.diagnostic);
    if (!diagnostic) { throw new Error(`Unknown diagnostic code: ${options.diagnostic}`); }
    const sectionIndex = JSON.parse(files.get('docs-sections.json')?.content.toString('utf8') ?? '{}');
    if (!sectionIndex.sections?.some(section => section.id === diagnostic.docsSection)) {
      throw new Error('Diagnostic section is absent from the installed documentation.');
    }
    console.log(JSON.stringify({ ...provenance, source, sha256: entry.sha256, diagnostic }, null, 2));
  } else if (mode === 'search' || mode === 'section' || mode === 'symbol') {
    const entry = files.get('docs-sections.json');
    if (!entry) { throw new Error('This artifact has no section index. Use --page or search its installed Markdown directly.'); }
    const index = JSON.parse(entry.content.toString('utf8'));
    if (index.schemaVersion !== 1 || !Array.isArray(index.sections)) {
      throw new Error('Unsupported documentation section index.');
    }
    const pageSources = new Set(manifest.pages.map(page => page.source));
    const ids = new Set();
    for (const section of index.sections) {
      if (typeof section.id !== 'string' || ids.has(section.id) || !pageSources.has(section.source) ||
          typeof section.heading !== 'string' || !Number.isInteger(section.depth) || !Array.isArray(section.ancestors) ||
          !Number.isInteger(section.start) || !Number.isInteger(section.end) || section.start < 0 ||
          section.end < section.start || section.end > files.get(section.source).content.toString('utf8').length) {
        throw new Error('Invalid documentation section index.');
      }
      ids.add(section.id);
    }
    if (mode === 'symbol') {
      const symbols = files.get('docs-symbols.json');
      if (!symbols) { throw new Error('This artifact has no symbol index. Use --search against its installed sections.'); }
      const symbolIndex = JSON.parse(symbols.content.toString('utf8'));
      validateSymbolIndex(symbolIndex, ids);
      console.log(JSON.stringify({ ...provenance, ...findSymbols(symbolIndex, index.sections, files, options.symbol) }, null, 2));
    } else if (mode === 'search') {
      if (!options.search.trim() || options.search.length > 200) { throw new Error('Search requires 1–200 characters.'); }
      console.log(JSON.stringify({ ...provenance, query: options.search,
        results: searchSections(index.sections, files, options.search) }, null, 2));
    } else {
      if (options.page && !pageSources.has(options.page)) {
        throw new Error('Page is not in this package manifest. Use --list to find its exact source path.');
      }
      const matches = index.sections.filter(value => options.page ? value.source === options.page &&
        (value.id === options.section || value.heading === options.section ||
          value.id.slice(value.id.indexOf('#') + 1) === options.section) :
        value.id === options.section);
      if (matches.length > 1) {
        throw new Error(`Ambiguous section heading. Use --section with one exact ID: ${matches.map(value => value.id).join(', ')}`);
      }
      const section = matches[0];
      if (!section) {
        throw new Error('Unknown section ID or heading. Use --section SOURCE#ANCHOR or --page SOURCE --section "Heading". Use --search when the location is unknown.');
      }
      console.log(JSON.stringify({ ...provenance, ...section }));
      console.log(files.get(section.source).content.toString('utf8').slice(section.start, section.end));
    }
  } else if (mode === 'page') {
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
